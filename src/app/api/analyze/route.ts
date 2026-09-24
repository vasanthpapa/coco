import { NextResponse } from 'next/server';

import { parseWhatsAppChat } from '@/src/utils/whatsappParser';
import { parseCSV } from '@/src/utils/csvParser';
import { parseJSON } from '@/src/utils/jsonParser';
import { parseWithAI } from '@/src/utils/aiParser';

import { parseAttendance } from '@/src/utils/attendanceParser';
import { parsePenalty } from '@/src/utils/penaltyParser';

import {
  getActiveEmployeeNames,
  getNameMappings,
} from '@/src/lib/analyzerData';

export const runtime = 'nodejs';

type AnalyzeType =
  | 'auto'
  | 'csv'
  | 'json'
  | 'whatsapp'
  | 'ai';

interface AnalyzeRequest {
  text?: string;
  type?: AnalyzeType;
  targetDate?: string;
}

interface AnalyzeResponse {
  success: boolean;
  type: Exclude<AnalyzeType, 'auto'>;
  data: Record<string, any>[];
  attendanceData: ReturnType<typeof parseAttendance>;
  penaltyData: ReturnType<typeof parsePenalty>;
  meta: {
    rows: number;
    attendanceRows: number;
    penaltyRows: number;
  };
}

function detectType(
  text: string
): Exclude<AnalyzeType, 'auto'> {
  const cleanText = text
    .trim()
    .replace(
      /[\u200E\u200F\u202A-\u202E\u2066\u2067]/g,
      ''
    );

  if (!cleanText) {
    return 'whatsapp';
  }

  if (
    cleanText.startsWith('[') ||
    cleanText.startsWith('{')
  ) {
    return 'json';
  }

  const whatsappRegex =
    /^\[?\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[aApP][mM])?/m;

  if (whatsappRegex.test(cleanText)) {
    return 'whatsapp';
  }

  if (cleanText.includes(',')) {
    return 'csv';
  }

  return 'whatsapp';
}

function isValidType(
  type: string
): type is AnalyzeType {
  return [
    'auto',
    'csv',
    'json',
    'whatsapp',
    'ai',
  ].includes(type);
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as AnalyzeRequest;

    const text = String(
      body?.text ?? ''
    );

    if (!text.trim()) {
      return NextResponse.json(
        {
          error: 'Input data is empty.',
        },
        { status: 400 }
      );
    }

    let type: AnalyzeType =
      body?.type ?? 'auto';

    if (!isValidType(type)) {
      return NextResponse.json(
        {
          error: 'Invalid analysis type.',
        },
        { status: 400 }
      );
    }

    if (type === 'auto') {
      type = detectType(text);
    }

    /*
     * --------------------------------------------------
     * CURRENT EMPLOYEE CONFIGURATION
     * --------------------------------------------------
     */

    const employeeNames =
      await getActiveEmployeeNames();

    const mappings =
      await getNameMappings();

    let data: Record<string, any>[] = [];

    let attendanceData: ReturnType<
      typeof parseAttendance
    > = [];

    let penaltyData: ReturnType<
      typeof parsePenalty
    > = [];

    /*
     * --------------------------------------------------
     * WHATSAPP - EXISTING MANUAL ANALYSIS
     * --------------------------------------------------
     */

    if (type === 'whatsapp') {
      const messages =
        parseWhatsAppChat(text);

      data = messages;

      attendanceData =
        parseAttendance(
          messages,
          body.targetDate,
          employeeNames,
          mappings
        );

      penaltyData =
        parsePenalty(
          messages,
          body.targetDate,
          employeeNames,
          mappings
        );
    }

    /*
     * --------------------------------------------------
     * CSV - EXISTING
     * --------------------------------------------------
     */

    else if (type === 'csv') {
      data = parseCSV(text);
    }

    /*
     * --------------------------------------------------
     * JSON - EXISTING
     * --------------------------------------------------
     */

    else if (type === 'json') {
      data = parseJSON(text);
    }

    /*
     * --------------------------------------------------
     * AI - ADDITIONAL PARSER
     * --------------------------------------------------
     */

    else if (type === 'ai') {
      data = await parseWithAI(text);

      /*
       * AI returns attendance records directly.
       * Convert them into the same structure expected
       * by the frontend.
       */

      attendanceData = data.map(
        (record: Record<string, any>) => ({
          name:
            String(
              record.name ?? '-'
            ),
          checkIn:
            String(
              record.checkIn ?? '-'
            ),
          checkOut:
            String(
              record.checkOut ?? '-'
            ),
          checkIns:
            record.checkIn &&
            record.checkIn !== '-'
              ? [String(record.checkIn)]
              : [],
          checkOuts:
            record.checkOut &&
            record.checkOut !== '-'
              ? [String(record.checkOut)]
              : [],
          halfDay:
            String(
              record.halfDay ?? '-'
            ),
          permission:
            String(
              record.permission ?? '-'
            ),
          weekOff: '-',
          date:
            String(
              record.date ?? ''
            ),
        })
      );
    }

    /*
     * --------------------------------------------------
     * SAFETY CHECK
     * --------------------------------------------------
     */

    if (data.length === 0) {
      return NextResponse.json(
        {
          error:
            'No valid data could be parsed. Check your input format.',
        },
        { status: 422 }
      );
    }

    /*
     * --------------------------------------------------
     * RESPONSE
     * --------------------------------------------------
     */

    const response: AnalyzeResponse = {
      success: true,
      type,
      data,
      attendanceData,
      penaltyData,
      meta: {
        rows: data.length,
        attendanceRows:
          attendanceData.length,
        penaltyRows:
          penaltyData.length,
      },
    };

    return NextResponse.json(
      response,
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'POST /api/analyze error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to analyze data.',
      },
      { status: 500 }
    );
  }
}
