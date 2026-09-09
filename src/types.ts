export interface AudioClip {
  id: string;
  name: string;
  trackId: string;
  startTime: number;
  duration: number;
  audioBuffer: AudioBuffer | null;
  blobUrl?: string;
  waveformData?: number[];
  isRecording?: boolean;
}

export interface Track {
  id: string;
  name: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  armed: boolean;
  pan: number;
}

export interface AudioEngineState {
  isPlaying: boolean;
  isRecording: boolean;
  isPaused: boolean;
  currentTime: number;
  bpm: number;
  sampleRate: number;
}

export type TransportAction = 'play' | 'pause' | 'stop' | 'record' | 'loop';
