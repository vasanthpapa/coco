import { NextResponse } from 'next/server';
import { getEmployeeStore } from '@/src/lib/employeeStore';
import { apiErrorResponse } from '@/src/lib/apiErrors';

export const runtime = 'nodejs';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await (await getEmployeeStore()).reorderEmployees(body?.employeeIds));
  } catch (error) { return apiErrorResponse(error, 'Failed to reorder employees.'); }
}
