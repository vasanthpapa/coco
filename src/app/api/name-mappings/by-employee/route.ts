import { NextResponse } from 'next/server';
import db from '@/src/lib/database';

export async function DELETE(
  request: Request
) {
  try {
    const body = await request.json();

    const employeeName = String(
      body?.employeeName || ''
    ).trim();

    if (!employeeName) {
      return NextResponse.json(
        {
          error:
            'Employee name is required.',
        },
        { status: 400 }
      );
    }

    // Resolve employee name to the stable empId.
    const employee = db
      .prepare(`
        SELECT
          emp_id,
          employee_name
        FROM employees
        WHERE LOWER(employee_name) = LOWER(?)
        LIMIT 1
      `)
      .get(employeeName) as
      | {
          emp_id: string;
          employee_name: string;
        }
      | undefined;

    if (!employee) {
      return NextResponse.json(
        {
          error:
            `"${employeeName}" is not a valid employee.`,
        },
        { status: 404 }
      );
    }

    // Delete mapping using stable empId.
    const result = db
      .prepare(`
        DELETE FROM name_mappings
        WHERE emp_id = ?
      `)
      .run(employee.emp_id);

    return NextResponse.json({
      success: true,
      deleted: result.changes > 0,
      empId: employee.emp_id,
      employeeName:
        employee.employee_name,
    });
  } catch (error) {
    console.error(
      'DELETE /api/name-mappings/by-employee error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to delete employee mapping.',
      },
      { status: 500 }
    );
  }
}