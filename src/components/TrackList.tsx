import React from 'react';
import { Track } from '../types';

interface Props {
  tracks: Track[];
  selectedTrackId: string | null;
  onSelectTrack: (id: string) => void;
  onUpdateTrack: (id: string, updates: Partial<Track>) => void;
  onAddTrack: () => void;
  onDeleteTrack: (id: string) => void;
  meterLevels: Record<string, number>;
  onArmTrack: (id: string) => void;
  isRecording: boolean;
  recordingTrackId: string | null;
  trackHeight: number;
}

export const TrackList: React.FC<Props> = ({
  tracks,
  selectedTrackId,
  onSelectTrack,
  onUpdateTrack,
  onAddTrack,
  onDeleteTrack,
  meterLevels,
  onArmTrack,
  isRecording,
  recordingTrackId,
  trackHeight,
}) => {
  return (
    <div className="w-64 bg-studio-panel border-r border-studio-border flex flex-col shrink-0">
      <div className="h-12 border-b border-studio-border flex items-center px-3 justify-between shrink-0">
        <span className="text-sm font-semibold text-gray-300">TRACKS</span>
        <button
          onClick={onAddTrack}
          className="w-7 h-7 rounded bg-studio-bg hover:bg-studio-accent flex items-center justify-center transition-all border border-studio-border hover:border-studio-accent"
          title="Add Track"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tracks.map((track) => {
          const isSelected = selectedTrackId === track.id;
          const isArmed = track.armed;
          const meter = meterLevels[track.id] || 0;
          const isThisRecording = isRecording && recordingTrackId === track.id;

          return (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track.id)}
              className={`relative px-3 py-2 border-b border-studio-border cursor-pointer transition-all ${
                isSelected ? 'bg-studio-accent/10' : 'hover:bg-studio-bg/50'
              } ${isArmed ? 'border-l-4' : ''}`}
              style={{
                minHeight: trackHeight,
                borderLeftColor: isArmed ? track.color : undefined,
              }}
            >
              <div className="flex items-start gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: track.color }}
                />
                <input
                  type="text"
                  value={track.name}
                  onChange={(e) => onUpdateTrack(track.id, { name: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent text-sm font-medium focus:outline-none w-full"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTrack(track.id);
                  }}
                  className="text-gray-500 hover:text-studio-danger opacity-0 hover:opacity-100 transition-all text-xs shrink-0"
                  title="Delete track"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-1 mb-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTrack(track.id, { muted: !track.muted });
                  }}
                  className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                    track.muted
                      ? 'bg-studio-danger text-white'
                      : 'bg-studio-bg text-gray-400 hover:text-white border border-studio-border'
                  }`}
                  title="Mute"
                >
                  M
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTrack(track.id, { solo: !track.solo });
                  }}
                  className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                    track.solo
                      ? 'bg-yellow-500 text-black'
                      : 'bg-studio-bg text-gray-400 hover:text-white border border-studio-border'
                  }`}
                  title="Solo"
                >
                  S
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArmTrack(track.id);
                  }}
                  className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                    isArmed
                      ? isThisRecording
                        ? 'bg-studio-danger text-white animate-pulse'
                        : 'bg-studio-danger/80 text-white'
                      : 'bg-studio-bg text-gray-400 hover:text-studio-danger border border-studio-border'
                  }`}
                  title="Arm for Recording"
                >
                  R
                </button>
                <div className="w-12 h-3 bg-black/40 rounded overflow-hidden ml-auto border border-studio-border">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all"
                    style={{ width: `${Math.min(100, meter * 400)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500 shrink-0">
                  <polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" />
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.volume}
                  onChange={(e) => onUpdateTrack(track.id, { volume: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1"
                />
                <span className="text-xs text-gray-500 w-8 text-right shrink-0 font-mono">
                  {Math.round(track.volume * 100)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
