import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { reconstructRecord } from '@/lib/engine/reconstruct';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tableName: string; recordPk: string }> }
) {
  try {
    const { tableName, recordPk } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const asOfParam = searchParams.get('asOf');
    const asOf = asOfParam ? new Date(asOfParam) : new Date();

    if (isNaN(asOf.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid asOf timestamp' }, { status: 400 });
    }

    const events = await db.getRecordEvents(tableName, recordPk);
    if (events.length === 0) {
      return NextResponse.json(
        { success: false, error: `Record ${tableName} (${recordPk}) has no recorded history` },
        { status: 404 }
      );
    }

    const reconstruction = reconstructRecord(tableName, recordPk, events, asOf);

    return NextResponse.json({
      success: true,
      data: reconstruction,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
