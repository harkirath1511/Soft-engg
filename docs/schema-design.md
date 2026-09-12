# ReplayDB Schema Design & Storage Specification

## Overview

ReplayDB decouples the operational state of relational applications from historical temporal analysis by recording every granular row mutation into an immutable append-only ledger in PostgreSQL.

---

## 1. Relational Schemas

### `replaydb.replay_events` (Historical Ledger)
Stores row mutations captured by generic PL/pgSQL triggers.

```sql
CREATE TABLE replaydb.replay_events (
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
```

### Performance Indexes
- **B-tree on `(table_name, record_pk, recorded_at ASC)`**: Sub-millisecond lookup of a record's complete lifecycle.
- **B-tree on `transaction_id`**: Rapid blast-radius analysis across all tables for an atomic transaction.
- **B-tree on `recorded_at`**: Temporal window querying and proximity correlation.
- **GIN on `new_state`**: Fast arbitrary JSON attribute search.

---

## 2. Compaction & Snapshots

### `replaydb.replay_snapshots`
```sql
CREATE TABLE replaydb.replay_snapshots (
    snapshot_id         BIGSERIAL PRIMARY KEY,
    table_name          VARCHAR(63) NOT NULL,
    snapshot_time       TIMESTAMPTZ NOT NULL,
    last_event_id       BIGINT NOT NULL,
    table_state_dump    JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

---

## 3. Counterfactual Branches

### `replaydb.replay_branches`
```sql
CREATE TABLE replaydb.replay_branches (
    branch_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_name             VARCHAR(100) NOT NULL,
    base_timestamp          TIMESTAMPTZ NOT NULL,
    excluded_transactions   BIGINT[] NOT NULL DEFAULT '{}',
    overrides               JSONB DEFAULT '{}',
    metadata                JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```
