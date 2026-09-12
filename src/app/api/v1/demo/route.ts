import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    if (action === 'seed') {
      db.seedInitialDemoData();
      return NextResponse.json({
        success: true,
        message: 'Demo baseline data seeded: Alice account active, deposits $500 -> $750 -> $1000, Order #1 created.',
      });
    }

    if (action === 'inject_bug') {
      const result = db.injectBugScenario();
      return NextResponse.json({
        success: true,
        message: 'Silent bug injected! Rogue Tx 402 set Alice balance to -$5,000.00 and marked account FRAUD & FROZEN.',
        data: result,
      });
    }

    if (action === 'custom_mutation') {
      const { tableName, recordPk, operationType, newState, oldState, query } = payload || {};
      if (!tableName || !recordPk || !operationType) {
        return NextResponse.json({ success: false, error: 'tableName, recordPk, operationType are required' }, { status: 400 });
      }

      const txId = (Math.floor(Math.random() * 800) + 200).toString();
      const event = await db.insertEvent({
        tableSchema: 'public',
        tableName,
        recordPk: String(recordPk),
        operationType,
        oldState: oldState || null,
        newState: newState || null,
        diffState: newState || null,
        transactionId: txId,
        recordedAt: new Date().toISOString(),
        dbUser: 'live_user_client',
        clientQuery: query || `${operationType} ON ${tableName} (PK=${recordPk})`,
      });

      return NextResponse.json({
        success: true,
        message: `Mutation captured successfully in transaction ${txId}.`,
        data: event,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
