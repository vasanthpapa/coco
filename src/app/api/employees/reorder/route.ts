import { NextResponse } from 'next/server';
import db from '@/src/lib/database';

/**
 * PUT /api/employees/reorder
 *
 * Body:
 * {
 *   employeeIds: [5, 2, 7, 1]
 * }
 *
 * The array order becomes the new employee sort order.
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const employeeIds = body?.employeeIds;

    if (!Array.isArray(employeeIds)) {
      return NextResponse.json(
        {
          error: 'employeeIds must be an array.',
        },
        {
          status: 400,
        }
      );
    }

    if (employeeIds.length === 0) {
      return NextResponse.json(
        {
          error: 'employeeIds cannot be empty.',
        },
        {
          status: 400,
        }
      );
    }

    // Convert IDs to numbers and validate them.
    const normalizedIds = employeeIds.map(
      (id) => Number(id)
    );

    const hasInvalidId = normalizedIds.some(
      (id) =>
        !Number.isInteger(id) ||
        id <= 0
    );

    if (hasInvalidId) {
      return NextResponse.json(
        {
          error:
            'employeeIds must contain only valid positive integers.',
        },
        {
          status: 400,
        }
      );
    }

    // Prevent duplicate IDs.
    const uniqueIds = new Set(normalizedIds);

    if (
      uniqueIds.size !==
      normalizedIds.length
    ) {
      return NextResponse.json(
        {
          error:
            'employeeIds cannot contain duplicates.',
        },
        {
          status: 400,
        }
      );
    }

    // Verify that all supplied employees exist.
    const placeholders = normalizedIds
      .map(() => '?')
      .join(', ');

    const existingEmployees = db
      .prepare(`
        SELECT id
        FROM employees
        WHERE id IN (${placeholders})
          AND active = 1
      `)
      .all(
        ...normalizedIds
      ) as Array<{ id: number }>;

    if (
      existingEmployees.length !==
      normalizedIds.length
    ) {
      return NextResponse.json(
        {
          error:
            'One or more employees were not found.',
        },
        {
          status: 404,
        }
      );
    }

    const updateSortOrder = db.prepare(`
      UPDATE employees
      SET
        sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    // Update everything as one transaction.
    const reorderEmployees =
      db.transaction(
        (ids: number[]) => {
          ids.forEach(
            (employeeId, index) => {
              updateSortOrder.run(
                index,
                employeeId
              );
            }
          );
        }
      );

    reorderEmployees(normalizedIds);

    const rows = db
      .prepare(`
        SELECT
          id,
          employee_name,
          sort_order,
          active,
          created_at,
          updated_at
        FROM employees
        WHERE active = 1
        ORDER BY sort_order ASC
      `)
      .all();

    return NextResponse.json({
      success: true,
      employees: rows.map(
        (row: any) => ({
          id: row.id,
          employeeName:
            row.employee_name,
          sortOrder:
            row.sort_order,
          active:
            Boolean(row.active),
          createdAt:
            row.created_at,
          updatedAt:
            row.updated_at,
        })
      ),
    });
  } catch (error) {
    console.error(
      'PUT /api/employees/reorder error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to reorder employees.',
      },
      {
        status: 500,
      }
    );
  }
}