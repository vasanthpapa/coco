import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { DatabaseSync } from 'node:sqlite';
import { migrateSqliteToMongo } from '../scripts/migrate-database.mjs';
import ts from 'typescript';

mkdirSync('.test-output', { recursive: true });
const directory = mkdtempSync(resolve('.test-output/mongodb-'));
function compile(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const file = `${folder}/${entry.name}`;
    if (entry.isDirectory()) { compile(file); continue; }
    if (!file.endsWith('.ts')) continue;
    const output = `${directory}/${file.slice(0, -3)}.js`;
    mkdirSync(dirname(output), { recursive: true });
    const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    });
    writeFileSync(output, outputText.replace(/(from\s+|import\s*)(['"])([^'"]+)\2/g, (match, prefix, quote, specifier) => {
      if (specifier.startsWith('@/')) specifier = pathToFileURL(`${directory}/${specifier.slice(2)}.js`).href;
      else if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) specifier += '.js';
      else if (specifier === 'next/server') specifier = 'next/server.js';
      return `${prefix}${quote}${specifier}${quote}`;
    }));
  }
}
for (const folder of ['src/lib', 'src/utils', 'src/app/api']) compile(folder);
const moduleAt = file => import(pathToFileURL(`${directory}/${file}.js`).href);
let replica, client, database, store;

before(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: { downloadDir: resolve('.test-output/mongodb-binaries') },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  process.env.MONGODB_URI = replica.getUri();
  process.env.MONGODB_DB = 'coco_test';
  const connection = await (await moduleAt('src/lib/database')).getDatabase();
  ({ client, database } = connection);
  store = await (await moduleAt('src/lib/employeeStore')).getEmployeeStore();
});

after(async () => {
  await client?.close();
  delete globalThis.cocoMongo;
  await replica?.stop();
});

async function reset() {
  await database.collection('name_mappings').deleteMany({});
  await database.collection('employees').deleteMany({});
}

test('numeric IDs, case-insensitive uniqueness and concurrent creates', async () => {
  await reset();
  const employees = await Promise.all(Array.from({ length: 5 }, (_, i) => store.createEmployee(`EMP${i}`, `Employee ${i}`)));
  assert.equal(new Set(employees.map(row => row.id)).size, 5);
  assert.ok(employees.every(row => Number.isSafeInteger(row.id)));
  await assert.rejects(store.createEmployee('emp0', 'Different'), error => error.code === 11000);
  await assert.rejects(store.createEmployee('NEW', 'EMPLOYEE 0'), error => error.code === 11000);
  assert.equal((await store.listEmployees()).length, 5);
});

test('rename preserves mappings; failed duplicate rename rolls back; reorder and delete', async () => {
  await reset();
  const a = await store.createEmployee('EMP001', 'Alpha');
  const b = await store.createEmployee('EMP002', 'Beta');
  await store.addAlias('Alpha', 'First Alias');
  await store.updateEmployee(a.id, 'EMP003', 'Renamed');
  assert.equal((await store.listMappings())[0].empId, 'EMP003');
  await assert.rejects(store.updateEmployee(a.id, 'EMP002', 'Invalid'), error => error.code === 11000);
  assert.equal((await store.listMappings())[0].employeeName, 'Renamed');
  assert.equal((await store.listEmployees()).find(row => row.id === a.id).empId, 'EMP003');
  await store.reorderEmployees([b.id, a.id]);
  assert.deepEqual((await store.listEmployees()).map(row => row.id), [b.id, a.id]);
  await assert.rejects(store.reorderEmployees([a.id, 999999]), error => error.status === 404);
  assert.deepEqual((await store.listEmployees()).map(row => row.id), [b.id, a.id]);
  await store.deleteEmployee(a.id);
  assert.deepEqual(await store.listMappings(), []);
});

test('concurrent aliases, duplicate rejection, reassignment and removal', async () => {
  await reset();
  await store.createEmployee('EMP001', 'Alpha');
  await store.createEmployee('EMP002', 'Beta');
  await Promise.all(['One', 'Two', 'Three'].map(alias => store.addAlias('alpha', alias)));
  const [mapping] = await store.listMappings();
  assert.equal(mapping.aliases.length, 3);
  await assert.rejects(store.addAlias('Alpha', 'ONE'), error => error.status === 409);
  await store.updateMapping(mapping.id, 'Beta', ['New', 'Other']);
  assert.equal((await store.listMappings())[0].employeeName, 'Beta');
  await store.removeAlias(mapping.id, 'OTHER');
  assert.deepEqual((await store.listMappings())[0].aliases, ['New']);
  const result = await store.deleteMappingByEmployee('Beta');
  assert.equal(result.deleted, true);
  assert.deepEqual(await store.listMappings(), []);
});

