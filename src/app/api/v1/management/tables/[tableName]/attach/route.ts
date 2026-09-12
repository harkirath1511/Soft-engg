import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tableName: string }> }
) {
  try {
    const { tableName } = await context.params;
    await db.attachTable(tableName);
    return NextResponse.json({
      success: true,
      message: `Trigger trg_replaydb_${tableName} successfully attached. Table is now monitored.`,
      table: tableName,
      monitored: true,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
