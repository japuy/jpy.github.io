import React, { useRef, useState, useEffect } from 'react';
import { AudioClip, Track } from '../types';
import { formatTime, formatBars } from '../utils';

interface Props {
  tracks: Track[];
  clips: AudioClip[];
  currentTime: number;
  bpm: number;
  pixelsPerSecond: number;
  trackHeight: number;
  onSeek: (time: number) => void;
  onUpdateClip: (id: string, updates: Partial<AudioClip>) => void;
  onDeleteClip: (id: string) => void;
  onImportToTrack: (trackId: string, time: number) => void;
  isPlaying: boolean;
}

export const Timeline: React.FC<Props> = ({
  tracks,
  clips,
  currentTime,
  bpm,
  pixelsPerSecond,
  trackHeight,
  onSeek,
  onUpdateClip,
  onDeleteClip,
  onImportToTrack,
  isPlaying,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; origStart: number } | null>(null);
  const [selection, setSelection] = useState<string | null>(null);

  const totalWidth = Math.max(2000, currentTime * pixelsPerSecond + 1000);
  const totalHeight = tracks.length * trackHeight;

  const syncScroll = () => {
    if (scrollRef.current && rulerRef.current) {
      rulerRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  };

  const timeFromX = (x: number, container: HTMLElement): number => {
    const rect = container.getBoundingClientRect();
    const offsetX = x - rect.left + scrollRef.current!.scrollLeft;
    return Math.max(0, offsetX / pixelsPerSecond);
  };

  const handleRulerClick = (e: React.MouseEvent) => {
    if (!rulerRef.current) return;
    const time = timeFromX(e.clientX, rulerRef.current);
    onSeek(time);
  };

  const handleClipMouseDown = (e: React.MouseEvent, clip: AudioClip) => {
    e.stopPropagation();
    setSelection(clip.id);
    setDragging({
      id: clip.id,
      startX: e.clientX,
      origStart: clip.startTime,
    });
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      if (!scrollRef.current) return;
      const deltaX = e.clientX - dragging.startX;
      const deltaTime = deltaX / pixelsPerSecond;
      const newStart = Math.max(0, dragging.origStart + deltaTime);
      onUpdateClip(dragging.id, { startTime: newStart });
    };

    const handleUp = () => {
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, onUpdateClip, pixelsPerSecond]);

  useEffect(() => {
    if (isPlaying && scrollRef.current) {
      const playheadX = currentTime * pixelsPerSecond;
      const scrollLeft = scrollRef.current.scrollLeft;
      const viewportWidth = scrollRef.current.clientWidth;
      if (playheadX > scrollLeft + viewportWidth - 200) {
        scrollRef.current.scrollLeft = playheadX - viewportWidth + 200;
      }
      if (playheadX < scrollLeft) {
        scrollRef.current.scrollLeft = playheadX;
      }
    }
  }, [currentTime, isPlaying, pixelsPerSecond]);

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    const time = timeFromX(e.clientX, scrollRef.current);
    onSeek(time);
    setSelection(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    const y = e.clientY - (scrollRef.current.getBoundingClientRect().top) + scrollRef.current.scrollTop;
    const trackIdx = Math.floor(y / trackHeight);
    if (trackIdx >= 0 && trackIdx < tracks.length) {
      const time = timeFromX(e.clientX, scrollRef.current);
      onImportToTrack(tracks[trackIdx].id, time);
    }
  };

  const secondsPerBeat = 60 / bpm;
  const beatMarks: number[] = [];
  for (let t = 0; t <= totalWidth / pixelsPerSecond; t += secondsPerBeat) {
    beatMarks.push(t);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-studio-bg relative">
      <div
        ref={rulerRef}
        onClick={handleRulerClick}
        className="h-12 bg-studio-panel border-b border-studio-border relative overflow-hidden cursor-pointer shrink-0"
        style={{ overflowX: 'hidden' }}
      >
        <div style={{ width: totalWidth, height: '100%', position: 'relative' }}>
          {beatMarks.map((t, i) => {
            const isBar = i % 4 === 0;
            return (
              <div
                key={i}
                className="absolute top-0 flex flex-col items-start"
                style={{ left: t * pixelsPerSecond }}
              >
                <div
                  className="bg-studio-border"
                  style={{
                    width: 1,
                    height: isBar ? '100%' : '50%',
                    opacity: isBar ? 0.8 : 0.4,
                  }}
                />
                {isBar && (
                  <span className="text-[10px] text-gray-500 font-mono ml-1 -mt-12 pt-1 select-none">
                    {formatBars(t, bpm)}
                  </span>
                )}
              </div>
            );
          })}

          {Array.from({ length: Math.ceil(totalWidth / pixelsPerSecond) }).map((_, i) => (
            <div
              key={`sec-${i}`}
              className="absolute bottom-0 text-[9px] text-gray-600 font-mono select-none"
              style={{ left: i * pixelsPerSecond + 2 }}
            >
              {formatTime(i)}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={syncScroll}
        className="flex-1 overflow-auto relative"
      >
        <div
          ref={timelineRef}
          onClick={handleBackgroundClick}
          onDoubleClick={handleDoubleClick}
          style={{ width: totalWidth, height: totalHeight + 200, position: 'relative' }}
          className="bg-studio-bg"
        >
          {tracks.map((track, idx) => (
            <div
              key={track.id}
              className="absolute w-full border-b border-studio-border"
              style={{
                top: idx * trackHeight,
                height: trackHeight,
                background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
              }}
            >
              {beatMarks.map((t, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 bg-studio-border/40"
                  style={{
                    left: t * pixelsPerSecond,
                    width: i % 4 === 0 ? 1 : 0.5,
                    opacity: i % 4 === 0 ? 0.3 : 0.1,
                  }}
                />
              ))}
            </div>
          ))}

          {clips.map((clip) => {
            const track = tracks.find((t) => t.id === clip.trackId);
            if (!track) return null;
            const trackIdx = tracks.indexOf(track);
            const isSelected = selection === clip.id;
            return (
              <div
                key={clip.id}
                onMouseDown={(e) => handleClipMouseDown(e, clip)}
                className={`absolute rounded-lg overflow-hidden cursor-grab active:cursor-grabbing transition-shadow ${
                  isSelected ? 'ring-2 ring-white shadow-2xl z-10' : 'shadow-lg hover:shadow-xl'
                }`}
                style={{
                  left: clip.startTime * pixelsPerSecond,
                  top: trackIdx * trackHeight + 8,
                  width: Math.max(2, clip.duration * pixelsPerSecond),
                  height: trackHeight - 16,
                  backgroundColor: track.color + '33',
                  border: `2px solid ${track.color}`,
                }}
              >
                <div
                  className="h-5 px-2 flex items-center justify-between text-[10px] font-bold text-white truncate"
                  style={{ backgroundColor: track.color }}
                >
                  <span className="truncate">{clip.name}</span>
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClip(clip.id);
                      }}
                      className="bg-black/30 hover:bg-black/60 rounded w-4 h-4 flex items-center justify-center shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex-1 relative bg-black/20" style={{ height: trackHeight - 16 - 20 }}>
                  {clip.waveformData && (
                    <div className="absolute inset-0 flex items-center gap-[1px] px-[2px]">
                      {clip.waveformData.map((v, i) => (
                        <div
                          key={i}
                          className="waveform-bar rounded-full flex-1"
                          style={{
                            height: `${v * 100}%`,
                            backgroundColor: track.color,
                            minWidth: 1,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {!clip.waveformData && clip.isRecording && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-studio-danger rounded-full animate-bounce"
                            style={{
                              height: `${20 + i * 5}px`,
                              animationDelay: `${i * 0.1}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div
            className="absolute top-0 bottom-0 w-[2px] bg-studio-danger pointer-events-none z-20"
            style={{
              left: currentTime * pixelsPerSecond,
              height: '100%',
              boxShadow: '0 0 10px rgba(239,68,68,0.5)',
            }}
          >
            <div
              className="absolute -top-[48px] left-1/2 -translate-x-1/2 bg-studio-danger text-white text-[10px] px-2 py-0.5 rounded font-mono whitespace-nowrap"
            >
              {formatTime(currentTime)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