test('actual API handlers preserve JSON contracts and analysis works with MongoDB', async () => {
  await reset();
  const employees = await moduleAt('src/app/api/employees/route');
  const mappings = await moduleAt('src/app/api/name-mappings/route');
  const analysis = await moduleAt('src/app/api/analyze/route');
  const request = (body, method = 'POST') => new Request('http://localhost/api/test', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  let response = await employees.POST(request({ empId: 'EMP001', employeeName: 'API Employee' }));
  assert.equal(response.status, 201);
  const employee = await response.json();
  assert.equal(employee.active, true);
  assert.ok(!('_id' in employee));
  response = await employees.POST(request({ empId: 'EMP001', employeeName: 'Duplicate' }));
  assert.equal(response.status, 409);
  response = await mappings.POST(request({ employeeName: 'API Employee', alias: 'Alias' }));
  assert.equal(response.status, 201);
  assert.deepEqual((await (await mappings.GET()).json())[0].aliases, ['Alias']);
  for (const body of [
    { type: 'csv', text: 'name,value\nTest,1' },
    { type: 'json', text: '[{"name":"Test","value":1}]' },
    { type: 'whatsapp', text: '[24/09/2026, 09:00:00] Alias: in' },
  ]) {
    response = await analysis.POST(request(body));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
  }
  response = await employees.POST(request({}));
  assert.equal(response.status, 400);
});

test('missing or malformed configuration returns JSON without leaking credentials', async () => {
  const uri = process.env.MONGODB_URI;
  const saved = globalThis.cocoMongo;
  const employees = await moduleAt('src/app/api/employees/route');
  try {
    delete globalThis.cocoMongo;
    delete process.env.MONGODB_URI;
    let response = await employees.GET();
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /MONGODB_URI/);
    process.env.MONGODB_URI = 'mongodb+srv://bad:secret@invalid@@host/';
    response = await employees.GET();
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('secret'));
  } finally {
    process.env.MONGODB_URI = uri;
    globalThis.cocoMongo = saved;
  }
});

test('SQLite migration preserves records, advances IDs and refuses an occupied destination', async () => {
  await reset();
  const file = `${directory}/legacy.db`;
  const sqlite = new DatabaseSync(file);
  sqlite.exec(`
    CREATE TABLE employees (id INTEGER PRIMARY KEY, emp_id TEXT, employee_name TEXT, sort_order INTEGER, active INTEGER);
    CREATE TABLE name_mappings (id INTEGER PRIMARY KEY, emp_id TEXT, employee_name TEXT, aliases TEXT);
    INSERT INTO employees VALUES (50, 'EMP050', 'Imported Employee', 0, 1);
    INSERT INTO name_mappings VALUES (70, 'EMP050', 'Imported Employee', '["Imported Alias"]');
  `);
  sqlite.close();
  assert.deepEqual(await migrateSqliteToMongo(client, database, file), { employees: 1, mappings: 1 });
  const [employee] = await store.listEmployees();
  assert.equal(employee.id, 50);
  assert.deepEqual((await store.listMappings())[0].aliases, ['Imported Alias']);
  assert.equal((await store.createEmployee('EMP051', 'Next Employee')).id, 51);
  assert.equal((await store.addAlias('Next Employee', 'Next')).mapping.id, 71);
  await assert.rejects(migrateSqliteToMongo(client, database, file), /not empty/);
  assert.equal((await store.listEmployees()).length, 2);
});

test('invalid source mappings abort migration without partial destination records', async () => {
  await reset();
  const file = `${directory}/orphan.db`;
  const sqlite = new DatabaseSync(file);
  sqlite.exec(`
    CREATE TABLE employees (id INTEGER PRIMARY KEY, emp_id TEXT, employee_name TEXT, sort_order INTEGER, active INTEGER);
    CREATE TABLE name_mappings (id INTEGER PRIMARY KEY, emp_id TEXT, employee_name TEXT, aliases TEXT);
    INSERT INTO employees VALUES (1, 'EMP001', 'One', 0, 1);
    INSERT INTO name_mappings VALUES (1, 'MISSING', 'Missing', '["Alias"]');
  `);
  sqlite.close();
  await assert.rejects(migrateSqliteToMongo(client, database, file), /no matching employee/);
  assert.deepEqual(await store.listEmployees(), []);
  assert.deepEqual(await store.listMappings(), []);
});
