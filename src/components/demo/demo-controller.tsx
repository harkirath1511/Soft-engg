'use client';

import React from 'react';
import { PlayCircle, Bug, Search, RotateCcw, GitFork, CheckCircle2 } from 'lucide-react';

interface DemoControllerProps {
  currentStep: number;
  onSetStep: (step: number) => void;
  onRunStepAction: (step: number) => void;
  isProcessing: boolean;
}

export const DemoController: React.FC<DemoControllerProps> = ({
  currentStep,
  onSetStep,
  onRunStepAction,
  isProcessing,
}) => {
  const steps = [
    {
      num: 1,
      title: 'Normal Operations',
      subtitle: 'Alice created ($500 -> $750 -> $1,000)',
      icon: PlayCircle,
      actionName: 'Seed Baseline',
    },
    {
      num: 2,
      title: 'Silent Bug Injection',
      subtitle: 'Rogue Tx 402 corrupts balance to -$5,000',
      icon: Bug,
      actionName: 'Inject Tx 402 Bug',
    },
    {
      num: 3,
      title: 'Forensic Discovery',
      subtitle: 'Investigate Tx 402 blast-radius & diff',
      icon: Search,
      actionName: 'Inspect Tx 402',
    },
    {
      num: 4,
      title: 'Point-in-Time Replay',
      subtitle: 'Scrub to 08:25 (before Tx 402 bug)',
      icon: RotateCcw,
      actionName: 'Replay Prior State',
    },
    {
      num: 5,
      title: 'Counterfactual Branch',
      subtitle: 'Omit Tx 402 and verify data integrity',
      icon: GitFork,
      actionName: 'Simulate Branch',
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-blue-500/20 rounded-xl p-4 shadow-lg space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Academic Forensic Evaluation Workflow (PLAN.md §29)</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            Click any step to execute the corresponding forensic phase automatically
          </p>
        </div>

        <span className="text-[11px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
          Current Step: {currentStep} of 5
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
        {steps.map((step) => {
          const isActive = currentStep === step.num;
          const isDone = currentStep > step.num;
          const Icon = step.icon;

          return (
            <button
              key={step.num}
              onClick={() => onRunStepAction(step.num)}
              disabled={isProcessing}
              className={`p-3 rounded-lg text-left border transition-all flex flex-col justify-between ${
                isActive
                  ? 'bg-blue-600/15 border-blue-500/60 ring-2 ring-blue-500/30'
                  : isDone
                  ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                  : 'bg-slate-950/20 border-slate-800/40 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : isDone
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Step {step.num}
                </span>

                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-200 line-clamp-1">{step.title}</div>
                <div className="text-[10px] text-slate-400 line-clamp-1">{step.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
