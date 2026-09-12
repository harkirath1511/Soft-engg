import { FieldDiff, DiffReport, ReplayEvent } from '../types/event';

/**
 * Computes field-level difference between two JSON state objects.
 */
export function computeStateDiff(
  oldState: Record<string, unknown> | null,
  newState: Record<string, unknown> | null
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const oldKeys = new Set(Object.keys(oldState || {}));
  const newKeys = new Set(Object.keys(newState || {}));
  const allKeys = new Set([...oldKeys, ...newKeys]);

  for (const key of allKeys) {
    const hasOld = oldKeys.has(key);
    const hasNew = newKeys.has(key);
    const oldVal = oldState ? oldState[key] : undefined;
    const newVal = newState ? newState[key] : undefined;

    if (!hasOld && hasNew) {
      diffs.push({
        field: key,
        oldValue: null,
        newValue: newVal,
        status: 'added',
      });
    } else if (hasOld && !hasNew) {
      diffs.push({
        field: key,
        oldValue: oldVal,
        newValue: null,
        status: 'deleted',
      });
    } else {
      const isIdentical = JSON.stringify(oldVal) === JSON.stringify(newVal);
      diffs.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
        status: isIdentical ? 'unchanged' : 'modified',
      });
    }
  }

  // Sort changes: modified first, then added, deleted, unchanged
  const statusOrder: Record<FieldDiff['status'], number> = {
    modified: 0,
    added: 1,
    deleted: 2,
    unchanged: 3,
  };

  return diffs.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.field.localeCompare(b.field));
}

/**
 * Computes deep diff between two specific events in a record's history
 */
export function computeEventDiff(
  tableName: string,
  recordPk: string,
  fromEvent: ReplayEvent,
  toEvent: ReplayEvent
): DiffReport {
  // Use fromEvent's state (oldState or newState depending on op) vs toEvent's newState
  const baseState = fromEvent.newState ?? fromEvent.oldState ?? null;
  const targetState = toEvent.newState ?? null;

  const changes = computeStateDiff(baseState, targetState);
  const changedCount = changes.filter((c) => c.status !== 'unchanged').length;

  return {
    recordPk,
    tableName,
    fromEventId: fromEvent.eventId,
    toEventId: toEvent.eventId,
    fromTime: fromEvent.recordedAt,
    toTime: toEvent.recordedAt,
    changes,
    changedCount,
  };
}
