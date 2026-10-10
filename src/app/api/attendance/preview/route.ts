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
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://smartsalary-ochre.vercel.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof SyntaxError) {
    return json({ success: false, error: 'Invalid request.' }, 400);
  }

  if (error instanceof DataError) {
    return json({ success: false, error: error.message }, error.status);
  }

  console.error(fallback, error instanceof Error ? error.name : 'UnknownError');
  return json({ success: false, error: fallback }, 500);
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

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!Array.isArray(body?.records)) {
      return json(
        { success: false, error: 'Records must be an array.' },
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
    });
  } catch (error) {
    return errorResponse(error, 'Unable to save attendance preview.');
  }
}

export async function GET() {
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
    });
  } catch (error) {
    return errorResponse(error, 'Unable to load attendance preview.');
  }
}
