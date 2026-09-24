import { NextResponse } from 'next/server';
import { getEmployeeStore } from '@/src/lib/employeeStore';
import { apiErrorResponse } from '@/src/lib/apiErrors';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json(await (await getEmployeeStore()).updateMapping(id, body?.employeeName, body?.aliases));
  } catch (error) { return apiErrorResponse(error, 'Failed to update name mapping.'); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const text = await request.text();
    const body = text.trim() ? JSON.parse(text) : {};
    return NextResponse.json(await (await getEmployeeStore()).removeAlias(id, body?.alias));
  } catch (error) { return apiErrorResponse(error, 'Failed to delete name mapping.'); }
}
