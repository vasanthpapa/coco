import { NextResponse } from 'next/server';
import db from '@/src/lib/database';

interface NameMappingRow {
  id: number;
  emp_id: string;
  employee_name: string;
  aliases: string;
  created_at: string;
  updated_at: string;
}

function formatMapping(row: NameMappingRow) {
  return {
    id: row.id,
    empId: row.emp_id,
    employeeName: row.employee_name,
    aliases: JSON.parse(row.aliases || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/name-mappings
 */
export async function GET() {
  try {
    const rows = await db
      .prepare(`
        SELECT
          nm.id,
          nm.emp_id,
          e.employee_name,
          nm.aliases,
          nm.created_at,
          nm.updated_at
        FROM name_mappings nm
        INNER JOIN employees e
          ON e.emp_id = nm.emp_id
        ORDER BY
          e.employee_name COLLATE NOCASE ASC
      `)
      .all() as NameMappingRow[];

    return NextResponse.json(
      rows.map(formatMapping)
    );
  } catch (error) {
    console.error(
      'GET /api/name-mappings error:',
      error
    );

    return NextResponse.json(
      {
        error: 'Failed to load name mappings',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/name-mappings
 *
 * Body:
 * {
 *   employeeName: "Jayamala",
 *   alias: "jayamala Akka Smart"
 * }
 */
export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const employeeName = String(
      body?.employeeName || ''
    ).trim();

    const alias = String(
      body?.alias || ''
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

    if (!alias) {
      return NextResponse.json(
        {
          error: 'Alias is required.',
        },
        { status: 400 }
      );
    }

    // Find the employee using the current display name.
    const employee = await db
      .prepare(`
        SELECT
          id,
          emp_id,
          employee_name
        FROM employees
        WHERE LOWER(employee_name) = LOWER(?)
          AND active = 1
        LIMIT 1
      `)
      .get(employeeName) as
      | {
          id: number;
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

    // Find mapping using stable emp_id.
    const existing = await db
      .prepare(`
        SELECT
          id,
          emp_id,
          employee_name,
          aliases,
          created_at,
          updated_at
        FROM name_mappings
        WHERE emp_id = ?
        LIMIT 1
      `)
      .get(employee.emp_id) as
      | NameMappingRow
      | undefined;

    if (existing) {
      const aliases = JSON.parse(
        existing.aliases || '[]'
      ) as string[];

      // Case-insensitive duplicate check.
      const duplicate = aliases.some(
        item =>
          item.trim().toLowerCase() ===
          alias.toLowerCase()
      );

      if (duplicate) {
        return NextResponse.json(
          {
            error:
              `"${alias}" is already mapped.`,
          },
          { status: 409 }
        );
      }

      aliases.push(alias);

      await db.prepare(`
        UPDATE name_mappings
        SET
          employee_name = ?,
          aliases = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE emp_id = ?
      `).run(
        employee.employee_name,
        JSON.stringify(aliases),
        employee.emp_id
      );

      const updated = await db
        .prepare(`
          SELECT
            nm.id,
            nm.emp_id,
            e.employee_name,
            nm.aliases,
            nm.created_at,
            nm.updated_at
          FROM name_mappings nm
          INNER JOIN employees e
            ON e.emp_id = nm.emp_id
          WHERE nm.emp_id = ?
        `)
        .get(
          employee.emp_id
        ) as NameMappingRow;

      return NextResponse.json(
        formatMapping(updated)
      );
    }

    // Create a new mapping using emp_id.
    const result = await db
      .prepare(`
        INSERT INTO name_mappings (
          emp_id,
          employee_name,
          aliases
        )
        VALUES (?, ?, ?)
      `)
      .run(
        employee.emp_id,
        employee.employee_name,
        JSON.stringify([alias])
      );

    const created = await db
      .prepare(`
        SELECT
          nm.id,
          nm.emp_id,
          e.employee_name,
          nm.aliases,
          nm.created_at,
          nm.updated_at
        FROM name_mappings nm
        INNER JOIN employees e
          ON e.emp_id = nm.emp_id
        WHERE nm.id = ?
      `)
      .get(
        result.lastInsertRowid
      ) as NameMappingRow;

    return NextResponse.json(
      formatMapping(created),
      { status: 201 }
    );
  } catch (error) {
    console.error(
      'POST /api/name-mappings error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to save name mapping.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await db.prepare(`
      DELETE FROM name_mappings
    `).run();

    return NextResponse.json({
      success: true,
      message:
        'All employee mappings cleared successfully.',
    });
  } catch (error) {
    console.error(
      'DELETE /api/name-mappings error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to clear employee mappings.',
      },
      {
        status: 500,
      }
    );
  }
}