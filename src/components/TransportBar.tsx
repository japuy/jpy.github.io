import React from 'react';
import { formatTime, formatBars } from './utils';
import { AudioEngineState } from './types';

interface Props {
  state: AudioEngineState;
  isRecording: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onBpmChange: (bpm: number) => void;
  onExport: () => void;
  onImportClick: () => void;
  masterVolume: number;
  onMasterVolumeChange: (v: number) => void;
  masterMeter: number;
}

export const TransportBar: React.FC<Props> = ({
  state,
  isRecording,
  onPlay,
  onStop,
  onRecord,
  onBpmChange,
  onExport,
  onImportClick,
  masterVolume,
  onMasterVolumeChange,
  masterMeter,
}) => {
  return (
    <div className="h-16 bg-studio-panel border-b border-studio-border flex items-center px-4 gap-4 shrink-0">
      <div className="flex items-center gap-2 pr-4 border-r border-studio-border">
        <div className="text-studio-accent font-bold text-xl mr-2">🎵 Suno Studio</div>
      </div>

      <div className="flex items-center gap-2 pr-4 border-r border-studio-border">
        <button
          onClick={onRecord}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? 'bg-studio-danger text-white animate-pulse shadow-lg shadow-red-500/50'
              : 'bg-studio-bg hover:bg-red-500/20 text-studio-danger border border-studio-border'
          }`}
          title="Record"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="6" />
          </svg>
        </button>

        <button
          onClick={onPlay}
          className="w-10 h-10 rounded-full bg-studio-accent hover:bg-studio-accent-hover flex items-center justify-center transition-all shadow-lg shadow-purple-500/30"
          title={state.isPlaying ? 'Pause' : 'Play'}
        >
          {state.isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </button>

        <button
          onClick={onStop}
          className="w-10 h-10 rounded-full bg-studio-bg hover:bg-studio-border border border-studio-border flex items-center justify-center transition-all"
          title="Stop"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-4 pr-4 border-r border-studio-border font-mono">
        <div className="bg-black/40 rounded-lg px-4 py-2 text-2xl tracking-wider">
          {formatTime(state.currentTime)}
        </div>
        <div className="text-gray-500">
          {formatBars(state.currentTime, state.bpm)}
        </div>
      </div>

      <div className="flex items-center gap-2 pr-4 border-r border-studio-border">
        <label className="text-xs text-gray-400">BPM</label>
        <input
          type="number"
          min="40"
          max="240"
          value={state.bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
          className="w-16 bg-studio-bg border border-studio-border rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-studio-accent"
        />
      </div>

      <div className="flex items-center gap-2 flex-1">
        <label className="text-xs text-gray-400 shrink-0">MASTER</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={masterVolume}
          onChange={(e) => onMasterVolumeChange(Number(e.target.value))}
          className="flex-1 max-w-xs"
        />
        <div className="w-24 h-4 bg-studio-bg rounded overflow-hidden border border-studio-border">
          <div
            className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all"
            style={{ width: `${Math.min(100, masterMeter * 300)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onImportClick}
          className="px-4 py-2 bg-studio-bg hover:bg-studio-border border border-studio-border rounded-lg text-sm transition-all flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import
        </button>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-studio-accent hover:bg-studio-accent-hover rounded-lg text-sm transition-all flex items-center gap-2 shadow-lg shadow-purple-500/30"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export WAV
        </button>
      </div>
    </div>
  );
};
