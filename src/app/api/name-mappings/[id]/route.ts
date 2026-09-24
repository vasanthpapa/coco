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

function formatMapping(
  row: NameMappingRow
) {
  return {
    id: row.id,
    empId: row.emp_id,
    employeeName: row.employee_name,
    aliases: JSON.parse(
      row.aliases || '[]'
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * PUT
 *
 * Update aliases for an employee mapping.
 */
export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await params;

    const mappingId = Number(id);

    if (!Number.isInteger(mappingId)) {
      return NextResponse.json(
        {
          error: 'Invalid mapping id.',
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const aliases =
      Array.isArray(body?.aliases)
        ? body.aliases
            .map((item: unknown) =>
              String(item).trim()
            )
            .filter(Boolean)
        : [];

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

    // Check duplicate aliases case-insensitively.
    const duplicate = aliases.some(
      (
        alias: string,
        index: number
      ) =>
        aliases.findIndex(
          item =>
            item.toLowerCase() ===
            alias.toLowerCase()
        ) !== index
    );

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            'Duplicate aliases are not allowed.',
        },
        { status: 409 }
      );
    }

    // Find the employee using the current name.
    const employee = db
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

    // Find existing mapping.
    const existing = db
      .prepare(`
        SELECT
          id,
          emp_id,
          employee_name,
          aliases,
          created_at,
          updated_at
        FROM name_mappings
        WHERE id = ?
      `)
      .get(mappingId) as
      | NameMappingRow
      | undefined;

    if (!existing) {
      return NextResponse.json(
        {
          error: 'Mapping not found.',
        },
        { status: 404 }
      );
    }

    // Prevent assigning another employee's empId
    // to this mapping if that employee already has a mapping.
    const anotherMapping = db
      .prepare(`
        SELECT id
        FROM name_mappings
        WHERE emp_id = ?
          AND id != ?
        LIMIT 1
      `)
      .get(
        employee.emp_id,
        mappingId
      ) as
      | { id: number }
      | undefined;

    if (anotherMapping) {
      return NextResponse.json(
        {
          error:
            `"${employeeName}" already has a mapping.`,
        },
        { status: 409 }
      );
    }

    db.prepare(`
      UPDATE name_mappings
      SET
        emp_id = ?,
        employee_name = ?,
        aliases = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      employee.emp_id,
      employee.employee_name,
      JSON.stringify(aliases),
      mappingId
    );

    const updated = db
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
      .get(mappingId) as NameMappingRow;

    return NextResponse.json(
      formatMapping(updated)
    );
  } catch (error) {
    console.error(
      'PUT /api/name-mappings/[id] error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to update name mapping.',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE
 *
 * Body:
 * {
 *   alias: "jayamala Akka Smart"
 * }
 */
export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await params;

    const mappingId = Number(id);

    if (!Number.isInteger(mappingId)) {
      return NextResponse.json(
        {
          error:
            'Invalid mapping id.',
        },
        { status: 400 }
      );
    }

    let body: {
      alias?: string;
    } = {};

    try {
      const text = await request.text();

      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      body = {};
    }

    const aliasToRemove = String(
      body?.alias || ''
    ).trim();

    if (!aliasToRemove) {
      return NextResponse.json(
        {
          error: 'Alias is required.',
        },
        { status: 400 }
      );
    }

    const existing = db
      .prepare(`
        SELECT
          id,
          emp_id,
          employee_name,
          aliases,
          created_at,
          updated_at
        FROM name_mappings
        WHERE id = ?
      `)
      .get(mappingId) as
      | NameMappingRow
      | undefined;

    if (!existing) {
      return NextResponse.json(
        {
          error: 'Mapping not found.',
        },
        { status: 404 }
      );
    }

    const aliases = JSON.parse(
      existing.aliases || '[]'
    ) as string[];

    const updatedAliases =
      aliases.filter(
        alias =>
          alias.trim().toLowerCase() !==
          aliasToRemove.toLowerCase()
      );

    if (updatedAliases.length === aliases.length) {
      return NextResponse.json(
        {
          error:
            `"${aliasToRemove}" is not mapped.`,
        },
        { status: 404 }
      );
    }

    db.prepare(`
      UPDATE name_mappings
      SET
        aliases = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      JSON.stringify(updatedAliases),
      mappingId
    );

    return NextResponse.json({
      success: true,
      id: mappingId,
      empId: existing.emp_id,
      employeeName:
        existing.employee_name,
      aliases: updatedAliases,
    });
  } catch (error) {
    console.error(
      'DELETE /api/name-mappings/[id] error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to delete name mapping.',
      },
      { status: 500 }
    );
  }
}