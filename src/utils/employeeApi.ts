export interface EmployeeRecord {
  id: number;
  empId: string;
  employeeName: string;
  sortOrder: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NameMapping {
  id: number;
  empId: string;
  employeeName: string;
  aliases: string[];
  createdAt?: string;
  updatedAt?: string;
}

export async function loadEmployeeRecords(): Promise<EmployeeRecord[]> {
  try {
    const response = await fetch('/api/employees', {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to load employees');
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(
      'Failed to load employee records:',
      error
    );

    return [];
  }
}

export async function loadEmployeeList(): Promise<string[]> {
  const employees = await loadEmployeeRecords();

  return employees.map(
    employee => employee.employeeName
  );
}

export async function loadEmployeeNameMappings(): Promise<NameMapping[]> {
  try {
    const response = await fetch('/api/name-mappings', {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(
        'Failed to load name mappings'
      );
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(
      'Failed to load employee name mappings:',
      error
    );

    return [];
  }
}

export async function addEmployee(
  empId: string,
  name: string
): Promise<boolean> {
  const cleanEmpId = String(empId || '')
    .trim()
    .toUpperCase();

  const cleanName = String(name || '').trim();

  if (!cleanEmpId || !cleanName) {
    return false;
  }

  try {
    const response = await fetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        empId: cleanEmpId,
        employeeName: cleanName,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error ||
        'Failed to add employee.'
      );
    }

    return true;
  } catch (error) {
    console.error(
      'Failed to add employee:',
      error
    );

    throw error;
  }
}
export async function deleteEmployee(
  employeeId: number
): Promise<boolean> {
  if (!employeeId) {
    return false;
  }

  try {
    const response = await fetch(
      `/api/employees/${employeeId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const result = await response.json();

      console.error(
        'Failed to delete employee:',
        result?.error
      );

      return false;
    }

    return true;
  } catch (error) {
    console.error(
      'Failed to delete employee:',
      error
    );

    return false;
  }
}

/**
 * Update both employee ID and employee name.
 */
export async function updateEmployee(
  employeeId: number,
  empId: string,
  employeeName: string
): Promise<EmployeeRecord | null> {
  const cleanEmpId = String(empId || '')
    .trim()
    .toUpperCase();

  const cleanEmployeeName = String(
    employeeName || ''
  ).trim();

  if (
    !employeeId ||
    !cleanEmpId ||
    !cleanEmployeeName
  ) {
    return null;
  }

  try {
    const response = await fetch(
      `/api/employees/${employeeId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          empId: cleanEmpId,
          employeeName: cleanEmployeeName,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error ||
        'Failed to update employee.'
      );
    }

    return result?.employee ?? null;
  } catch (error) {
    console.error(
      'Failed to update employee:',
      error
    );

    throw error;
  }
}

/**
 * Compatibility helper for name-only rename.
 */
export async function renameEmployee(
  oldName: string,
  newName: string
): Promise<boolean> {
  const cleanOldName = String(oldName || '').trim();
  const cleanNewName = String(newName || '').trim();

  if (!cleanOldName || !cleanNewName) {
    return false;
  }

  const employees = await loadEmployeeRecords();

  const employee = employees.find(
    item =>
      item.employeeName.trim().toLowerCase() ===
      cleanOldName.toLowerCase()
  );

  if (!employee) {
    return false;
  }

  try {
    await updateEmployee(
      employee.id,
      employee.empId,
      cleanNewName
    );

    return true;
  } catch (error) {
    console.error(
      'Failed to rename employee:',
      error
    );

    return false;
  }
}

export async function moveEmployee(
  name: string,
  direction: 'up' | 'down'
): Promise<boolean> {
  const cleanName = String(name || '').trim();

  if (!cleanName) {
    return false;
  }

  const employees = await loadEmployeeRecords();

  const index = employees.findIndex(
    employee =>
      employee.employeeName.trim().toLowerCase() ===
      cleanName.toLowerCase()
  );

  if (index === -1) {
    return false;
  }

  const newIndex =
    direction === 'up'
      ? index - 1
      : index + 1;

  if (
    newIndex < 0 ||
    newIndex >= employees.length
  ) {
    return false;
  }

  const ordered = [...employees];

  const temp = ordered[index];
  ordered[index] = ordered[newIndex];
  ordered[newIndex] = temp;

  try {
    const response = await fetch(
      '/api/employees/reorder',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeIds: ordered.map(
            employee => employee.id
          ),
        }),
      }
    );

    if (!response.ok) {
      const result = await response.json();

      console.error(
        'Failed to reorder employees:',
        result?.error
      );

      return false;
    }

    return true;
  } catch (error) {
    console.error(
      'Failed to reorder employees:',
      error
    );

    return false;
  }
}

export async function saveEmployeeNameMapping(
  savedName: string,
  officialName: string
): Promise<void> {
  const response = await fetch(
    '/api/name-mappings',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeName: officialName.trim(),
        alias: savedName.trim(),
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error ||
      'Failed to save mapping.'
    );
  }
}

export async function removeEmployeeNameMapping(
  mappingId: number,
  savedName: string
): Promise<void> {
  const response = await fetch(
    `/api/name-mappings/${mappingId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        alias: savedName.trim(),
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error ||
      'Failed to remove mapping.'
    );
  }
}

export async function deleteEmployeeNameMapping(
  employeeName: string
): Promise<void> {
  const response = await fetch(
    '/api/name-mappings/by-employee',
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeName: employeeName.trim(),
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error ||
      'Failed to delete employee mapping.'
    );
  }
}

export async function clearEmployeeNameMappings(): Promise<void> {
  const response = await fetch(
    '/api/name-mappings',
    {
      method: 'DELETE',
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error ||
      'Failed to clear employee mappings.'
    );
  }
}

export async function updateEmployeeNameMapping(
  mappingId: number,
  employeeName: string,
  aliases: string[]
): Promise<void> {
  const response = await fetch(
    `/api/name-mappings/${mappingId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeName: employeeName.trim(),
        aliases,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error ||
      'Failed to update mapping.'
    );
  }
}
