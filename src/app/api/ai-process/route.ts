import { NextResponse } from 'next/server';
import { processWithAI } from '@/src/utils/ai/aiProcessor';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = body?.text;

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Text is required.',
        },
        { status: 400 }
      );
    }

    const aiResult = await processWithAI(text);

    return NextResponse.json({
      success: true,
      aiResult,
      meta: {
        attendanceRows: aiResult.attendance.length,
        penaltyRows: aiResult.penalties.length,
        otherRows: aiResult.other.length,
      },
    });
  } catch (error) {
    console.error('AI process API failed:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'AI processing failed.',
      },
      { status: 500 }
    );
  }
}