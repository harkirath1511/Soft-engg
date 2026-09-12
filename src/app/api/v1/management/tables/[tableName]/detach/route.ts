import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ tableName: string }> }
) {
  try {
    const { tableName } = await context.params;
    await db.detachTable(tableName);
    return NextResponse.json({
      success: true,
      message: `Trigger trg_replaydb_${tableName} detached. Table is no longer monitored.`,
      table: tableName,
      monitored: false,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
