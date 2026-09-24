import db from './database';

export interface AnalyzerEmployee {
  id: number;
  empId: string;
  employeeName: string;
  sortOrder: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalyzerMapping {
  id: number;
  empId: string;
  employeeName: string;
  aliases: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface EmployeeRow {
  id: number;
  emp_id: string;
  employee_name: string;
  sort_order: number;
  active: number;
  created_at: string;
  updated_at: string;
}

interface MappingRow {
  id: number;
  emp_id: string;
  employee_name: string;
  aliases: string;
  created_at: string;
  updated_at: string;
}

export function getActiveEmployees(): AnalyzerEmployee[] {
  const rows = db.prepare(`
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
  `).all() as EmployeeRow[];

  return rows.map(row => ({
    id: row.id,
    empId: row.emp_id,
    employeeName: row.employee_name,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getActiveEmployeeNames(): string[] {
  return getActiveEmployees().map(
    employee => employee.employeeName
  );
}

export function getNameMappings(): AnalyzerMapping[] {
  const rows = db.prepare(`
    SELECT
      id,
      emp_id,
      employee_name,
      aliases,
      created_at,
      updated_at
    FROM name_mappings
    ORDER BY employee_name COLLATE NOCASE ASC
  `).all() as MappingRow[];

  return rows
    .filter(row => row.emp_id)
    .map(row => {
      let aliases: string[] = [];

      try {
        const parsed = JSON.parse(
          row.aliases || '[]'
        );

        aliases = Array.isArray(parsed)
          ? parsed
              .map(String)
              .map(value => value.trim())
              .filter(Boolean)
          : [];
      } catch {
        aliases = [];
      }

      return {
        id: row.id,
        empId: row.emp_id,
        employeeName: row.employee_name,
        aliases,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
}