import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { computeEventDiff } from '@/lib/engine/diff';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tableName: string; recordPk: string }> }
) {
  try {
    const { tableName, recordPk } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const fromEventId = searchParams.get('fromEventId');
    const toEventId = searchParams.get('toEventId');

    const events = await db.getRecordEvents(tableName, recordPk);
    if (events.length === 0) {
      return NextResponse.json(
        { success: false, error: `No events found for ${tableName} with PK ${recordPk}` },
        { status: 404 }
      );
    }

    let fromEvent = fromEventId ? events.find((e) => e.eventId === fromEventId) : events[0];
    let toEvent = toEventId ? events.find((e) => e.eventId === toEventId) : events[events.length - 1];

    if (!fromEvent || !toEvent) {
      return NextResponse.json(
        { success: false, error: 'Specified event IDs not found in record history' },
        { status: 404 }
      );
    }

    const diff = computeEventDiff(tableName, recordPk, fromEvent, toEvent);

    return NextResponse.json({
      success: true,
      data: diff,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
