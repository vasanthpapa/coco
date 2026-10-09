import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// This database is deliberately local-only. Coco continues to use MongoDB at runtime.
const file = resolve(process.env.COCO_SQLITE_PATH || 'data/coco.local.db');
mkdirSync(dirname(file), { recursive: true });

const database = new DatabaseSync(file);
try {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY,
      emp_id TEXT NOT NULL COLLATE NOCASE UNIQUE,
      employee_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS name_mappings (
      id INTEGER PRIMARY KEY,
      emp_id TEXT NOT NULL COLLATE NOCASE,
      employee_name TEXT NOT NULL COLLATE NOCASE,
      aliases TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_name_mappings_emp_id ON name_mappings(emp_id);
  `);

  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('employees', 'name_mappings')").all();
  if (tables.length !== 2) throw new Error('Coco SQLite schema verification failed.');
  console.log(`Coco local SQLite database is ready: ${file}`);
} finally {
  database.close();
}
