'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock, History, AlertTriangle } from 'lucide-react';
import { ReplayEvent } from '@/lib/types/event';

interface TimelineScrubberProps {
  events: ReplayEvent[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  selectedTimestamp: string;
  onSelectTimestamp: (isoString: string) => void;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  events,
  currentIndex,
  onSelectIndex,
  selectedTimestamp,
  onSelectTimestamp,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;
    if (events.length === 0) return;

    const interval = setInterval(() => {
      if (currentIndex >= events.length - 1) {
        setIsPlaying(false);
        return;
      }
      const next = currentIndex + 1;
      onSelectIndex(next);
      onSelectTimestamp(events[next].recordedAt);
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlaying, events, currentIndex, onSelectIndex, onSelectTimestamp]);

  if (events.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-6 text-center text-slate-400">
        <History className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm">No historical events recorded for this record yet.</p>
      </div>
    );
  }

  const currentEvent = events[currentIndex] || events[events.length - 1];

  const getMarkerColor = (ev: ReplayEvent) => {
    if (ev.transactionId === '402') return 'bg-rose-500 ring-4 ring-rose-500/30 animate-pulse';
    if (ev.operationType === 'INSERT') return 'bg-emerald-400 ring-2 ring-emerald-400/20';
    if (ev.operationType === 'DELETE') return 'bg-red-500 ring-2 ring-red-500/20';
    return 'bg-blue-400 ring-2 ring-blue-400/20';
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Scrubber Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center space-x-2.5">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-200">Temporal Scrubber</span>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
            Event {currentIndex + 1} of {events.length}
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              const prev = Math.max(0, currentIndex - 1);
              onSelectIndex(prev);
              onSelectTimestamp(events[prev].recordedAt);
            }}
            disabled={currentIndex === 0}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition"
            title="Previous Event"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs flex items-center space-x-1.5 transition ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Replay</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Play Timeline</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              const next = Math.min(events.length - 1, currentIndex + 1);
              onSelectIndex(next);
              onSelectTimestamp(events[next].recordedAt);
            }}
            disabled={currentIndex >= events.length - 1}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition"
            title="Next Event"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Current As-Of Timestamp */}
        <div className="text-xs font-mono bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-cyan-300 flex items-center space-x-2">
          <span className="text-slate-500 font-sans">As Of:</span>
          <span>{new Date(selectedTimestamp || currentEvent.recordedAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Visual Track with Event Nodes */}
      <div className="pt-3 pb-2">
        <div className="relative flex items-center">
          {/* Background Track Line */}
          <div className="absolute left-0 right-0 h-1 bg-slate-800 rounded-full" />
          
          {/* Progress Active Line */}
          <div
            className="absolute left-0 h-1 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-300"
            style={{
              width: events.length > 1 ? `${(currentIndex / (events.length - 1)) * 100}%` : '100%',
            }}
          />

          {/* Event Nodes */}
          <div className="relative w-full flex justify-between items-center">
            {events.map((ev, idx) => {
              const isSelected = idx === currentIndex;
              const isBug = ev.transactionId === '402';

              return (
                <button
                  key={ev.eventId}
                  onClick={() => {
                    onSelectIndex(idx);
                    onSelectTimestamp(ev.recordedAt);
                  }}
                  className="group relative flex flex-col items-center focus:outline-none"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${getMarkerColor(ev)} ${
                      isSelected ? 'scale-150 ring-4 ring-cyan-400/50' : 'hover:scale-125'
                    }`}
                  />

                  {/* Tooltip on Hover */}
                  <div className="absolute bottom-6 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-950 border border-slate-700 text-slate-200 text-[11px] p-2 rounded-lg shadow-2xl whitespace-nowrap z-50">
                    <div className="flex items-center space-x-1.5 font-bold">
                      <span className={isBug ? 'text-rose-400' : 'text-blue-400'}>
                        {ev.operationType}
                      </span>
                      <span>• Tx {ev.transactionId}</span>
                      {isBug && <span className="text-rose-400 font-semibold">[BUG INJECTED]</span>}
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      {new Date(ev.recordedAt).toLocaleTimeString()}
                    </div>
                  </div>

                  {/* Label below node */}
                  <span
                    className={`mt-2 text-[10px] font-mono transition-colors ${
                      isSelected ? 'text-cyan-400 font-bold' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  >
                    Tx {ev.transactionId}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Event Context Pill */}
      {currentEvent && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-3">
            <span
              className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                currentEvent.operationType === 'INSERT'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : currentEvent.operationType === 'DELETE'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}
            >
              {currentEvent.operationType}
            </span>
            <span className="text-slate-300">
              Tx ID: <strong className="text-white font-mono">{currentEvent.transactionId}</strong>
            </span>
            <span className="text-slate-400">• By: {currentEvent.dbUser}</span>
          </div>

          {currentEvent.transactionId === '402' && (
            <div className="flex items-center space-x-1.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Erroneous Batch Corruption Detected</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
