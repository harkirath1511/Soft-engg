-- 02_events.sql: Immutable temporal ledger, snapshots, and branching tables
CREATE SCHEMA IF NOT EXISTS replaydb;

-- 1. Immutable Event Ledger
CREATE TABLE IF NOT EXISTS replaydb.replay_events (
    event_id            BIGSERIAL PRIMARY KEY,
    table_schema        VARCHAR(63) NOT NULL DEFAULT 'public',
    table_name          VARCHAR(63) NOT NULL,
    record_pk           TEXT NOT NULL,
    operation_type      VARCHAR(10) NOT NULL CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_state           JSONB,
    new_state           JSONB,
    diff_state          JSONB,
    transaction_id      BIGINT NOT NULL,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    db_user             VARCHAR(63) DEFAULT current_user,
    client_query        TEXT
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_replay_events_lookup 
    ON replaydb.replay_events (table_name, record_pk, recorded_at ASC);

CREATE INDEX IF NOT EXISTS idx_replay_events_tx 
    ON replaydb.replay_events (transaction_id);

CREATE INDEX IF NOT EXISTS idx_replay_events_time 
    ON replaydb.replay_events (recorded_at);

CREATE INDEX IF NOT EXISTS idx_replay_events_gin_new 
    ON replaydb.replay_events USING GIN (new_state);

-- 2. Checkpoint / Snapshot Table
CREATE TABLE IF NOT EXISTS replaydb.replay_snapshots (
    snapshot_id         BIGSERIAL PRIMARY KEY,
    table_name          VARCHAR(63) NOT NULL,
    snapshot_time       TIMESTAMPTZ NOT NULL,
    last_event_id       BIGINT NOT NULL,
    table_state_dump    JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_replay_snapshots_time 
    ON replaydb.replay_snapshots (table_name, snapshot_time DESC);

-- 3. Counterfactual Branch Ledger
CREATE TABLE IF NOT EXISTS replaydb.replay_branches (
    branch_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_name             VARCHAR(100) NOT NULL,
    base_timestamp          TIMESTAMPTZ NOT NULL,
    excluded_transactions   BIGINT[] NOT NULL DEFAULT '{}',
    overrides               JSONB DEFAULT '{}',
    metadata                JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
