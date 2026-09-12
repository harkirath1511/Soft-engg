import { describe, it, expect } from 'vitest';
import { foldEventsToTimestamp, reconstructRecord, reconstructTable } from '../../src/lib/engine/reconstruct';
import { computeStateDiff } from '../../src/lib/engine/diff';
import { BranchEngine } from '../../src/lib/engine/branch';
import { groupEventsByTransaction, findTemporalCorrelations } from '../../src/lib/forensic/tx-group';
import { ReplayEvent } from '../../src/lib/types/event';

describe('Deterministic Reconstruction Engine', () => {
  const sampleEvents: ReplayEvent[] = [
    {
      eventId: '1',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'INSERT',
      oldState: null,
      newState: { id: 1, name: 'Alice', balance: 100 },
      diffState: { id: 1, name: 'Alice', balance: 100 },
      transactionId: '10',
      recordedAt: '2026-09-07T10:00:00.000Z',
      dbUser: 'admin',
    },
    {
      eventId: '2',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'UPDATE',
      oldState: { id: 1, name: 'Alice', balance: 100 },
      newState: { id: 1, name: 'Alice', balance: 250 },
      diffState: { balance: 250 },
      transactionId: '12',
      recordedAt: '2026-09-07T10:15:00.000Z',
      dbUser: 'admin',
    },
    {
      eventId: '3',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'UPDATE',
      oldState: { id: 1, name: 'Alice', balance: 250 },
      newState: { id: 1, name: 'Alice', balance: -500 },
      diffState: { balance: -500 },
      transactionId: '15', // Buggy transaction
      recordedAt: '2026-09-07T10:30:00.000Z',
      dbUser: 'cron',
    },
  ];

  it('reconstructs state accurately prior to initial creation', () => {
    const res = reconstructRecord('users', '1', sampleEvents, '2026-09-07T09:59:00.000Z');
    expect(res.exists).toBe(false);
    expect(res.state).toBeNull();
    expect(res.appliedEventsCount).toBe(0);
  });

  it('reconstructs state at intermediate point in time (10:20:00)', () => {
    const res = reconstructRecord('users', '1', sampleEvents, '2026-09-07T10:20:00.000Z');
    expect(res.exists).toBe(true);
    expect(res.state).toEqual({ id: 1, name: 'Alice', balance: 250 });
    expect(res.appliedEventsCount).toBe(2);
    expect(res.lastTransactionId).toBe('12');
  });

  it('reconstructs latest state including transaction 15', () => {
    const res = reconstructRecord('users', '1', sampleEvents, '2026-09-07T10:45:00.000Z');
    expect(res.exists).toBe(true);
    expect(res.state?.balance).toBe(-500);
    expect(res.appliedEventsCount).toBe(3);
  });

  it('handles record deletion gracefully', () => {
    const eventsWithDelete: ReplayEvent[] = [
      ...sampleEvents,
      {
        eventId: '4',
        tableSchema: 'public',
        tableName: 'users',
        recordPk: '1',
        operationType: 'DELETE',
        oldState: { id: 1, name: 'Alice', balance: -500 },
        newState: null,
        diffState: null,
        transactionId: '20',
        recordedAt: '2026-09-07T11:00:00.000Z',
        dbUser: 'admin',
      },
    ];

    const prior = reconstructRecord('users', '1', eventsWithDelete, '2026-09-07T10:45:00.000Z');
    expect(prior.exists).toBe(true);

    const postDelete = reconstructRecord('users', '1', eventsWithDelete, '2026-09-07T11:05:00.000Z');
    expect(postDelete.exists).toBe(false);
    expect(postDelete.state).toBeNull();
  });
});

describe('Field-Level Diff Engine', () => {
  it('correctly calculates added, modified, and deleted properties', () => {
    const oldState = { id: 1, name: 'Alice', balance: 100, role: 'USER' };
    const newState = { id: 1, name: 'Alice', balance: 350, email: 'alice@test.com' };

    const diffs = computeStateDiff(oldState, newState);

    const balanceDiff = diffs.find((d) => d.field === 'balance');
    expect(balanceDiff?.status).toBe('modified');
    expect(balanceDiff?.oldValue).toBe(100);
    expect(balanceDiff?.newValue).toBe(350);

    const emailDiff = diffs.find((d) => d.field === 'email');
    expect(emailDiff?.status).toBe('added');
    expect(emailDiff?.newValue).toBe('alice@test.com');

    const roleDiff = diffs.find((d) => d.field === 'role');
    expect(roleDiff?.status).toBe('deleted');
    expect(roleDiff?.oldValue).toBe('USER');

    const nameDiff = diffs.find((d) => d.field === 'name');
    expect(nameDiff?.status).toBe('unchanged');
  });
});

describe('Counterfactual Branching Engine', () => {
  const events: ReplayEvent[] = [
    {
      eventId: '1',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'INSERT',
      oldState: null,
      newState: { id: 1, balance: 1000 },
      diffState: null,
      transactionId: '101',
      recordedAt: '2026-09-07T10:00:00.000Z',
      dbUser: 'app',
    },
    {
      eventId: '2',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'UPDATE',
      oldState: { id: 1, balance: 1000 },
      newState: { id: 1, balance: -5000 }, // Corrupted
      diffState: null,
      transactionId: '102', // Rogue transaction to exclude
      recordedAt: '2026-09-07T10:30:00.000Z',
      dbUser: 'batch',
    },
    {
      eventId: '3',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'UPDATE',
      oldState: { id: 1, balance: -5000 },
      newState: { id: 1, balance: -5050 }, // Subsequent order $50
      diffState: null,
      transactionId: '103',
      recordedAt: '2026-09-07T10:45:00.000Z',
      dbUser: 'app',
    },
  ];

  it('materializes hypothetical state when excluding rogue transaction 102', () => {
    const branchEngine = new BranchEngine();
    const branch = branchEngine.createBranch({
      branchName: 'skip-tx-102',
      baseTimestamp: '2026-09-07T10:00:00.000Z',
      excludedTransactions: ['102'],
    });

    const comparison = branchEngine.compareRecord(branch, 'users', '1', events, '2026-09-07T10:35:00.000Z');

    expect(comparison.diverged).toBe(true);
    expect(comparison.actualState?.balance).toBe(-5000);
    expect(comparison.branchedState?.balance).toBe(1000); // 102 was omitted!
  });
});

describe('Transaction Forensics & Blast-Radius', () => {
  const events: ReplayEvent[] = [
    {
      eventId: '1',
      tableSchema: 'public',
      tableName: 'orders',
      recordPk: '100',
      operationType: 'INSERT',
      oldState: null,
      newState: { id: 100, amount: 200 },
      diffState: null,
      transactionId: '55',
      recordedAt: '2026-09-07T10:00:00.000Z',
      dbUser: 'app',
    },
    {
      eventId: '2',
      tableSchema: 'public',
      tableName: 'inventory',
      recordPk: 'SKU-1',
      operationType: 'UPDATE',
      oldState: { sku: 'SKU-1', stock: 10 },
      newState: { sku: 'SKU-1', stock: 9 },
      diffState: null,
      transactionId: '55', // Cross-table in same tx
      recordedAt: '2026-09-07T10:00:00.010Z',
      dbUser: 'app',
    },
  ];

  it('clusters multi-table mutations by transaction ID', () => {
    const groups = groupEventsByTransaction(events);
    const tx55 = groups.get('55');
    expect(tx55).toBeDefined();
    expect(tx55?.totalOperations).toBe(2);
    expect(tx55?.tablesMutated).toContain('orders');
    expect(tx55?.tablesMutated).toContain('inventory');
  });
});
