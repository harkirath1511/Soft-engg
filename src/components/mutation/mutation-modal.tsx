'use client';

import React, { useState } from 'react';
import { PlusCircle, X, Terminal } from 'lucide-react';
import { OperationType } from '@/lib/types/event';

interface MutationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMutationSuccess: () => void;
  monitoredTables: string[];
}

export const MutationModal: React.FC<MutationModalProps> = ({
  isOpen,
  onClose,
  onMutationSuccess,
  monitoredTables,
}) => {
  const [table, setTable] = useState(monitoredTables[0] || 'users');
  const [pk, setPk] = useState('1');
  const [opType, setOpType] = useState<OperationType>('UPDATE');
  const [payloadJson, setPayloadJson] = useState('{\n  "balance": 1500.00,\n  "status": "VIP"\n}');
  const [queryNote, setQueryNote] = useState('UPDATE users SET balance = 1500.00, status = \'VIP\' WHERE id = 1;');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const parsed = JSON.parse(payloadJson);
      const res = await fetch('/api/v1/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'custom_mutation',
          payload: {
            tableName: table,
            recordPk: pk,
            operationType: opType,
            newState: parsed,
            query: queryNote,
          },
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      onMutationSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid JSON payload');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-base">Execute Custom Mutation</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Target Table</label>
              <select
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
              >
                {monitoredTables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Record PK</label>
              <input
                type="text"
                value={pk}
                onChange={(e) => setPk(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Operation</label>
              <select
                value={opType}
                onChange={(e) => setOpType(e.target.value as OperationType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
              >
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              New State Payload (JSON)
            </label>
            <textarea
              rows={4}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">SQL Query Note</label>
            <input
              type="text"
              value={queryNote}
              onChange={(e) => setQueryNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-400"
            />
          </div>

          {errorMsg && (
            <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-[11px]">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Writing...' : 'Commit Mutation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
