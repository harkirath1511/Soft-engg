'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/navbar';
import { TimelineScrubber } from '@/components/scrubber/timeline-scrubber';
import { DiffViewer } from '@/components/diff/diff-viewer';
import { TxTree } from '@/components/tx/tx-tree';
import { BranchModal } from '@/components/branch/branch-modal';
import { DemoController } from '@/components/demo/demo-controller';
import { MutationModal } from '@/components/mutation/mutation-modal';
import { ReplayEvent, FieldDiff } from '@/lib/types/event';
import { computeStateDiff } from '@/lib/engine/diff';
import { reconstructRecord } from '@/lib/engine/reconstruct';
import {
  Database,
  Clock,
  GitFork,
  Search,
  Table as TableIcon,
  CheckCircle2,
  AlertTriangle,
  History,
} from 'lucide-react';

export default function ReplayDBStudio() {
  const [systemStatus, setSystemStatus] = useState<any>({});
  const [monitoredTables, setMonitoredTables] = useState<string[]>(['users', 'accounts', 'orders', 'inventory']);
  const [selectedTable, setSelectedTable] = useState('users');
  const [selectedPk, setSelectedPk] = useState('1');

  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [allLedgerEvents, setAllLedgerEvents] = useState<ReplayEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isMutationModalOpen, setIsMutationModalOpen] = useState(false);
  const [demoStep, setDemoStep] = useState(1);

  // Load system status and tables
  const loadSystemInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/system/status');
      const json = await res.json();
      if (json.success) {
        setSystemStatus({
          connected: json.data.database.connected,
          mode: json.data.database.mode,
          url: json.data.database.url,
          totalEvents: json.data.totalEventsInLedger,
        });
      }

      const tablesRes = await fetch('/api/v1/management/tables');
      const tablesJson = await tablesRes.json();
      if (tablesJson.success && tablesJson.data.length > 0) {
        setMonitoredTables(tablesJson.data.map((t: any) => t.name));
      }
    } catch (err) {
      console.error('Error fetching system status:', err);
    }
  }, []);

  // Fetch record history
  const fetchRecordHistory = useCallback(
    async (table: string, pk: string, preserveTimestamp?: string) => {
      try {
        const res = await fetch(`/api/v1/history/records/${table}/${pk}`);
        const json = await res.json();
        if (json.success) {
          const evList = json.data.events || [];
          setEvents(evList);

          if (evList.length > 0) {
            if (preserveTimestamp) {
              const matchedIdx = evList.findIndex(
                (e: ReplayEvent) => new Date(e.recordedAt).getTime() >= new Date(preserveTimestamp).getTime()
              );
              const idx = matchedIdx !== -1 ? matchedIdx : evList.length - 1;
              setCurrentIndex(idx);
              setSelectedTimestamp(preserveTimestamp);
            } else {
              const lastIdx = evList.length - 1;
              setCurrentIndex(lastIdx);
              setSelectedTimestamp(evList[lastIdx].recordedAt);
            }
          } else {
            setCurrentIndex(0);
            setSelectedTimestamp('');
          }
        }

        // Also refresh global ledger events for cross-table transaction grouping
        const ledgerRes = await fetch('/api/v1/history/events?limit=200');
        const ledgerJson = await ledgerRes.json();
        if (ledgerJson.success) {
          setAllLedgerEvents(ledgerJson.data);
        }
      } catch (err) {
        console.error('Error fetching record history:', err);
      }
    },
    []
  );

  useEffect(() => {
    loadSystemInfo();
    fetchRecordHistory(selectedTable, selectedPk);
  }, [loadSystemInfo, fetchRecordHistory, selectedTable, selectedPk]);

  // Handle Quick Actions
  const handleQuickAction = async (action: 'seed' | 'inject_bug' | 'reset') => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/v1/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        await loadSystemInfo();
        await fetchRecordHistory(selectedTable, selectedPk);
        if (action === 'seed') setDemoStep(1);
        if (action === 'inject_bug') setDemoStep(2);
      }
    } catch (err) {
      console.error('Error triggering action:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Demo Workflow Stepper
  const handleRunDemoStep = async (step: number) => {
    setDemoStep(step);
    if (step === 1) {
      await handleQuickAction('seed');
      setSelectedTable('users');
      setSelectedPk('1');
    } else if (step === 2) {
      await handleQuickAction('inject_bug');
      setSelectedTable('users');
      setSelectedPk('1');
    } else if (step === 3) {
      // Step 3: Forensic Discovery - jump to Tx 402 event
      const bugIdx = events.findIndex((e) => e.transactionId === '402');
      if (bugIdx !== -1) {
        setCurrentIndex(bugIdx);
        setSelectedTimestamp(events[bugIdx].recordedAt);
      }
    } else if (step === 4) {
      // Step 4: Replay prior state - scrub to timestamp right before Tx 402 (08:25)
      const priorEvent = events.find((e) => e.transactionId === '108') || events[0];
      if (priorEvent) {
        const priorIdx = events.indexOf(priorEvent);
        setCurrentIndex(priorIdx);
        setSelectedTimestamp(priorEvent.recordedAt);
      }
    } else if (step === 5) {
      // Step 5: Open Branching Modal
      setIsBranchModalOpen(true);
    }
  };

  const currentEvent = events[currentIndex] || null;

  // Reconstruct record state at selected timestamp
  const reconstructed = reconstructRecord(
    selectedTable,
    selectedPk,
    events,
    selectedTimestamp || new Date().toISOString()
  );

  // Compute visual diff for current event
  const visualDiffs: FieldDiff[] = currentEvent
    ? computeStateDiff(currentEvent.oldState, currentEvent.newState)
    : [];

  // Group all events in current transaction across all tables
  const allEventsInTx = currentEvent
    ? allLedgerEvents.filter((e) => e.transactionId === currentEvent.transactionId)
    : [];

  const allDistinctTransactions = Array.from(new Set(allLedgerEvents.map((e) => e.transactionId)));

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      <Navbar
        systemStatus={systemStatus}
        onAction={handleQuickAction}
        onOpenMutationModal={() => setIsMutationModalOpen(true)}
        isProcessing={isProcessing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Academic 5-Step Forensic Demo Guide (PLAN.md Section 29) */}
        <DemoController
          currentStep={demoStep}
          onSetStep={setDemoStep}
          onRunStepAction={handleRunDemoStep}
          isProcessing={isProcessing}
        />

        {/* Target Entity Selector Toolbar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-medium">Target Table:</span>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 text-xs"
              >
                {monitoredTables.map((tbl) => (
                  <option key={tbl} value={tbl}>
                    {tbl}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-medium">Record PK:</span>
              <div className="relative">
                <input
                  type="text"
                  value={selectedPk}
                  onChange={(e) => setSelectedPk(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-200 font-mono rounded-lg px-3 py-1.5 w-24 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              onClick={() => fetchRecordHistory(selectedTable, selectedPk)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium border border-slate-700 transition"
            >
              <Search className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Load Lifecycle
            </button>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsBranchModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg shadow-sm transition"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Fork Counterfactual Branch</span>
            </button>
          </div>
        </div>

        {/* Timeline Scrubber */}
        <TimelineScrubber
          events={events}
          currentIndex={currentIndex}
          onSelectIndex={setCurrentIndex}
          selectedTimestamp={selectedTimestamp}
          onSelectTimestamp={setSelectedTimestamp}
        />

        {/* State Reconstruction and Diff Inspector Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Deterministically Reconstructed State */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-sm text-slate-200">
                  Deterministic State Materialization
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    reconstructed.exists
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {reconstructed.exists ? 'Row Exists' : 'Not Exists / Deleted'}
                </span>
                <span className="text-[11px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                  {reconstructed.appliedEventsCount} folds
                </span>
              </div>
            </div>

            {/* As-Of Snapshot Details */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs space-y-1 font-mono">
              <div className="text-slate-400 flex justify-between">
                <span>Target Timestamp T:</span>
                <span className="text-cyan-300">
                  {new Date(reconstructed.asOf).toLocaleString()}
                </span>
              </div>
              <div className="text-slate-400 flex justify-between">
                <span>Last Transaction ID:</span>
                <span className="text-slate-200">Tx #{reconstructed.lastTransactionId || 'none'}</span>
              </div>
            </div>

            {/* State JSON Viewer */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-hidden">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Reconstructed Row Attributes (JSONB)
              </div>
              <pre className="text-xs font-mono text-cyan-300/90 whitespace-pre-wrap overflow-x-auto max-h-64">
                {reconstructed.state
                  ? JSON.stringify(reconstructed.state, null, 2)
                  : '// Row did not exist at target timestamp'}
              </pre>
            </div>
          </div>

          {/* Right Column: Visual Deep Diff */}
          <DiffViewer
            diffs={visualDiffs}
            title={`Field Diff at Event #${currentEvent?.eventId || ''}`}
            subtitle={
              currentEvent
                ? `Operation: ${currentEvent.operationType} in Transaction #${currentEvent.transactionId}`
                : undefined
            }
          />
        </div>

        {/* Transaction Blast-Radius Context */}
        <TxTree
          currentEvent={currentEvent}
          allEventsInTx={allEventsInTx}
          onSelectRecord={(tbl, pk) => {
            setSelectedTable(tbl);
            setSelectedPk(pk);
          }}
        />

        {/* Global Historical Event Ledger Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-blue-400" />
              <h3 className="font-semibold text-sm text-slate-200">
                Immutable Temporal Event Ledger (`replaydb.replay_events`)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Showing {allLedgerEvents.length} events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-sans font-medium">
                  <th className="py-2.5 px-3">Event ID</th>
                  <th className="py-2.5 px-3">Recorded At</th>
                  <th className="py-2.5 px-3">Tx ID</th>
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">PK</th>
                  <th className="py-2.5 px-3">Operation</th>
                  <th className="py-2.5 px-3">Session User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allLedgerEvents.map((ev) => {
                  const isBug = ev.transactionId === '402';
                  const isSelected =
                    ev.tableName === selectedTable && ev.recordPk === selectedPk;

                  return (
                    <tr
                      key={ev.eventId}
                      onClick={() => {
                        setSelectedTable(ev.tableName);
                        setSelectedPk(ev.recordPk);
                        setSelectedTimestamp(ev.recordedAt);
                      }}
                      className={`cursor-pointer transition-colors ${
                        isBug
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
                          : isSelected
                          ? 'bg-blue-500/10 hover:bg-blue-500/15'
                          : 'hover:bg-slate-800/40 text-slate-400'
                      }`}
                    >
                      <td className="py-2 px-3 font-semibold text-slate-300">#{ev.eventId}</td>
                      <td className="py-2 px-3 text-slate-400">
                        {new Date(ev.recordedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            isBug
                              ? 'bg-rose-500/20 text-rose-300 font-bold'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          Tx {ev.transactionId}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-200">{ev.tableName}</td>
                      <td className="py-2 px-3 text-cyan-300">{ev.recordPk}</td>
                      <td className="py-2 px-3 font-sans">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            ev.operationType === 'INSERT'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : ev.operationType === 'DELETE'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {ev.operationType}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">{ev.dbUser}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Counterfactual Branch Modal */}
      <BranchModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        tableName={selectedTable}
        recordPk={selectedPk}
        allTransactions={allDistinctTransactions}
        events={events}
      />

      {/* Custom Mutation Modal */}
      <MutationModal
        isOpen={isMutationModalOpen}
        onClose={() => setIsMutationModalOpen(false)}
        onMutationSuccess={() => {
          loadSystemInfo();
          fetchRecordHistory(selectedTable, selectedPk);
        }}
        monitoredTables={monitoredTables}
      />
    </div>
  );
}
