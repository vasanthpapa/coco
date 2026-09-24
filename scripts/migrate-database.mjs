import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MongoClient } from 'mongodb';
import { initializeMongoSchema } from '../src/lib/mongoSchema.ts';

export async function migrateSqliteToMongo(client, database, file) {
  if (!existsSync(file)) throw new Error('Local SQLite database does not exist.');
  const source = new DatabaseSync(file, { readOnly: true });
  let employees, mappings;
  try {
    source.exec('BEGIN');
    const employeeRows = source.prepare('SELECT * FROM employees ORDER BY id').all();
    const mappingRows = source.prepare('SELECT * FROM name_mappings ORDER BY id').all();
    source.exec('COMMIT');
    const now = new Date().toISOString();
    employees = employeeRows.map(row => ({
      id: Number(row.id), empId: String(row.emp_id || `EMP${String(row.id).padStart(3, '0')}`).trim().toUpperCase(),
      employeeName: String(row.employee_name).trim(), nameKey: String(row.employee_name).trim().toLowerCase(),
      sortOrder: Number(row.sort_order || 0), active: Boolean(row.active),
      createdAt: String(row.created_at || now), updatedAt: String(row.updated_at || now),
    }));
    mappings = mappingRows.map(row => {
      const employee = employees.find(item => row.emp_id
        ? item.empId === String(row.emp_id).trim().toUpperCase()
        : item.nameKey === String(row.employee_name).trim().toLowerCase());
      if (!employee) throw new Error(`Mapping ${row.id} has no matching employee; migration cancelled.`);
      const aliases = JSON.parse(row.aliases || '[]');
      if (!Array.isArray(aliases) || aliases.some(alias => typeof alias !== 'string')) {
        throw new Error(`Mapping ${row.id} has invalid aliases; migration cancelled.`);
      }
      return {
        id: Number(row.id), employeeId: employee.id, empId: employee.empId,
        employeeName: employee.employeeName, aliases,
        createdAt: String(row.created_at || now), updatedAt: String(row.updated_at || now),
      };
    });
  } finally {
    source.close();
  }
  if ([...employees, ...mappings].some(row => !Number.isSafeInteger(row.id) || row.id <= 0)) {
    throw new Error('Source contains invalid numeric IDs; migration cancelled.');
  }
  await initializeMongoSchema(database);
  await client.withSession(session => session.withTransaction(async () => {
    // Conflict with concurrent application creates rather than replacing data.
    for (const name of ['employees', 'name_mappings']) {
      await database.collection('counters').updateOne({ _id: name }, { $inc: { migrationRevision: 1 } }, { session });
      if (await database.collection(name).countDocuments({}, { session })) {
        throw new Error(`Destination ${name} is not empty. No records were copied.`);
      }
    }
    if (employees.length) await database.collection('employees').insertMany(employees, { session });
    if (mappings.length) await database.collection('name_mappings').insertMany(mappings, { session });
    for (const [name, rows] of [['employees', employees], ['name_mappings', mappings]]) {
      const maximum = rows.reduce((max, row) => Math.max(max, row.id), 0);
      await database.collection('counters').updateOne({ _id: name }, { $max: { value: maximum } }, { session });
    }
  }));
  return { employees: employees.length, mappings: mappings.length };
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('Configure MONGODB_URI before migrating.');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const counts = await migrateSqliteToMongo(
      client, client.db(process.env.MONGODB_DB?.trim() || 'coco'),
      resolve(process.env.SQLITE_DATABASE_PATH || 'data/coco.db')
    );
    console.log(`Migration complete: ${counts.employees} employees, ${counts.mappings} mappings.`);
  } finally { await client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('Migration failed; destination writes were rolled back. Check the connection, network access, source records and that the destination is empty.');
    process.exitCode = 1;
  });
}
