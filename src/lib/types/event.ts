export type OperationType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface ReplayEvent {
  eventId: string; // 64-bit integer serialized as string
  tableSchema: string;
  tableName: string;
  recordPk: string;
  operationType: OperationType;
  oldState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  diffState: Record<string, unknown> | null;
  transactionId: string;
  recordedAt: string; // ISO 8601 UTC timestamp
  dbUser: string;
  clientQuery?: string | null;
}

export interface ReconstructedState {
  recordPk: string;
  tableName: string;
  asOf: string;
  exists: boolean;
  state: Record<string, unknown> | null;
  lastMutatedAt: string | null;
  appliedEventsCount: number;
  lastTransactionId: string | null;
  historyTrail?: {
    eventId: string;
    operationType: OperationType;
    recordedAt: string;
    transactionId: string;
  }[];
}

export type DiffFieldStatus = 'added' | 'modified' | 'deleted' | 'unchanged';

export interface FieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  status: DiffFieldStatus;
}

export interface DiffReport {
  recordPk: string;
  tableName: string;
  fromEventId?: string;
  toEventId?: string;
  fromTime?: string;
  toTime?: string;
  changes: FieldDiff[];
  changedCount: number;
}

export interface TransactionGroup {
  transactionId: string;
  timestamp: string;
  totalOperations: number;
  tablesMutated: string[];
  events: ReplayEvent[];
  clientQuery?: string | null;
  dbUser: string;
}

export interface BranchSpec {
  branchId: string;
  branchName: string;
  baseTimestamp: string;
  excludedTransactions: string[];
  overrides?: Record<string, Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface MonitoredTableInfo {
  schema: string;
  name: string;
  isMonitored: boolean;
  triggerName: string | null;
  eventCount: number;
  lastEventAt: string | null;
}

export interface BranchComparison {
  recordPk: string;
  tableName: string;
  diverged: boolean;
  actualState: Record<string, unknown> | null;
  branchedState: Record<string, unknown> | null;
  diffs: FieldDiff[];
}

