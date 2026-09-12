import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { reconstructTable } from '@/lib/engine/reconstruct';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tableName: string }> }
) {
  try {
    const { tableName } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const asOfParam = searchParams.get('asOf');
    const asOf = asOfParam ? new Date(asOfParam) : new Date();

    if (isNaN(asOf.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid asOf timestamp' }, { status: 400 });
    }

    const { events } = await db.getEvents({ tableName, limit: 10000 });
    const reconstructed = reconstructTable(tableName, events, asOf);

    return NextResponse.json({
      success: true,
      data: reconstructed,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
