import { ReplayEvent } from '../types/event';
import { reconstructTable } from './reconstruct';

export interface SnapshotRecord {
  snapshotId: string;
  tableName: string;
  snapshotTime: string;
  lastEventId: string;
  tableStateDump: Record<string, unknown>[];
  createdAt: string;
}

/**
 * Creates a compacted table snapshot checkpoint from event history.
 */
export function createTableSnapshot(
  tableName: string,
  events: ReplayEvent[],
  snapshotTime: Date | string
): SnapshotRecord {
  const timeStr = typeof snapshotTime === 'string' ? snapshotTime : snapshotTime.toISOString();
  
  // Find latest event up to snapshotTime
  const relevantEvents = events
    .filter((e) => e.tableName === tableName && new Date(e.recordedAt) <= new Date(timeStr))
    .sort((a, b) => Number(BigInt(a.eventId) - BigInt(b.eventId)));

  const lastEvent = relevantEvents[relevantEvents.length - 1];
  const lastEventId = lastEvent ? lastEvent.eventId : '0';

  const tableDump = reconstructTable(tableName, relevantEvents, timeStr);

  return {
    snapshotId: 'snap_' + Math.random().toString(36).substring(2, 9),
    tableName,
    snapshotTime: timeStr,
    lastEventId,
    tableStateDump: tableDump.records,
    createdAt: new Date().toISOString(),
  };
}
