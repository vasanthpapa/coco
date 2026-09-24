import { NextResponse } from 'next/server';
import { getEmployeeStore } from '@/src/lib/employeeStore';
import { apiErrorResponse } from '@/src/lib/apiErrors';

export const runtime = 'nodejs';

export async function GET() {
  try { return NextResponse.json(await (await getEmployeeStore()).listMappings()); }
  catch (error) { return apiErrorResponse(error, 'Failed to load name mappings.'); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await (await getEmployeeStore()).addAlias(body?.employeeName, body?.alias);
    return NextResponse.json(result.mapping, { status: result.created ? 201 : 200 });
  } catch (error) { return apiErrorResponse(error, 'Failed to save name mapping.'); }
}

export async function DELETE() {
  try { return NextResponse.json(await (await getEmployeeStore()).clearMappings()); }
  catch (error) { return apiErrorResponse(error, 'Failed to clear employee mappings.'); }
}
