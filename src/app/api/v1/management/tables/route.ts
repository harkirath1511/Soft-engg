import { NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';

export async function GET() {
  try {
    const tables = await db.getMonitoredTables();
    return NextResponse.json({
      success: true,
      data: tables,
      total: tables.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
