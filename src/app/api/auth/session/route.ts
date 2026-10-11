
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifyAdminSession } from '@/src/lib/adminSession';

export const runtime = 'nodejs';

export function GET(request: NextRequest) {
  const authenticated = verifyAdminSession(
    request.cookies.get(COOKIE_NAME)?.value
  );

  return NextResponse.json(
    { authenticated },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
