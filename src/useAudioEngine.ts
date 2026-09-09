import { useCallback, useRef, useState, useEffect } from 'react';
import { AudioClip, Track, AudioEngineState } from './types';
import { createAudioClip, computeWaveformData, generateId } from './utils';

export const useAudioEngine = (
  tracks: Track[],
  clips: AudioClip[],
  setClips: React.Dispatch<React.SetStateAction<AudioClip[]>>,
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>
) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const trackGainNodesRef = useRef<Map<string, { gain: GainNode; pan: StereoPannerNode; analyser: AnalyserNode }>>(new Map());
  const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTrackIdRef = useRef<string | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  const [state, setState] = useState<AudioEngineState>({
    isPlaying: false,
    isRecording: false,
    isPaused: false,
    currentTime: 0,
    bpm: 120,
    sampleRate: 44100,
  });

  const [masterVolume, setMasterVolume] = useState(0.8);
  const [meterLevels, setMeterLevels] = useState<Record<string, number>>({});
  const [masterMeter, setMasterMeter] = useState(0);

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 44100 });
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.gain.value = masterVolume;
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      masterGainRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, [masterVolume]);

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterVolume;
    }
  }, [masterVolume]);

  const ensureTrackNodes = useCallback((track: Track) => {
    const ctx = initAudioContext();
    if (!trackGainNodesRef.current.has(track.id)) {
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      gain.gain.value = track.muted ? 0 : track.volume;
      pan.pan.value = track.pan;
      gain.connect(pan);
      pan.connect(analyser);
      analyser.connect(masterGainRef.current!);
      trackGainNodesRef.current.set(track.id, { gain, pan, analyser });
    }
    return trackGainNodesRef.current.get(track.id)!;
  }, [initAudioContext]);

  useEffect(() => {
    tracks.forEach((track) => {
      const nodes = trackGainNodesRef.current.get(track.id);
      if (nodes) {
        nodes.gain.gain.value = track.muted ? 0 : track.volume;
        nodes.pan.pan.value = track.pan;
      }
    });

    const soloTracks = tracks.filter((t) => t.solo);
    if (soloTracks.length > 0) {
      tracks.forEach((track) => {
        const nodes = trackGainNodesRef.current.get(track.id);
        if (nodes) {
          nodes.gain.gain.value = track.solo && !track.muted ? track.volume : 0;
        }
      });
    }
  }, [tracks]);

  const stopAllSources = useCallback(() => {
    sourceNodesRef.current.forEach((src) => {
      try { src.stop(); } catch {}
    });
    sourceNodesRef.current.clear();
  }, []);

  const scheduleClipPlayback = useCallback((clip: AudioClip, ctxStartTime: number, offset: number) => {
    if (!clip.audioBuffer || !audioContextRef.current) return;
    const track = tracks.find((t) => t.id === clip.trackId);
    if (!track) return;

    const nodes = ensureTrackNodes(track);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = clip.audioBuffer;
    source.connect(nodes.gain);

    let clipStart = clip.startTime;
    let clipOffset = 0;
    if (clipStart < offset) {
      clipOffset = offset - clipStart;
      clipStart = offset;
    }
    if (clipOffset >= clip.duration) return;

    const when = ctxStartTime + (clipStart - offset);
    try {
      source.start(Math.max(0, when), Math.max(0, clipOffset));
      sourceNodesRef.current.set(clip.id, source);
    } catch (e) {
      console.error('Error scheduling clip:', e);
    }
  }, [tracks, ensureTrackNodes]);

  const startPlayback = useCallback((fromTime?: number) => {
    const ctx = initAudioContext();
    stopAllSources();
    const offset = fromTime ?? pausedAtRef.current;
    const ctxStartTime = ctx.currentTime + 0.05;
    startTimeRef.current = ctxStartTime - offset;

    clips.forEach((clip) => {
      scheduleClipPlayback(clip, ctxStartTime, offset);
    });

    setState((s) => ({ ...s, isPlaying: true, isPaused: false, currentTime: offset }));

    const tick = () => {
      if (!audioContextRef.current) return;
      const currentTime = Math.max(0, audioContextRef.current.currentTime - startTimeRef.current);
      setState((s) => ({ ...s, currentTime }));

      const levels: Record<string, number> = {};
      trackGainNodesRef.current.forEach((nodes, id) => {
        const arr = new Uint8Array(nodes.analyser.frequencyBinCount);
        nodes.analyser.getByteTimeDomainData(arr);
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          const v = (arr[i] - 128) / 128;
          sum += v * v;
        }
        levels[id] = Math.sqrt(sum / arr.length);
      });
      setMeterLevels(levels);

      if (analyserRef.current) {
        const arr = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(arr);
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          const v = (arr[i] - 128) / 128;
          sum += v * v;
        }
        setMasterMeter(Math.sqrt(sum / arr.length));
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, [initAudioContext, stopAllSources, clips, scheduleClipPlayback]);

  const pausePlayback = useCallback(() => {
    stopAllSources();
    cancelAnimationFrame(rafIdRef.current);
    pausedAtRef.current = state.currentTime;
    setState((s) => ({ ...s, isPlaying: false, isPaused: true }));
  }, [stopAllSources, state.currentTime]);

  const stopPlayback = useCallback(() => {
    stopAllSources();
    cancelAnimationFrame(rafIdRef.current);
    pausedAtRef.current = 0;
    setState((s) => ({ ...s, isPlaying: false, isPaused: false, currentTime: 0 }));
    setMeterLevels({});
    setMasterMeter(0);
  }, [stopAllSources]);

  const seekTo = useCallback((time: number) => {
    const wasPlaying = state.isPlaying;
    if (wasPlaying) {
      stopAllSources();
      cancelAnimationFrame(rafIdRef.current);
    }
    pausedAtRef.current = Math.max(0, time);
    setState((s) => ({ ...s, currentTime: Math.max(0, time) }));
    if (wasPlaying) {
      startPlayback(Math.max(0, time));
    }
  }, [state.isPlaying, stopAllSources, startPlayback]);

  const startRecording = useCallback(async (trackId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      let mime = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mime = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mime = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mime = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingTrackIdRef.current = trackId;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const ctx = initAudioContext();
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const waveformData = computeWaveformData(audioBuffer);

        const newClip = createAudioClip(
          recordingTrackIdRef.current!,
          recordingStartTimeRef.current,
          audioBuffer,
          blobUrl,
          waveformData
        );
        setClips((prev) => [...prev, newClip]);

        recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingTrackIdRef.current = null;
      };

      recordingStartTimeRef.current = state.currentTime;
      recorder.start(100);
      setState((s) => ({ ...s, isRecording: true }));

      if (!state.isPlaying) {
        startPlayback();
      }
    } catch (e) {
      console.error('Recording failed:', e);
      alert('Tidak bisa mengakses mikrofon. Pastikan izin mikrofon diizinkan.');
    }
  }, [initAudioContext, setClips, state.currentTime, state.isPlaying, startPlayback]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setState((s) => ({ ...s, isRecording: false }));
    if (state.isPlaying) {
      pausePlayback();
    }
  }, [state.isPlaying, pausePlayback]);

  const importAudioFile = useCallback(async (file: File, trackId: string, startTime: number) => {
    const ctx = initAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const waveformData = computeWaveformData(audioBuffer);
    const blobUrl = URL.createObjectURL(file);
    const clip = createAudioClip(trackId, startTime, audioBuffer, blobUrl, waveformData);
    clip.name = file.name.replace(/\.[^.]+$/, '');
    setClips((prev) => [...prev, clip]);
  }, [initAudioContext, setClips]);

  const exportMixdown = useCallback(async (duration: number): Promise<void> => {
    const ctx = initAudioContext();
    const sampleRate = ctx.sampleRate;
    const length = Math.ceil(duration * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
    const offlineMaster = offlineCtx.createGain();
    offlineMaster.gain.value = masterVolume;
    offlineMaster.connect(offlineCtx.destination);

    tracks.forEach((track) => {
      if (track.muted) return;
      const hasSolo = tracks.some((t) => t.solo);
      if (hasSolo && !track.solo) return;

      const gain = offlineCtx.createGain();
      const pan = offlineCtx.createStereoPanner();
      gain.gain.value = track.volume;
      pan.pan.value = track.pan;
      gain.connect(pan);
      pan.connect(offlineMaster);

      clips
        .filter((c) => c.trackId === track.id && c.audioBuffer)
        .forEach((clip) => {
          const src = offlineCtx.createBufferSource();
          src.buffer = clip.audioBuffer!;
          src.connect(gain);
          src.start(clip.startTime);
        });
    });

    const renderedBuffer = await offlineCtx.startRendering();
    const wav = audioBufferToWav(renderedBuffer);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mixdown-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, [initAudioContext, tracks, clips, masterVolume]);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }, [state.isPlaying, pausePlayback, startPlayback]);

  return {
    state,
    setState,
    masterVolume,
    setMasterVolume,
    meterLevels,
    masterMeter,
    initAudioContext,
    startPlayback,
    pausePlayback,
    stopPlayback,
    seekTo,
    startRecording,
    stopRecording,
    importAudioFile,
    exportMixdown,
    togglePlay,
  };
};

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const bytesPerSec = sampleRate * blockAlign;
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const ab = new ArrayBuffer(bufferLength);
  const view = new DataView(ab);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, bytesPerSec, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return ab;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
