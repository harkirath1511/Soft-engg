'use client';

import React from 'react';
import { Database, Zap, RefreshCw, Bug, PlusCircle, CheckCircle, ShieldAlert } from 'lucide-react';

interface NavbarProps {
  systemStatus: {
    mode?: string;
    url?: string;
    totalEvents?: number;
    connected?: boolean;
  };
  onAction: (action: 'seed' | 'inject_bug' | 'reset') => void;
  onOpenMutationModal: () => void;
  isProcessing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  systemStatus,
  onAction,
  onOpenMutationModal,
  isProcessing,
}) => {
  return (
    <header className="border-b border-slate-800 bg-[#0c1222]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-white tracking-tight">ReplayDB</span>
              <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Temporal Flight Recorder & Time-Travel Debugger</p>
          </div>
        </div>

        {/* System Status Pill */}
        <div className="hidden md:flex items-center space-x-2 pl-4 border-l border-slate-800">
          <div className="flex items-center space-x-1.5 text-xs bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-full">
            <span
              className={`w-2 h-2 rounded-full ${
                systemStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
              }`}
            />
            <span className="text-slate-300 font-medium">
              {systemStatus.connected ? 'PostgreSQL Live' : 'Deterministic Temporal Ledger'}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-blue-400 font-mono text-[11px]">
              {systemStatus.totalEvents ?? 0} Events
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={() => onAction('seed')}
          disabled={isProcessing}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition disabled:opacity-50"
          title="Reset and seed standard e-commerce baseline transactions"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isProcessing ? 'animate-spin' : ''}`} />
          <span>Reset / Baseline</span>
        </button>

        <button
          onClick={() => onAction('inject_bug')}
          disabled={isProcessing}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 transition disabled:opacity-50"
          title="Simulate production corruption: Inject Rogue Tx 402 with corrupted balance and fraud status"
        >
          <Bug className="w-3.5 h-3.5 text-rose-400" />
          <span>Inject Tx 402 Bug</span>
        </button>

        <button
          onClick={onOpenMutationModal}
          disabled={isProcessing}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md shadow-blue-600/20 transition disabled:opacity-50"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Mutation</span>
        </button>
      </div>
    </header>
  );
};
