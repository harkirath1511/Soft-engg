import { NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';

export async function GET() {
  const status = db.getConnectionStatus();
  const tables = await db.getMonitoredTables();
  const { total } = await db.getEvents({ limit: 1 });

  return NextResponse.json({
    success: true,
    data: {
      version: '1.0.0-ReplayDB',
      systemTime: new Date().toISOString(),
      database: status,
      monitoredTablesCount: tables.length,
      totalEventsInLedger: total,
    },
  });
}
