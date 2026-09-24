import { NextResponse } from 'next/server';
import { DataError } from './dataErrors';

export function apiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof DataError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 });
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    return NextResponse.json({ error: 'Employee ID, employee name, or mapping already exists.' }, { status: 409 });
  }
  // Never include a connection string, credential, or MongoDB error payload.
  console.error(fallback, error instanceof Error ? error.name : 'UnknownError');
  return NextResponse.json({ error: fallback }, { status: 500 });
}
