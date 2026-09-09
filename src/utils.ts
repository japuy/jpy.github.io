import { AudioClip, Track } from './types';

const TRACK_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

let idCounter = 0;

export const generateId = (): string => {
  idCounter++;
  return `${Date.now()}-${idCounter}`;
};

export const getTrackColor = (index: number): string => {
  return TRACK_COLORS[index % TRACK_COLORS.length];
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const formatBars = (seconds: number, bpm: number): string => {
  const secondsPerBeat = 60 / bpm;
  const beats = Math.floor(seconds / secondsPerBeat);
  const bars = Math.floor(beats / 4) + 1;
  const beatInBar = (beats % 4) + 1;
  return `${bars}:${beatInBar}`;
};

export const createDefaultTrack = (index: number): Track => ({
  id: generateId(),
  name: `Track ${index + 1}`,
  color: getTrackColor(index),
  volume: 0.8,
  muted: false,
  solo: false,
  armed: false,
  pan: 0,
});

export const createAudioClip = (
  trackId: string,
  startTime: number,
  audioBuffer: AudioBuffer | null,
  blobUrl?: string,
  waveformData?: number[]
): AudioClip => {
  const duration = audioBuffer ? audioBuffer.duration : 0;
  return {
    id: generateId(),
    name: `Clip ${Date.now()}`,
    trackId,
    startTime,
    duration,
    audioBuffer,
    blobUrl,
    waveformData,
  };
};

export const computeWaveformData = (
  audioBuffer: AudioBuffer,
  samples: number = 200
): number[] => {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / samples);
  const waveform: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = i * blockSize;
    const end = start + blockSize;
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += Math.abs(channelData[j]);
    }
    waveform.push(sum / blockSize);
  }

  const max = Math.max(...waveform, 0.01);
  return waveform.map((v) => Math.min(1, v / max));
};
