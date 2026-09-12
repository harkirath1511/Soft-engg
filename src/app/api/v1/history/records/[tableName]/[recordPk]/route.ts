import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tableName: string; recordPk: string }> }
) {
  try {
    const { tableName, recordPk } = await context.params;
    const events = await db.getRecordEvents(tableName, recordPk);

    return NextResponse.json({
      success: true,
      data: {
        tableName,
        recordPk,
        totalEvents: events.length,
        events,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
