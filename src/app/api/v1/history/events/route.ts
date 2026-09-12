import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tableName = searchParams.get('table') || undefined;
    const recordPk = searchParams.get('recordPk') || undefined;
    const transactionId = searchParams.get('txId') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { events, total } = await db.getEvents({
      tableName,
      recordPk,
      transactionId,
      from,
      to,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: events,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + events.length < total,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
