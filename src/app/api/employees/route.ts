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

/**
 * GET /api/employees
 *
 * Returns all active employees in sort order.
 */
export async function GET() {
  try {
    const rows = await db
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
        WHERE active = 1
        ORDER BY sort_order ASC, employee_name COLLATE NOCASE ASC
      `)
      .all() as EmployeeRow[];

    return NextResponse.json(
      rows.map(formatEmployee)
    );
  } catch (error) {
    console.error(
      'GET /api/employees error:',
      error
    );

    return NextResponse.json(
      {
        error: 'Failed to load employees.',
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * POST /api/employees
 *
 * Body:
 * {
 *   employeeName: "Fathima"
 * }
 *
 * empId is generated automatically.
 */
export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const empId = String(
      body?.empId || ''
    ).trim().toUpperCase();

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

    const existingEmpId = await db
      .prepare(`
        SELECT id
        FROM employees
        WHERE LOWER(emp_id) = LOWER(?)
        LIMIT 1
      `)
      .get(empId) as
      | { id: number }
      | undefined;

    if (existingEmpId) {
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

    const existingName = await db
      .prepare(`
        SELECT id
        FROM employees
        WHERE LOWER(employee_name) = LOWER(?)
        LIMIT 1
      `)
      .get(employeeName) as
      | { id: number }
      | undefined;

    if (existingName) {
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

    const maxSortOrder = await db
      .prepare(`
        SELECT
          COALESCE(
            MAX(sort_order),
            -1
          ) AS max_sort_order
        FROM employees
      `)
      .get() as {
        max_sort_order: number;
      };

    const sortOrder =
      maxSortOrder.max_sort_order + 1;

    const result = await db
      .prepare(`
        INSERT INTO employees (
          emp_id,
          employee_name,
          sort_order,
          active
        )
        VALUES (?, ?, ?, 1)
      `)
      .run(
        empId,
        employeeName,
        sortOrder
      );

    const created = await db
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
      `)
      .get(
        result.lastInsertRowid
      ) as EmployeeRow;

    return NextResponse.json(
      formatEmployee(created),
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      'POST /api/employees error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to create employee.',
      },
      {
        status: 500,
      }
    );
  }
}