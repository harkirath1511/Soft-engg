import { ReplayEvent, TransactionGroup } from '../types/event';

/**
 * Groups an array of raw events into structured TransactionGroups by transactionId.
 */
export function groupEventsByTransaction(events: ReplayEvent[]): Map<string, TransactionGroup> {
  const txMap = new Map<string, TransactionGroup>();

  for (const event of events) {
    let group = txMap.get(event.transactionId);
    if (!group) {
      group = {
        transactionId: event.transactionId,
        timestamp: event.recordedAt,
        totalOperations: 0,
        tablesMutated: [],
        events: [],
        clientQuery: event.clientQuery,
        dbUser: event.dbUser,
      };
      txMap.set(event.transactionId, group);
    }

    group.totalOperations++;
    group.events.push(event);
    if (!group.tablesMutated.includes(event.tableName)) {
      group.tablesMutated.push(event.tableName);
    }
  }

  return txMap;
}

/**
 * Finds all transactions that occurred within a temporal window (± windowMs) of a target transaction.
 * Useful for uncovering concurrent transactions and race conditions.
 */
export function findTemporalCorrelations(
  allEvents: ReplayEvent[],
  targetTxId: string,
  windowMs: number = 1000
): {
  targetTransaction: TransactionGroup | null;
  correlatedTransactions: TransactionGroup[];
  windowStart: string;
  windowEnd: string;
} {
  const txMap = groupEventsByTransaction(allEvents);
  const targetTx = txMap.get(targetTxId) ?? null;

  if (!targetTx) {
    return {
      targetTransaction: null,
      correlatedTransactions: [],
      windowStart: new Date().toISOString(),
      windowEnd: new Date().toISOString(),
    };
  }

  const targetTime = new Date(targetTx.timestamp).getTime();
  const startTime = targetTime - windowMs;
  const endTime = targetTime + windowMs;

  const correlated: TransactionGroup[] = [];
  for (const group of txMap.values()) {
    const txTime = new Date(group.timestamp).getTime();
    if (txTime >= startTime && txTime <= endTime && group.transactionId !== targetTxId) {
      correlated.push(group);
    }
  }

  // Sort by timestamp
  correlated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    targetTransaction: targetTx,
    correlatedTransactions: correlated,
    windowStart: new Date(startTime).toISOString(),
    windowEnd: new Date(endTime).toISOString(),
  };
}
