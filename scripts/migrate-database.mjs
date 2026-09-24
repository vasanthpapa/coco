import { createClient } from '@libsql/client';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url || !authToken || !/^(libsql|https):\/\//.test(url)) {
  throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before migrating.');
}
const file = resolve(process.env.LOCAL_DATABASE_PATH || 'data/coco.db');
if (!existsSync(file)) throw new Error('Local database does not exist.');

const source = createClient({ url: pathToFileURL(file).href });
const destination = createClient({ url, authToken });
const tables = ['employees', 'name_mappings'];
let tx;
try {
  // Take one consistent read snapshot of the local tables and schema.
  const snapshot = await source.batch([
    "SELECT name, type, sql FROM sqlite_master WHERE tbl_name IN ('employees', 'name_mappings') AND sql IS NOT NULL ORDER BY type DESC",
    ...tables.map(table => `SELECT * FROM ${table}`),
  ], 'read');
  const schema = snapshot[0].rows;
  tx = await destination.transaction('write');
  for (const table of tables) {
    const found = await tx.execute({ sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", args: [table] });
    if (found.rows.length) {
      const count = await tx.execute(`SELECT COUNT(*) AS count FROM ${table}`);
      if (Number(count.rows[0].count) > 0) {
        throw new Error(`Destination ${table} is not empty. No records were copied.`);
      }
    } else {
      const definition = schema.find(row => row.type === 'table' && row.name === table);
      if (!definition) throw new Error(`Source table ${table} is missing.`);
      await tx.execute(String(definition.sql));
    }
  }
  for (const [index, table] of tables.entries()) {
    const rows = snapshot[index + 1].rows;
    const columns = snapshot[index + 1].columns;
    const identifiers = columns.map(column => `"${column.replaceAll('"', '""')}"`).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    for (const row of rows) {
      await tx.execute({
        sql: `INSERT INTO ${table} (${identifiers}) VALUES (${placeholders})`,
        args: columns.map(column => row[column]),
      });
    }
  }
  for (const index of schema.filter(row => row.type === 'index')) {
    await tx.execute(String(index.sql).replace(/^CREATE (UNIQUE )?INDEX /i, 'CREATE $1INDEX IF NOT EXISTS '));
  }
  await tx.commit();
  console.log(`Migration complete: ${snapshot[1].rows.length} employees, ${snapshot[2].rows.length} mappings.`);
} catch (error) {
  if (tx && !tx.closed) await tx.rollback();
  throw error;
} finally {
  tx?.close();
  source.close();
  destination.close();
}
