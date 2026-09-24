import { NextResponse } from 'next/server';
import { getEmployeeStore } from '@/src/lib/employeeStore';
import { apiErrorResponse } from '@/src/lib/apiErrors';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const body = await request.json();
    const employee = await (await getEmployeeStore()).updateEmployee(id, body?.empId, body?.employeeName);
    return NextResponse.json({ success: true, employee });
  } catch (error) { return apiErrorResponse(error, 'Failed to update employee.'); }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    return NextResponse.json(await (await getEmployeeStore()).deleteEmployee(id));
  } catch (error) { return apiErrorResponse(error, 'Failed to delete employee.'); }
}
