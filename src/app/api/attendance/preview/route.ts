import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AttendanceRecord = Record<string, unknown>;

type PreviewData = {
  records: AttendanceRecord[];
  updatedAt: string;
};

const globalForPreview = globalThis as typeof globalThis & {
  cocoAttendancePreview?: PreviewData;
};

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
  const headers = getCorsHeaders(request);

  try {
    const body = await request.json();

    if (!Array.isArray(body?.records)) {
      return NextResponse.json(
        { success: false, error: 'Records must be an array.' },
        { status: 400, headers },
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
      return NextResponse.json(
        { success: false, error: 'Every record must be an object.' },
        { status: 400, headers },
      );
    }

    const records = (body.records as AttendanceRecord[]).map(normalizeRecord);
    const missingEmpIdCount = records.filter(record => !record.empId).length;

    globalForPreview.cocoAttendancePreview = {
      records,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        count: records.length,
        missingEmpIdCount,
        updatedAt: globalForPreview.cocoAttendancePreview.updatedAt,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request.' },
      { status: 400, headers },
    );
  }
}

export async function GET(request: Request) {
  const headers = getCorsHeaders(request);
  const preview = globalForPreview.cocoAttendancePreview;

  if (!preview) {
    return NextResponse.json(
      {
        success: false,
        error: 'No attendance preview available. Send records from COCO first.',
      },
      { status: 404, headers },
    );
  }

  return NextResponse.json(
    {
      success: true,
      count: preview.records.length,
      updatedAt: preview.updatedAt,
      missingEmpIdCount: preview.records.filter(record => !record.empId).length,
      records: preview.records,
    },
    { headers },
  );
}