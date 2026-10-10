import { NextResponse } from 'next/server';
import { getDatabase } from '@/src/lib/database';
import { DataError } from '@/src/lib/dataErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AttendanceRecord = Record<string, unknown>;
type PreviewDocument = {
  _id: string;
  records: AttendanceRecord[];
  updatedAt: string;
};

const PREVIEW_ID = 'latest';
const COLLECTION_NAME = 'attendance_previews';
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://smartsalary-ochre.vercel.app',
];

function getCorsHeaders(request: Request) {
  const origin = request.headers.get('origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  });

  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  return headers;
}

function json(data: unknown, request: Request, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: getCorsHeaders(request),
  });
}

function errorResponse(error: unknown, fallback: string, request: Request) {
  if (error instanceof SyntaxError) {
    return json({ success: false, error: 'Invalid request.' }, request, 400);
  }

  if (error instanceof DataError) {
    return json({ success: false, error: error.message }, request, error.status);
  }

  console.error(fallback, error instanceof Error ? error.name : 'UnknownError');
  return json({ success: false, error: fallback }, request, 500);
}

function normalizeRecord(record: AttendanceRecord): AttendanceRecord {
  const empId =
    record.empId ??
    record.employeeId ??
    record.employee_id ??
    record.employeeCode ??
    '';

  return {
    ...record,
    empId: String(empId).trim(),
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!Array.isArray(body?.records)) {
      return json(
        { success: false, error: 'Records must be an array.' },
        request,
        400,
      );
    }

    if (
      !body.records.every(
        (record: unknown) =>
          record !== null &&
          typeof record === 'object' &&
          !Array.isArray(record),
      )
    ) {
      return json(
        { success: false, error: 'Every record must be an object.' },
        request,
        400,
      );
    }

    const records = (body.records as AttendanceRecord[]).map(normalizeRecord);
    const updatedAt = new Date().toISOString();
    const missingEmpIdCount = records.filter(record => !record.empId).length;
    const { database } = await getDatabase();

    await database.collection<PreviewDocument>(COLLECTION_NAME).updateOne(
      { _id: PREVIEW_ID },
      { $set: { records, updatedAt } },
      { upsert: true },
    );

    return json({
      success: true,
      count: records.length,
      missingEmpIdCount,
      updatedAt,
    }, request);
  } catch (error) {
    return errorResponse(error, 'Unable to save attendance preview.', request);
  }
}

export async function GET(request: Request) {
  try {
    const { database } = await getDatabase();
    const preview = await database
      .collection<PreviewDocument>(COLLECTION_NAME)
      .findOne({ _id: PREVIEW_ID });
    const records = preview?.records ?? [];

    return json({
      success: true,
      count: records.length,
      updatedAt: preview?.updatedAt ?? null,
      missingEmpIdCount: records.filter(record => !record.empId).length,
      records,
    }, request);
  } catch (error) {
    return errorResponse(error, 'Unable to load attendance preview.', request);
  }
}
