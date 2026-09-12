# ReplayDB — Temporal Database Debugging & Replay System

ReplayDB is a time-travel database debugger and forensic analysis platform designed for PostgreSQL, implemented using **Next.js 15 (App Router)** and **TypeScript**.

It captures granular row-level mutations into an immutable temporal ledger (`replaydb.replay_events`), provides deterministic forward/backward state reconstruction, field-level deep diffing, cross-table transaction blast-radius inspection, and counterfactual "what-if" branching.

---

## Key Features

1. **INVESTIGATE (Temporal Forensics)**:
   - **Row-Level Lineage**: Complete chronological history of any record from insertion to current state or deletion.
   - **Visual Deep Diff**: Color-coded field differential highlighting added, modified, and deleted attributes.
   - **Transaction Blast-Radius Inspector**: Cross-table mutation correlation showing all row operations executed within the same atomic PostgreSQL transaction (`pg_current_xact_id()`).

2. **REPLAY (Deterministic Time-Travel Reconstruction)**:
   - **Temporal Scrubbing**: Interactive timeline scrubber to inspect table or record states at any microsecond timestamp $T$.
   - **Deterministic Fold Engine**: Mathematically verifies and reconstructs states without modifying upstream business data.

3. **BRANCH (Counterfactual Sandbox)**:
   - **Transaction Omission**: Reconstruct alternative timelines by skipping buggy or rogue transactions (e.g., skip Tx 402).
   - **Side-by-Side Divergence Preview**: Directly compare actual corrupted reality against the hypothetical clean state.

4. **Academic 5-Step Evaluation Workflow**:
   - Turnkey interactive demo implementing the master verification flow from `PLAN.md`:
     1. Normal Operations (Alice created, balances $500 -> $750 -> $1,000)
     2. Silent Bug Injection (Rogue batch migration Tx 402 corrupts Alice's balance to -$5,000)
     3. Forensic Discovery (Examine Tx 402 blast-radius and deep visual diff)
     4. Point-in-Time Replay (Scrub back to before Tx 402 to observe the pristine $1,000 balance)
     5. Counterfactual Branch (Omit Tx 402 to verify that the account state remains intact)

---

## Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript 5+ (Strict type safety)
- **Styling**: Tailwind CSS & Lucide Icons
- **Database Layer**: Dual-mode adapter supporting live PostgreSQL 15+ (`postgres.js`) and embedded deterministic temporal ledger for instant turnkey evaluation
- **Testing**: Vitest (`tests/unit/reconstruction.test.ts`)

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Unit Test Suite
```bash
npm test
```
All 7 unit tests test deterministic state folding, field diff calculations, counterfactual transaction exclusion, and cross-table transaction grouping.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## Docker Setup (PostgreSQL with High-Precision Transaction Tracking)

To launch the containerized PostgreSQL 17 database with pre-configured schemas and capture triggers:

```bash
docker compose up -d
```

Connection details:
- Host: `localhost:5433` (or `5432`)
- Database: `replaydb`
- User: `replay_admin`
- Password: `replay_password_secure`

---

## REST API Overview

- `GET /api/v1/management/tables` — List monitored tables and event statistics
- `POST /api/v1/management/tables/:table/attach` — Attach capture triggers
- `DELETE /api/v1/management/tables/:table/detach` — Detach capture triggers
- `GET /api/v1/history/events` — Query historical ledger with filters
- `GET /api/v1/history/records/:table/:pk` — Full chronological record lifecycle
- `GET /api/v1/history/records/:table/:pk/diff` — Field-level deep diff
- `GET /api/v1/replay/records/:table/:pk?asOf=...` — Reconstruct record state at timestamp $T$
- `GET /api/v1/replay/tables/:table?asOf=...` — Reconstruct entire table at timestamp $T$
- `GET /api/v1/transactions/:txId` — Multi-table operations within transaction
- `GET /api/v1/transactions/correlate?nearTxId=...&windowMs=...` — Temporal correlation
- `POST /api/v1/branches` — Define counterfactual branch omitting transactions
- `GET /api/v1/branches/:id/state/:table` — Reconstruct state in counterfactual branch
- `POST /api/v1/demo` — Turnkey demo runner (seed, inject bug, custom mutation)