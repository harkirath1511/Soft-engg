import { ReplayEvent, ReconstructedState } from '../types/event';

export interface FoldOptions {
  excludedTransactions?: Set<string>;
  overrides?: Record<string, Record<string, unknown>>; // eventId -> field overrides
}

/**
 * Deterministically reconstructs the state of a single record at a target timestamp
 * by folding chronological events up to that point in time.
 */
export function foldEventsToTimestamp(
  events: ReplayEvent[],
  targetTimestamp: Date | string,
  options?: FoldOptions
): {
  state: Record<string, unknown> | null;
  exists: boolean;
  appliedCount: number;
  lastEvent: ReplayEvent | null;
  historyTrail: {
    eventId: string;
    operationType: ReplayEvent['operationType'];
    recordedAt: string;
    transactionId: string;
  }[];
} {
  const targetTime = typeof targetTimestamp === 'string' ? new Date(targetTimestamp).getTime() : targetTimestamp.getTime();
  const excludedTx = options?.excludedTransactions ?? new Set<string>();
  const overrides = options?.overrides ?? {};

  let currentState: Record<string, unknown> | null = null;
  let exists = false;
  let appliedCount = 0;
  let lastEvent: ReplayEvent | null = null;
  const historyTrail: {
    eventId: string;
    operationType: ReplayEvent['operationType'];
    recordedAt: string;
    transactionId: string;
  }[] = [];

  // Events must be sorted chronologically by recorded_at, then event_id
  const sorted = [...events].sort((a, b) => {
    const timeDiff = new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return Number(BigInt(a.eventId) - BigInt(b.eventId));
  });

  for (const event of sorted) {
    const eventTime = new Date(event.recordedAt).getTime();
    if (eventTime > targetTime) {
      break;
    }

    // Check if this transaction is excluded (counterfactual replay)
    if (excludedTx.has(event.transactionId)) {
      continue;
    }

    appliedCount++;
    lastEvent = event;
    historyTrail.push({
      eventId: event.eventId,
      operationType: event.operationType,
      recordedAt: event.recordedAt,
      transactionId: event.transactionId,
    });

    let effectiveNewState: Record<string, unknown> | null = event.newState
      ? Object.assign({}, event.newState)
      : null;
    if (effectiveNewState && overrides[event.eventId]) {
      effectiveNewState = Object.assign({}, effectiveNewState, overrides[event.eventId]);
    }

    switch (event.operationType) {
      case 'INSERT':
        currentState = effectiveNewState ? Object.assign({}, effectiveNewState) : null;
        exists = true;
        break;

      case 'UPDATE':
        if (effectiveNewState) {
          currentState = Object.assign({}, currentState ?? {}, effectiveNewState);
          exists = true;
        }
        break;

      case 'DELETE':
        currentState = null;
        exists = false;
        break;
    }
  }

  return {
    state: currentState,
    exists,
    appliedCount,
    lastEvent,
    historyTrail,
  };
}

/**
 * Reconstructs a record's state with full forensic metadata
 */
export function reconstructRecord(
  tableName: string,
  recordPk: string,
  events: ReplayEvent[],
  targetTimestamp: Date | string,
  options?: FoldOptions
): ReconstructedState {
  const asOfStr = typeof targetTimestamp === 'string' ? targetTimestamp : targetTimestamp.toISOString();
  const foldResult = foldEventsToTimestamp(events, targetTimestamp, options);

  return {
    tableName,
    recordPk,
    asOf: asOfStr,
    exists: foldResult.exists,
    state: foldResult.state,
    lastMutatedAt: foldResult.lastEvent?.recordedAt ?? null,
    appliedEventsCount: foldResult.appliedCount,
    lastTransactionId: foldResult.lastEvent?.transactionId ?? null,
    historyTrail: foldResult.historyTrail,
  };
}

/**
 * Reconstructs an entire table at timestamp T by partitioning all events by record primary key
 * and folding each record up to T.
 */
export function reconstructTable(
  tableName: string,
  events: ReplayEvent[],
  targetTimestamp: Date | string,
  options?: FoldOptions
): {
  tableName: string;
  asOf: string;
  totalRecords: number;
  records: Record<string, unknown>[];
} {
  const asOfStr = typeof targetTimestamp === 'string' ? targetTimestamp : targetTimestamp.toISOString();

  // Partition events by recordPk
  const byPk = new Map<string, ReplayEvent[]>();
  for (const ev of events) {
    if (ev.tableName !== tableName) continue;
    let list = byPk.get(ev.recordPk);
    if (!list) {
      list = [];
      byPk.set(ev.recordPk, list);
    }
    list.push(ev);
  }

  const activeRecords: Record<string, unknown>[] = [];

  for (const [pk, pkEvents] of byPk.entries()) {
    const recon = reconstructRecord(tableName, pk, pkEvents, targetTimestamp, options);
    if (recon.exists && recon.state) {
      activeRecords.push(
        Object.assign(
          {
            _pk: pk,
            _lastMutatedAt: recon.lastMutatedAt,
            _appliedEvents: recon.appliedEventsCount,
          },
          recon.state
        )
      );
    }
  }

  return {
    tableName,
    asOf: asOfStr,
    totalRecords: activeRecords.length,
    records: activeRecords,
  };
}
