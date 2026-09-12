import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { findTemporalCorrelations } from '@/lib/forensic/tx-group';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nearTxId = searchParams.get('nearTxId');
    const windowMs = parseInt(searchParams.get('windowMs') || '1000', 10);

    if (!nearTxId) {
      return NextResponse.json({ success: false, error: 'Query parameter nearTxId is required' }, { status: 400 });
    }

    const { events } = await db.getEvents({ limit: 10000 });
    const correlations = findTemporalCorrelations(events, nearTxId, windowMs);

    if (!correlations.targetTransaction) {
      return NextResponse.json(
        { success: false, error: `Transaction ${nearTxId} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: correlations,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
