import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { groupEventsByTransaction } from '@/lib/forensic/tx-group';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ txId: string }> }
) {
  try {
    const { txId } = await context.params;
    const { events } = await db.getEvents({ transactionId: txId });

    if (events.length === 0) {
      return NextResponse.json(
        { success: false, error: `Transaction ${txId} not found in event ledger` },
        { status: 404 }
      );
    }

    const groups = groupEventsByTransaction(events);
    const txGroup = groups.get(txId);

    return NextResponse.json({
      success: true,
      data: txGroup,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
