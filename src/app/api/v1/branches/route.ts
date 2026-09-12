import { NextRequest, NextResponse } from 'next/server';
import { defaultBranchEngine } from '@/lib/engine/branch';

export async function GET() {
  const branches = defaultBranchEngine.listBranches();
  return NextResponse.json({
    success: true,
    data: branches,
    total: branches.length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchName, baseTimestamp, excludedTransactions, overrides, metadata } = body;

    if (!branchName) {
      return NextResponse.json({ success: false, error: 'branchName is required' }, { status: 400 });
    }

    const branch = defaultBranchEngine.createBranch({
      branchName,
      baseTimestamp: baseTimestamp || new Date().toISOString(),
      excludedTransactions: Array.isArray(excludedTransactions) ? excludedTransactions.map(String) : [],
      overrides: overrides || {},
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      message: `Branch "${branchName}" created. Transactions [${branch.excludedTransactions.join(', ')}] excluded.`,
      data: branch,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
