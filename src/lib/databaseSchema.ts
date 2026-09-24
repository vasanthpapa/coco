import type { DatabaseSession } from './database';

export async function initializeSchema(db: DatabaseSession) {
  // Name mappings table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS name_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL UNIQUE,
      aliases TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Employees table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add emp_id to employees if missing.
  const employeeColumns = await db
    .prepare(`PRAGMA table_info(employees)`)
    .all() as Array<{
      name: string;
    }>;

  const hasEmployeeEmpId = employeeColumns.some(
    column => column.name === 'emp_id'
  );

  if (!hasEmployeeEmpId) {
    await db.exec(`
      ALTER TABLE employees
      ADD COLUMN emp_id TEXT
    `);
  }

  // Assign EMP001, EMP002, ... to existing employees.
  const employeesWithoutEmpId = await db
    .prepare(`
      SELECT id
      FROM employees
      WHERE emp_id IS NULL
         OR TRIM(emp_id) = ''
      ORDER BY id ASC
    `)
    .all() as Array<{
      id: number;
    }>;

  if (employeesWithoutEmpId.length > 0) {
    const updateEmpId = db.prepare(`
      UPDATE employees
      SET
        emp_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const assignEmpIds = async () => {
      const lastEmployee = await db
        .prepare(`
          SELECT emp_id
          FROM employees
          WHERE emp_id LIKE 'EMP%'
          ORDER BY id DESC
          LIMIT 1
        `)
        .get() as
        | {
            emp_id: string;
          }
        | undefined;

      let nextNumber = lastEmployee
        ? Number(
            lastEmployee.emp_id.replace('EMP', '')
          ) + 1
        : 1;

      for (const employee of employeesWithoutEmpId) {
        const empId = `EMP${String(
          nextNumber
        ).padStart(3, '0')}`;

        await updateEmpId.run(
          empId,
          employee.id
        );

        nextNumber++;
      }
    };

    await assignEmpIds();
  }

  // Protect employee IDs from duplicates.
  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_employees_emp_id
    ON employees(emp_id)
  `);

  // Add emp_id to name_mappings if missing.
  const mappingColumns = await db
    .prepare(`PRAGMA table_info(name_mappings)`)
    .all() as Array<{
      name: string;
    }>;

  const hasMappingEmpId = mappingColumns.some(
    column => column.name === 'emp_id'
  );

  if (!hasMappingEmpId) {
    await db.exec(`
      ALTER TABLE name_mappings
      ADD COLUMN emp_id TEXT
    `);
  }

  // Connect existing mappings to their employees.
  await db.exec(`
    UPDATE name_mappings
    SET emp_id = (
      SELECT employees.emp_id
      FROM employees
      WHERE LOWER(employees.employee_name) =
            LOWER(name_mappings.employee_name)
      LIMIT 1
    )
    WHERE emp_id IS NULL
       OR TRIM(emp_id) = ''
  `);

  // Protect mapping employee IDs from duplicates.
  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_name_mappings_emp_id
    ON name_mappings(emp_id)
    WHERE emp_id IS NOT NULL
  `);

  // Keep mapping employee names synchronized with the employee table.
  await db.exec(`
    UPDATE name_mappings
    SET employee_name = (
      SELECT employees.employee_name
      FROM employees
      WHERE employees.emp_id = name_mappings.emp_id
      LIMIT 1
    )
    WHERE emp_id IS NOT NULL
  `);

}
