import { NextResponse } from 'next/server';
import { getEmployeeStore } from '@/src/lib/employeeStore';
import { apiErrorResponse } from '@/src/lib/apiErrors';

export const runtime = 'nodejs';

export async function GET() {
  try { return NextResponse.json(await (await getEmployeeStore()).listEmployees()); }
  catch (error) { return apiErrorResponse(error, 'Failed to load employees.'); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const employee = await (await getEmployeeStore()).createEmployee(body?.empId, body?.employeeName);
    return NextResponse.json(employee, { status: 201 });
  } catch (error) { return apiErrorResponse(error, 'Failed to create employee.'); }
}
