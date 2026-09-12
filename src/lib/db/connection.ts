import postgres from 'postgres';
import { ReplayEvent, MonitoredTableInfo, OperationType } from '../types/event';

const DEFAULT_PG_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/replaydb';

class DataStore {
  private sql: postgres.Sql | null = null;
  private isConnected = false;
  private memoryEvents: ReplayEvent[] = [];
  private monitoredTables: Map<string, boolean> = new Map([
    ['users', true],
    ['accounts', true],
    ['orders', true],
    ['inventory', true],
  ]);
  private nextEventId = 1000;

  constructor() {
    this.seedInitialDemoData();
    this.tryInitPostgres();
  }

  private async tryInitPostgres() {
    try {
      const client = postgres(DEFAULT_PG_URL, {
        connect_timeout: 2,
        max: 5,
        idle_timeout: 10,
        onnotice: () => {},
      });
      // Quick ping test
      await client`SELECT 1 as alive`;
      this.sql = client;
      this.isConnected = true;
      console.log('Successfully connected to live PostgreSQL instance:', DEFAULT_PG_URL);
    } catch (err) {
      this.isConnected = false;
      this.sql = null;
      // Operates in robust standalone in-memory mode
    }
  }

  public getConnectionStatus() {
    return {
      connected: this.isConnected,
      mode: this.isConnected ? 'live_postgres' : 'standalone_memory',
      url: this.isConnected ? DEFAULT_PG_URL.replace(/:[^:@]+@/, ':***@') : 'embedded-memory-ledger',
    };
  }

  public async getMonitoredTables(): Promise<MonitoredTableInfo[]> {
    if (this.isConnected && this.sql) {
      try {
        const rows = await this.sql`
          SELECT 
            table_schema as schema,
            table_name as name,
            COUNT(event_id) as event_count,
            MAX(recorded_at) as last_event_at
          FROM replaydb.replay_events
          GROUP BY table_schema, table_name
        `;
        const list: MonitoredTableInfo[] = [];
        for (const row of rows) {
          list.push({
            schema: row.schema,
            name: row.name,
            isMonitored: true,
            triggerName: `trg_replaydb_${row.name}`,
            eventCount: Number(row.event_count),
            lastEventAt: row.last_event_at ? new Date(row.last_event_at).toISOString() : null,
          });
        }
        return list;
      } catch (e) {
        // Fallback to memory
      }
    }

    // Memory mode
    const counts = new Map<string, { count: number; lastAt: string | null }>();
    for (const ev of this.memoryEvents) {
      const cur = counts.get(ev.tableName) || { count: 0, lastAt: null };
      cur.count++;
      if (!cur.lastAt || new Date(ev.recordedAt) > new Date(cur.lastAt)) {
        cur.lastAt = ev.recordedAt;
      }
      counts.set(ev.tableName, cur);
    }

    return Array.from(this.monitoredTables.entries()).map(([name, isMonitored]) => {
      const stats = counts.get(name) || { count: 0, lastAt: null };
      return {
        schema: 'public',
        name,
        isMonitored,
        triggerName: isMonitored ? `trg_replaydb_${name}` : null,
        eventCount: stats.count,
        lastEventAt: stats.lastAt,
      };
    });
  }

  public async attachTable(tableName: string): Promise<boolean> {
    this.monitoredTables.set(tableName, true);
    if (this.isConnected && this.sql) {
      try {
        await this.sql`CALL replaydb.attach_capture_trigger(${tableName})`;
      } catch (e) {
        console.error('Error attaching trigger in Postgres:', e);
      }
    }
    return true;
  }

  public async detachTable(tableName: string): Promise<boolean> {
    this.monitoredTables.set(tableName, false);
    if (this.isConnected && this.sql) {
      try {
        await this.sql`CALL replaydb.detach_capture_trigger(${tableName})`;
      } catch (e) {
        console.error('Error detaching trigger in Postgres:', e);
      }
    }
    return true;
  }

