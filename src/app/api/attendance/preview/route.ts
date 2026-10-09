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

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

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
      return NextResponse.json(
        { success: false, error: 'Records must be an array.' },
        { status: 400, headers: corsHeaders },
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
        { status: 400, headers: corsHeaders },
      );
    }

    const records = (body.records as AttendanceRecord[]).map(normalizeRecord);
    const missingEmpIdCount = records.filter(
      record => !record.empId,
    ).length;

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
      { headers: corsHeaders },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request.' },
      { status: 400, headers: corsHeaders },
    );
  }
}

export async function GET() {
  const preview = globalForPreview.cocoAttendancePreview;

  if (!preview) {
    return NextResponse.json(
      {
        success: false,
        error: 'No attendance preview available. Send records from COCO first.',
      },
      { status: 404, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    {
      success: true,
      count: preview.records.length,
      updatedAt: preview.updatedAt,
      missingEmpIdCount: preview.records.filter(
        record => !record.empId,
      ).length,
      records: preview.records,
    },
    { headers: corsHeaders },
  );
}