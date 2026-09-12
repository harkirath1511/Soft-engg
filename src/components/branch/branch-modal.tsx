'use client';

import React, { useState } from 'react';
import { GitFork, X, Check, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { ReplayEvent } from '@/lib/types/event';
import { BranchComparison } from '@/lib/engine/branch';

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  recordPk: string;
  allTransactions: string[];
  events: ReplayEvent[];
}

export const BranchModal: React.FC<BranchModalProps> = ({
  isOpen,
  onClose,
  tableName,
  recordPk,
  allTransactions,
  events,
}) => {
  const [branchName, setBranchName] = useState('counterfactual-fix-tx402');
  const [excludedTx, setExcludedTx] = useState<string[]>(['402']);
  const [comparison, setComparison] = useState<BranchComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const toggleTx = (tx: string) => {
    if (excludedTx.includes(tx)) {
      setExcludedTx(excludedTx.filter((t) => t !== tx));
    } else {
      setExcludedTx([...excludedTx, tx]);
    }
  };

  const handleSimulateBranch = async () => {
    setIsLoading(true);
    try {
      // 1. Create branch
      const createRes = await fetch('/api/v1/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchName,
          baseTimestamp: new Date('2026-09-07T08:00:00Z').toISOString(),
          excludedTransactions: excludedTx,
        }),
      });
      const createJson = await createRes.json();
      if (!createJson.success) throw new Error(createJson.error);

      const branchId = createJson.data.branchId;

      // 2. Fetch branched state comparison
      const stateRes = await fetch(
        `/api/v1/branches/${branchId}/state/${tableName}?recordPk=${recordPk}`
      );
      const stateJson = await stateRes.json();
      if (stateJson.success) {
        setComparison(stateJson.data);
      }
    } catch (err) {
      console.error('Error simulating branch:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Counterfactual Branching Sandbox
              </h2>
              <p className="text-xs text-slate-400">
                Simulate alternative database states by omitting erroneous transactions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Hypothetical Branch Name
            </label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Transaction Omission Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Transactions to Omit from History (Drop / Cherry-Pick):
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-800">
              {allTransactions.map((tx) => {
                const isExcluded = excludedTx.includes(tx);
                const isBug = tx === '402';

                return (
                  <button
                    key={tx}
                    onClick={() => toggleTx(tx)}
                    className={`text-xs px-2.5 py-1 rounded-md font-mono flex items-center space-x-1.5 border transition ${
                      isExcluded
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>Tx {tx}</span>
                    {isBug && <span className="text-[10px] text-rose-400 font-bold">[BUG]</span>}
                    {isExcluded && <Check className="w-3 h-3 text-rose-400" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Click Tx 402 to simulate what happens if the rogue batch migration had never committed.
            </p>
          </div>

          <button
            onClick={handleSimulateBranch}
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <GitFork className="w-4 h-4" />
            <span>{isLoading ? 'Recomputing State Graph...' : 'Materialize Counterfactual Timeline'}</span>
          </button>
        </div>

        {/* Comparison Result */}
        {comparison && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Counterfactual Verification Result ({tableName} PK: {recordPk})
                </span>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  comparison.diverged
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {comparison.diverged ? 'Timeline Diverged (Clean Fix)' : 'Identical to Reality'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              {/* Actual Reality */}
              <div className="bg-slate-900/60 border border-rose-500/30 rounded-lg p-3 space-y-1.5">
                <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Actual Reality (With Bug)</span>
                </div>
                <pre className="text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(comparison.actualState, null, 2)}
                </pre>
              </div>

              {/* Counterfactual Alternative */}
              <div className="bg-slate-900/60 border border-emerald-500/30 rounded-lg p-3 space-y-1.5">
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Branch: {branchName}</span>
                </div>
                <pre className="text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(comparison.branchedState, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
