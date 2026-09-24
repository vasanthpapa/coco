import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createClient } from '@libsql/client';

// Exercise the actual adapter against an isolated database, never user data.
mkdirSync('.test-output', { recursive: true });
const directory = mkdtempSync(resolve('.test-output/database-'));
for (const name of ['database', 'databaseSchema']) {
  const source = readFileSync(`src/lib/${name}.ts`, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  writeFileSync(`${directory}/${name}.js`, outputText.replace("'./databaseSchema'", "'./databaseSchema.js'"));
}
const moduleUrl = pathToFileURL(`${directory}/database.js`).href;

test('Vercel rejects missing credentials without creating a local database', async () => {
  process.env.VERCEL = '1';
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  const { default: db } = await import(`${moduleUrl}?missing`);
  await assert.rejects(db.prepare('SELECT 1').get(), /Configure TURSO_DATABASE_URL/);
  process.env.TURSO_DATABASE_URL = 'file:forbidden.db';
  process.env.TURSO_AUTH_TOKEN = 'test';
  await assert.rejects(db.prepare('SELECT 1').get(), /Configure TURSO_DATABASE_URL/);
  delete process.env.VERCEL;
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
});

test('schema initialization, concurrent reads, identity changes, rollback and deletion', async () => {
  process.env.LOCAL_DATABASE_PATH = `${directory}/test.db`;
  const { default: db } = await import(`${moduleUrl}?local`);
  const reads = await Promise.all(Array.from({ length: 5 }, () => db.prepare('SELECT * FROM employees').all()));
  assert.ok(reads.every(rows => rows.length === 0));
  const inserted = await db.prepare('INSERT INTO employees (emp_id, employee_name) VALUES (?, ?)').run('EMP001', 'Test Employee');
  assert.equal(inserted.changes, 1);
  assert.ok(inserted.lastInsertRowid);
  await db.prepare('INSERT INTO name_mappings (emp_id, employee_name, aliases) VALUES (?, ?, ?)').run('EMP001', 'Test Employee', '["Alias"]');
  await assert.rejects(db.transaction(async tx => {
    await tx.prepare('UPDATE employees SET employee_name = ? WHERE emp_id = ?').run('Rolled back', 'EMP001');
    throw new Error('forced rollback');
  })(), /forced rollback/);
  assert.equal((await db.prepare('SELECT employee_name FROM employees').get()).employee_name, 'Test Employee');
  await db.transaction(async tx => {
    await tx.prepare('UPDATE employees SET emp_id = ?, employee_name = ?').run('EMP002', 'Renamed');
    await tx.prepare('UPDATE name_mappings SET emp_id = ?, employee_name = ?').run('EMP002', 'Renamed');
  })();
  const row = await db.prepare('SELECT e.employee_name, m.aliases FROM employees e JOIN name_mappings m ON e.emp_id = m.emp_id').get();
  assert.equal(row.employee_name, 'Renamed');
  assert.deepEqual(JSON.parse(row.aliases), ['Alias']);
  await db.transaction(async tx => {
    await tx.prepare('DELETE FROM name_mappings').run();
    await tx.prepare('DELETE FROM employees').run();
  })();
  assert.deepEqual(await db.prepare('SELECT * FROM employees').all(), []);
  assert.deepEqual(await db.prepare('SELECT * FROM name_mappings').all(), []);
});

test('existing SQLite employee records and aliases survive schema migration', async () => {
  const file = `${directory}/legacy.db`;
  const seed = createClient({ url: pathToFileURL(file).href });
  await seed.batch([
    `CREATE TABLE employees (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_name TEXT NOT NULL UNIQUE, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE name_mappings (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_name TEXT NOT NULL UNIQUE, aliases TEXT NOT NULL DEFAULT '[]', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    "INSERT INTO employees (employee_name) VALUES ('Existing Employee')",
    `INSERT INTO name_mappings (employee_name, aliases) VALUES ('Existing Employee', '["Existing Alias"]')`,
  ], 'write');
  seed.close();
  process.env.LOCAL_DATABASE_PATH = file;
  const { default: db } = await import(`${moduleUrl}?legacy`);
  const employee = await db.prepare('SELECT * FROM employees').get();
  const mapping = await db.prepare('SELECT * FROM name_mappings').get();
  assert.equal(employee.employee_name, 'Existing Employee');
  assert.equal(employee.emp_id, 'EMP001');
  assert.equal(mapping.emp_id, employee.emp_id);
  assert.deepEqual(JSON.parse(mapping.aliases), ['Existing Alias']);
});
