import { NextResponse } from 'next/server';
import db from '@/src/lib/database';

interface EmployeeRow {
  id: number;
  emp_id: string;
  employee_name: string;
  sort_order: number;
  active: number;
  created_at: string;
  updated_at: string;
}

function formatEmployee(row: EmployeeRow) {
  return {
    id: row.id,
    empId: row.emp_id,
    employeeName: row.employee_name,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getEmployeeId(
  params: { id: string }
): number | null {
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

/**
 * PUT /api/employees/:id
 *
 * Body:
 * {
 *   empId: "EMP001",
 *   employeeName: "Praveen Kumar"
 * }
 */
export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const resolvedParams = await params;
    const employeeId = getEmployeeId(resolvedParams);

    if (employeeId === null) {
      return NextResponse.json(
        {
          error: 'Invalid employee ID.',
        },
        {
          status: 400,
        }
      );
    }

    const body = await request.json();

    const empId = String(
      body?.empId || ''
    )
      .trim()
      .toUpperCase();

    const employeeName = String(
      body?.employeeName || ''
    ).trim();

    if (!empId) {
      return NextResponse.json(
        {
          error: 'Employee ID is required.',
        },
        {
          status: 400,
        }
      );
    }

    if (!employeeName) {
      return NextResponse.json(
        {
          error: 'Employee name is required.',
        },
        {
          status: 400,
        }
      );
    }

    const existing = await db
      .prepare(`
        SELECT
          id,
          emp_id,
          employee_name,
          sort_order,
          active,
          created_at,
          updated_at
        FROM employees
        WHERE id = ?
        LIMIT 1
      `)
      .get(employeeId) as
      | EmployeeRow
      | undefined;

    if (!existing) {
      return NextResponse.json(
        {
          error: 'Employee not found.',
        },
        {
          status: 404,
        }
      );
    }

    // Check duplicate employee ID.
    const duplicateEmpId = await db
      .prepare(`
        SELECT id
        FROM employees
        WHERE LOWER(TRIM(emp_id)) =
              LOWER(TRIM(?))
          AND id != ?
        LIMIT 1
      `)
      .get(
        empId,
        employeeId
      ) as
      | { id: number }
      | undefined;

    if (duplicateEmpId) {
      return NextResponse.json(
        {
          error:
            `"${empId}" already exists.`,
        },
        {
          status: 409,
        }
      );
    }

    // Check duplicate employee name.
    const duplicateName = await db
      .prepare(`
        SELECT id
        FROM employees
        WHERE LOWER(TRIM(employee_name)) =
              LOWER(TRIM(?))
          AND id != ?
        LIMIT 1
      `)
      .get(
        employeeName,
        employeeId
      ) as
      | { id: number }
      | undefined;

    if (duplicateName) {
      return NextResponse.json(
        {
          error:
            `"${employeeName}" already exists.`,
        },
        {
          status: 409,
        }
      );
    }

    const oldEmpId = existing.emp_id;
    const oldEmployeeName = existing.employee_name;

    const updateEmployee = db.transaction(async (db) => {
      // Update employee identity and display name.
      await db.prepare(`
        UPDATE employees
        SET
          emp_id = ?,
          employee_name = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        empId,
        employeeName,
        employeeId
      );

      // Keep name mapping attached to the same employee.
      await db.prepare(`
        UPDATE name_mappings
        SET
          emp_id = ?,
          employee_name = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(TRIM(emp_id)) =
              LOWER(TRIM(?))
      `).run(
        empId,
        employeeName,
        oldEmpId
      );

      // Compatibility fallback for any old mapping
      // that does not yet have an emp_id.
      await db.prepare(`
        UPDATE name_mappings
        SET
          emp_id = ?,
          employee_name = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE emp_id IS NULL
          AND LOWER(TRIM(employee_name)) =
              LOWER(TRIM(?))
      `).run(
        empId,
        employeeName,
        oldEmployeeName
      );
    });

    await updateEmployee();

    const updated = await db
      .prepare(`
        SELECT
          id,
          emp_id,
          employee_name,
          sort_order,
          active,
          created_at,
          updated_at
        FROM employees
        WHERE id = ?
        LIMIT 1
      `)
      .get(employeeId) as EmployeeRow;

    return NextResponse.json({
      success: true,
      employee: formatEmployee(updated),
    });
  } catch (error) {
    console.error(
      'PUT /api/employees/[id] error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to update employee.',
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * DELETE /api/employees/:id
 */
export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const resolvedParams = await params;
    const employeeId = getEmployeeId(
      resolvedParams
    );

    if (employeeId === null) {
      return NextResponse.json(
        {
          error: 'Invalid employee ID.',
        },
        {
          status: 400,
        }
      );
    }

    const existing = await db
      .prepare(`
        SELECT
          id,
          emp_id,
          employee_name
        FROM employees
        WHERE id = ?
        LIMIT 1
      `)
      .get(employeeId) as
      | {
          id: number;
          emp_id: string;
          employee_name: string;
        }
      | undefined;

    if (!existing) {
      return NextResponse.json(
        {
          error: 'Employee not found.',
        },
        {
          status: 404,
        }
      );
    }

    await db.transaction(async (db) => {
      await db.prepare(`
        DELETE FROM name_mappings
        WHERE LOWER(TRIM(emp_id)) =
              LOWER(TRIM(?))
      `).run(existing.emp_id);

      await db.prepare(`
        DELETE FROM employees
        WHERE id = ?
      `).run(employeeId);
    })();

    return NextResponse.json({
      success: true,
      message:
        `"${existing.employee_name}" deleted successfully.`,
    });
  } catch (error) {
    console.error(
      'DELETE /api/employees/[id] error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to delete employee.',
      },
      {
        status: 500,
      }
    );
  }
}
