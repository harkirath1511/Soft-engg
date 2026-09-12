'use client';

import React from 'react';
import { Layers, Terminal, User, Clock, AlertOctagon, Table } from 'lucide-react';
import { ReplayEvent } from '@/lib/types/event';

interface TxTreeProps {
  currentEvent: ReplayEvent | null;
  allEventsInTx: ReplayEvent[];
  onSelectRecord?: (tableName: string, recordPk: string) => void;
}

export const TxTree: React.FC<TxTreeProps> = ({
  currentEvent,
  allEventsInTx,
  onSelectRecord,
}) => {
  if (!currentEvent) {
    return null;
  }

  const isBugTx = currentEvent.transactionId === '402';
  const affectedTables = Array.from(new Set(allEventsInTx.map((e) => e.tableName)));

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-sm text-slate-200">
            Transaction Blast-Radius Context
          </h3>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded">
            Tx #{currentEvent.transactionId}
          </span>
          {isBugTx && (
            <span className="flex items-center space-x-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded animate-pulse">
              <AlertOctagon className="w-3 h-3" />
              <span>Rogue Batch</span>
            </span>
          )}
        </div>
      </div>

      {/* Transaction Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center space-x-2">
          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Commit Time</div>
            <div className="font-mono text-slate-300">
              {new Date(currentEvent.recordedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center space-x-2">
          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Database Session</div>
            <div className="font-mono text-slate-300">{currentEvent.dbUser}</div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center space-x-2">
          <Table className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Blast Radius</div>
            <div className="font-mono text-slate-300">
              {allEventsInTx.length} rows across {affectedTables.length} tables
            </div>
          </div>
        </div>
      </div>

      {/* Client SQL Query */}
      {currentEvent.clientQuery && (
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 space-y-1">
          <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-400">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span>Executed Client SQL Query:</span>
          </div>
          <pre className="text-xs font-mono text-emerald-400/90 whitespace-pre-wrap overflow-x-auto selection:bg-slate-800">
            {currentEvent.clientQuery}
          </pre>
        </div>
      )}

      {/* Atomic Mutations in This Transaction */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Atomic Multi-Table Mutations ({allEventsInTx.length})
        </div>

        <div className="space-y-1.5">
          {allEventsInTx.map((ev) => {
            const isCurrent = ev.eventId === currentEvent.eventId;

            return (
              <div
                key={ev.eventId}
                onClick={() => onSelectRecord?.(ev.tableName, ev.recordPk)}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${
                  isCurrent
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                    : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/50 text-slate-400'
                }`}
              >
                <div className="flex items-center space-x-2 font-mono">
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded font-sans ${
                      ev.operationType === 'INSERT'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : ev.operationType === 'DELETE'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {ev.operationType}
                  </span>
                  <span className="font-semibold text-slate-200">{ev.tableName}</span>
                  <span className="text-slate-500">(PK: {ev.recordPk})</span>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  {ev.diffState ? Object.keys(ev.diffState).join(', ') : 'no diff'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
