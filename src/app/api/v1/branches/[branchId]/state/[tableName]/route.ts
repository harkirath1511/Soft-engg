import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { defaultBranchEngine } from '@/lib/engine/branch';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ branchId: string; tableName: string }> }
) {
  try {
    const { branchId, tableName } = await context.params;
    const branch = defaultBranchEngine.getBranch(branchId);

    if (!branch) {
      return NextResponse.json({ success: false, error: `Branch ${branchId} not found` }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const recordPk = searchParams.get('recordPk');
    const asOf = searchParams.get('asOf') || new Date().toISOString();

    if (recordPk) {
      // Compare specific record
      const events = await db.getRecordEvents(tableName, recordPk);
      const comparison = defaultBranchEngine.compareRecord(branch, tableName, recordPk, events, asOf);
      return NextResponse.json({
        success: true,
        branch,
        data: comparison,
      });
    }

    // Full table reconstruction
    const { events } = await db.getEvents({ tableName, limit: 10000 });
    const branchedTable = defaultBranchEngine.replayBranchTable(branch, tableName, events, asOf);

    return NextResponse.json({
      success: true,
      branch,
      data: branchedTable,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