  public async getEvents(filter?: {
    tableName?: string;
    recordPk?: string;
    transactionId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ events: ReplayEvent[]; total: number }> {
    if (this.isConnected && this.sql) {
      try {
        const conditions = [];
        if (filter?.tableName) conditions.push(this.sql`table_name = ${filter.tableName}`);
        if (filter?.recordPk) conditions.push(this.sql`record_pk = ${filter.recordPk}`);
        if (filter?.transactionId) conditions.push(this.sql`transaction_id = ${filter.transactionId}`);
        if (filter?.from) conditions.push(this.sql`recorded_at >= ${new Date(filter.from)}`);
        if (filter?.to) conditions.push(this.sql`recorded_at <= ${new Date(filter.to)}`);

        const limit = filter?.limit ?? 100;
        const offset = filter?.offset ?? 0;

        const rows = await this.sql`
          SELECT 
            event_id::TEXT as "eventId",
            table_schema as "tableSchema",
            table_name as "tableName",
            record_pk as "recordPk",
            operation_type as "operationType",
            old_state as "oldState",
            new_state as "newState",
            diff_state as "diffState",
            transaction_id::TEXT as "transactionId",
            recorded_at as "recordedAt",
            db_user as "dbUser",
            client_query as "clientQuery"
          FROM replaydb.replay_events
          ORDER BY recorded_at ASC, event_id ASC
          LIMIT ${limit} OFFSET ${offset}
        `;

        return {
          events: rows as unknown as ReplayEvent[],
          total: rows.length,
        };
      } catch (e) {
        // Fallback to memory
      }
    }

    // Memory search
    let filtered = [...this.memoryEvents];
    if (filter?.tableName) {
      filtered = filtered.filter((e) => e.tableName.toLowerCase() === filter.tableName?.toLowerCase());
    }
    if (filter?.recordPk) {
      filtered = filtered.filter((e) => e.recordPk === filter.recordPk);
    }
    if (filter?.transactionId) {
      filtered = filtered.filter((e) => e.transactionId === filter.transactionId);
    }
    if (filter?.from) {
      const fromTime = new Date(filter.from).getTime();
      filtered = filtered.filter((e) => new Date(e.recordedAt).getTime() >= fromTime);
    }
    if (filter?.to) {
      const toTime = new Date(filter.to).getTime();
      filtered = filtered.filter((e) => new Date(e.recordedAt).getTime() <= toTime);
    }

    filtered.sort((a, b) => {
      const t = new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
      if (t !== 0) return t;
      return Number(BigInt(a.eventId) - BigInt(b.eventId));
    });

    const total = filtered.length;
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 100;
    const page = filtered.slice(offset, offset + limit);

    return { events: page, total };
  }

  public async getRecordEvents(tableName: string, recordPk: string): Promise<ReplayEvent[]> {
    const { events } = await this.getEvents({ tableName, recordPk, limit: 1000 });
    return events;
  }

  public async insertEvent(event: Omit<ReplayEvent, 'eventId'>): Promise<ReplayEvent> {
    const eventId = (++this.nextEventId).toString();
    const fullEvent: ReplayEvent = {
      ...event,
      eventId,
      recordedAt: event.recordedAt || new Date().toISOString(),
    };

    if (this.isConnected && this.sql) {
      try {
        await this.sql`
          INSERT INTO replaydb.replay_events (
            table_schema, table_name, record_pk, operation_type,
            old_state, new_state, diff_state, transaction_id, recorded_at, db_user, client_query
          ) VALUES (
            ${fullEvent.tableSchema}, ${fullEvent.tableName}, ${fullEvent.recordPk},
            ${fullEvent.operationType}, ${this.sql.json(fullEvent.oldState as any)},
            ${this.sql.json(fullEvent.newState as any)}, ${this.sql.json(fullEvent.diffState as any)},
            ${fullEvent.transactionId}, ${fullEvent.recordedAt}, ${fullEvent.dbUser}, ${fullEvent.clientQuery ?? null}
          )
        `;
      } catch (e) {
        console.error('Error writing to Postgres:', e);
      }
    }

    this.memoryEvents.push(fullEvent);
    return fullEvent;
  }

  /**
   * Seeds the comprehensive demo scenario described in PLAN.md Section 29:
   * Step 1: Normal system operations (Alice account created, balance updated $500 -> $750 -> $1000)
   * Other users and orders seeded.
   */
  public seedInitialDemoData() {
    this.memoryEvents = [];
    this.nextEventId = 1000;

    const baseTime = new Date('2026-09-07T08:00:00.000Z').getTime();

    // 1. Insert Alice (PK 1) at 08:00
    this.memoryEvents.push({
      eventId: '1001',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'INSERT',
      oldState: null,
      newState: { id: 1, username: 'alice', email: 'alice@example.com', balance: 500.0, status: 'ACTIVE' },
      diffState: { id: 1, username: 'alice', email: 'alice@example.com', balance: 500.0, status: 'ACTIVE' },
      transactionId: '100',
      recordedAt: new Date(baseTime).toISOString(),
      dbUser: 'app_service',
      clientQuery: "INSERT INTO users (id, username, email, balance, status) VALUES (1, 'alice', 'alice@example.com', 500.00, 'ACTIVE');",
    });

    // 2. Insert Alice Account (PK 1) in same Tx 100
    this.memoryEvents.push({
      eventId: '1002',
      tableSchema: 'public',
      tableName: 'accounts',
      recordPk: '1',
      operationType: 'INSERT',
      oldState: null,
      newState: { id: 1, user_id: 1, account_number: 'ACC-US-00101', tier: 'GOLD', credit_limit: 5000.0 },
      diffState: { id: 1, user_id: 1, account_number: 'ACC-US-00101', tier: 'GOLD', credit_limit: 5000.0 },
      transactionId: '100',
      recordedAt: new Date(baseTime + 10).toISOString(),
      dbUser: 'app_service',
      clientQuery: "INSERT INTO accounts (id, user_id, account_number, tier, credit_limit) VALUES (1, 1, 'ACC-US-00101', 'GOLD', 5000.00);",
    });

    // 3. Insert Bob (PK 2) at 08:05 in Tx 101
    this.memoryEvents.push({
      eventId: '1003',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '2',
      operationType: 'INSERT',
      oldState: null,
      newState: { id: 2, username: 'bob', email: 'bob@example.com', balance: 1200.0, status: 'ACTIVE' },
      diffState: { id: 2, username: 'bob', email: 'bob@example.com', balance: 1200.0, status: 'ACTIVE' },
      transactionId: '101',
      recordedAt: new Date(baseTime + 5 * 60 * 1000).toISOString(),
      dbUser: 'app_service',
      clientQuery: "INSERT INTO users (id, username, email, balance, status) VALUES (2, 'bob', 'bob@example.com', 1200.00, 'ACTIVE');",
    });

    // 4. Update Alice balance to 750.00 at 08:15 (Tx 105)
    this.memoryEvents.push({
      eventId: '1004',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'UPDATE',
      oldState: { id: 1, username: 'alice', email: 'alice@example.com', balance: 500.0, status: 'ACTIVE' },
      newState: { id: 1, username: 'alice', email: 'alice@example.com', balance: 750.0, status: 'ACTIVE' },
      diffState: { balance: 750.0 },
      transactionId: '105',
      recordedAt: new Date(baseTime + 15 * 60 * 1000).toISOString(),
      dbUser: 'app_service',
      clientQuery: "UPDATE users SET balance = 750.00 WHERE id = 1; -- Direct Deposit",
    });

    // 5. Update Alice balance to 1000.00 at 08:25 (Tx 108)
    this.memoryEvents.push({
      eventId: '1005',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'UPDATE',
      oldState: { id: 1, username: 'alice', email: 'alice@example.com', balance: 750.0, status: 'ACTIVE' },
      newState: { id: 1, username: 'alice', email: 'alice@example.com', balance: 1000.0, status: 'ACTIVE' },
      diffState: { balance: 1000.0 },
      transactionId: '108',
      recordedAt: new Date(baseTime + 25 * 60 * 1000).toISOString(),
      dbUser: 'app_service',
      clientQuery: "UPDATE users SET balance = 1000.00 WHERE id = 1; -- Bonus Credit",
    });

    // 6. Normal Order creation: Alice places order for $49.99 at 08:30 (Tx 112)
    this.memoryEvents.push({
      eventId: '1006',
      tableSchema: 'public',
      tableName: 'orders',
      recordPk: '1',
      operationType: 'INSERT',
      oldState: null,
      newState: { id: 1, user_id: 1, total_amount: 49.99, status: 'CONFIRMED', item_count: 1 },
      diffState: { id: 1, user_id: 1, total_amount: 49.99, status: 'CONFIRMED', item_count: 1 },
      transactionId: '112',
      recordedAt: new Date(baseTime + 30 * 60 * 1000).toISOString(),
      dbUser: 'checkout_service',
      clientQuery: "INSERT INTO orders (id, user_id, total_amount, status, item_count) VALUES (1, 1, 49.99, 'CONFIRMED', 1);",
    });

    // 7. Deduct $49.99 from Alice's balance in same Tx 112
    this.memoryEvents.push({
      eventId: '1007',
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'UPDATE',
      oldState: { id: 1, username: 'alice', email: 'alice@example.com', balance: 1000.0, status: 'ACTIVE' },
      newState: { id: 1, username: 'alice', email: 'alice@example.com', balance: 950.01, status: 'ACTIVE' },
      diffState: { balance: 950.01 },
      transactionId: '112',
      recordedAt: new Date(baseTime + 30 * 60 * 1000 + 25).toISOString(),
      dbUser: 'checkout_service',
      clientQuery: "UPDATE users SET balance = balance - 49.99 WHERE id = 1;",
    });

    this.nextEventId = 1008;
  }

  /**
   * Injects the Buggy Transaction (Tx 402) described in PLAN.md Step 2:
   * Sets Alice balance improperly to -$5,000 and status to 'FRAUD' / 'OVERDRAWN'.
   */
  public injectBugScenario() {
    const bugTime = new Date('2026-09-07T09:30:14.102Z').toISOString();

    const bugEvent: ReplayEvent = {
      eventId: (++this.nextEventId).toString(),
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'UPDATE',
      oldState: { id: 1, username: 'alice', email: 'alice@example.com', balance: 950.01, status: 'ACTIVE' },
      newState: { id: 1, username: 'alice', email: 'alice@example.com', balance: -5000.0, status: 'FRAUD' },
      diffState: { balance: -5000.0, status: 'FRAUD' },
      transactionId: '402',
      recordedAt: bugTime,
      dbUser: 'batch_migration_cron',
      clientQuery: "UPDATE users SET balance = -5000.00, status = 'FRAUD' WHERE id = 1; -- Rogue Migration Script",
    };

    const sideEffectEvent: ReplayEvent = {
      eventId: (++this.nextEventId).toString(),
      tableSchema: 'public',
      tableName: 'accounts',
      recordPk: '1',
      operationType: 'UPDATE',
      oldState: { id: 1, user_id: 1, account_number: 'ACC-US-00101', tier: 'GOLD', credit_limit: 5000.0 },
      newState: { id: 1, user_id: 1, account_number: 'ACC-US-00101', tier: 'FROZEN', credit_limit: 0.0 },
      diffState: { tier: 'FROZEN', credit_limit: 0.0 },
      transactionId: '402',
      recordedAt: new Date(new Date(bugTime).getTime() + 15).toISOString(),
      dbUser: 'batch_migration_cron',
      clientQuery: "UPDATE accounts SET tier = 'FROZEN', credit_limit = 0 WHERE user_id = 1;",
    };

    this.memoryEvents.push(bugEvent, sideEffectEvent);

    // Follow-up valid transaction at 09:45 (Tx 415) to demonstrate downstream state evolution
    const downstreamTime = new Date('2026-09-07T09:45:00.000Z').toISOString();
    const downstreamEvent: ReplayEvent = {
      eventId: (++this.nextEventId).toString(),
      tableSchema: 'public',
      tableName: 'users',
      recordPk: '1',
      operationType: 'UPDATE',
      oldState: { id: 1, username: 'alice', email: 'alice@example.com', balance: -5000.0, status: 'FRAUD' },
      newState: { id: 1, username: 'alice', email: 'alice@example.com', balance: -5000.0, status: 'LOCKED' },
      diffState: { status: 'LOCKED' },
      transactionId: '415',
      recordedAt: downstreamTime,
      dbUser: 'security_daemon',
      clientQuery: "UPDATE users SET status = 'LOCKED' WHERE id = 1 AND status = 'FRAUD';",
    };
    this.memoryEvents.push(downstreamEvent);

    return {
      bugTransactionId: '402',
      injectedEvents: [bugEvent, sideEffectEvent, downstreamEvent],
    };
  }
}

// Global singleton instance
export const db = new DataStore();
