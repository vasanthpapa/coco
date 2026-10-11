import { NextResponse } from 'next/server';
import {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  createAdminSession,
  verifyAdminCredentials,
} from '@/src/lib/adminSession';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await request.json();

    if (!verifyAdminCredentials(body?.username, body?.password)) {
      return NextResponse.json(
        { error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, createAdminSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Login failed.' }, { status: 400 });
  }
}