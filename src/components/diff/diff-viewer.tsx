'use client';

import React from 'react';
import { GitCommit, ArrowRight, Check, AlertCircle, Plus, Minus } from 'lucide-react';
import { FieldDiff } from '@/lib/types/event';

interface DiffViewerProps {
  diffs: FieldDiff[];
  title?: string;
  subtitle?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diffs,
  title = 'Visual Field Differential',
  subtitle,
}) => {
  const modifiedCount = diffs.filter((d) => d.status === 'modified').length;
  const addedCount = diffs.filter((d) => d.status === 'added').length;
  const deletedCount = diffs.filter((d) => d.status === 'deleted').length;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <GitCommit className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-sm text-slate-200">{title}</h3>
        </div>

        {/* Change Stats */}
        <div className="flex items-center space-x-2 text-[11px]">
          {modifiedCount > 0 && (
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
              {modifiedCount} modified
            </span>
          )}
          {addedCount > 0 && (
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
              +{addedCount} added
            </span>
          )}
          {deletedCount > 0 && (
            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded">
              -{deletedCount} deleted
            </span>
          )}
          {modifiedCount === 0 && addedCount === 0 && deletedCount === 0 && (
            <span className="text-slate-500">No attribute changes</span>
          )}
        </div>
      </div>

      {subtitle && <p className="text-xs text-slate-400 -mt-2">{subtitle}</p>}

      {/* Diff Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-sans font-medium">
              <th className="py-2 px-3 w-1/4">Field</th>
              <th className="py-2 px-3 w-1/3">Prior State (OLD)</th>
              <th className="py-2 px-1 w-6"></th>
              <th className="py-2 px-3 w-1/3">Transitioned State (NEW)</th>
              <th className="py-2 px-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {diffs.map((d) => {
              const isModified = d.status === 'modified';
              const isAdded = d.status === 'added';
              const isDeleted = d.status === 'deleted';

              let rowBg = 'hover:bg-slate-800/30';
              if (isModified) rowBg = 'bg-amber-500/5 hover:bg-amber-500/10';
              if (isAdded) rowBg = 'bg-emerald-500/5 hover:bg-emerald-500/10';
              if (isDeleted) rowBg = 'bg-rose-500/5 hover:bg-rose-500/10';

              return (
                <tr key={d.field} className={`transition-colors ${rowBg}`}>
                  {/* Field Name */}
                  <td className="py-2.5 px-3 font-semibold text-slate-300 flex items-center space-x-1.5">
                    {isAdded && <Plus className="w-3 h-3 text-emerald-400" />}
                    {isDeleted && <Minus className="w-3 h-3 text-rose-400" />}
                    {isModified && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />}
                    <span>{d.field}</span>
                  </td>

                  {/* Prior State */}
                  <td className="py-2.5 px-3 text-slate-400">
                    {d.oldValue === null || d.oldValue === undefined ? (
                      <span className="text-slate-600 italic">null</span>
                    ) : (
                      <span
                        className={
                          isModified || isDeleted
                            ? 'text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded'
                            : 'text-slate-400'
                        }
                      >
                        {typeof d.oldValue === 'object'
                          ? JSON.stringify(d.oldValue)
                          : String(d.oldValue)}
                      </span>
                    )}
                  </td>

                  {/* Arrow */}
                  <td className="py-2.5 px-1 text-slate-600 text-center">
                    <ArrowRight className="w-3 h-3 mx-auto" />
                  </td>

                  {/* Transitioned State */}
                  <td className="py-2.5 px-3">
                    {d.newValue === null || d.newValue === undefined ? (
                      <span className="text-slate-600 italic">null</span>
                    ) : (
                      <span
                        className={
                          isModified
                            ? 'text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded'
                            : isAdded
                            ? 'text-emerald-300 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded'
                            : 'text-slate-300'
                        }
                      >
                        {typeof d.newValue === 'object'
                          ? JSON.stringify(d.newValue)
                          : String(d.newValue)}
                      </span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="py-2.5 px-2 text-right">
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded font-sans ${
                        isModified
                          ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                          : isAdded
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                          : isDeleted
                          ? 'text-rose-400 bg-rose-500/10 border border-rose-500/30'
                          : 'text-slate-500'
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
