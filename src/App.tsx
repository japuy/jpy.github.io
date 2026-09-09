import React, { useState, useRef, useCallback } from 'react';
import { TransportBar } from './components/TransportBar';
import { TrackList } from './components/TrackList';
import { Timeline } from './components/Timeline';
import { useAudioEngine } from './useAudioEngine';
import { createDefaultTrack, generateId } from './utils';
import { Track, AudioClip } from './types';

const TRACK_HEIGHT = 90;
const PIXELS_PER_SECOND = 60;

function App() {
  const [tracks, setTracks] = useState<Track[]>([
    { ...createDefaultTrack(0), armed: true },
    createDefaultTrack(1),
    createDefaultTrack(2),
    createDefaultTrack(3),
  ]);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(tracks[0]?.id || null);
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);
  const [library, setLibrary] = useState<{ id: string; name: string; file?: File }[]>([]);
  const [draggedLibraryId, setDraggedLibraryId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(true);

  const importFileInputRef = useRef<HTMLInputElement>(null);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);
  const dragClipDataRef = useRef<{ file: File } | null>(null);

  const engine = useAudioEngine(tracks, clips, setClips, setTracks);

  const handleAddTrack = useCallback(() => {
    setTracks((prev) => [...prev, createDefaultTrack(prev.length)]);
  }, []);

  const handleDeleteTrack = useCallback((id: string) => {
    setTracks((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((t) => t.id !== id);
    });
    setClips((prev) => prev.filter((c) => c.trackId !== id));
  }, []);

  const handleUpdateTrack = useCallback((id: string, updates: Partial<Track>) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const handleArmTrack = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        armed: t.id === id ? !t.armed : false,
      }))
    );
  }, []);

  const handleUpdateClip = useCallback((id: string, updates: Partial<AudioClip>) => {
    setClips((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  const handleDeleteClip = useCallback((id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleToggleRecord = useCallback(() => {
    if (engine.state.isRecording) {
      engine.stopRecording();
      setRecordingTrackId(null);
    } else {
      const armedTrack = tracks.find((t) => t.armed);
      if (!armedTrack) {
        alert('Pilih track terlebih dahulu (klik tombol R pada track)');
        return;
      }
      engine.initAudioContext();
      setRecordingTrackId(armedTrack.id);
      engine.startRecording(armedTrack.id);
    }
  }, [engine, tracks]);

  const handlePlay = useCallback(() => {
    engine.initAudioContext();
    engine.togglePlay();
  }, [engine]);

  const handleStop = useCallback(() => {
    if (engine.state.isRecording) {
      engine.stopRecording();
      setRecordingTrackId(null);
    }
    engine.stopPlayback();
  }, [engine]);

  const handleBpmChange = useCallback((bpm: number) => {
    engine.setState((s) => ({ ...s, bpm: Math.max(40, Math.min(240, bpm || 120)) }));
  }, [engine]);

  const handleImportClick = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  const handleLibraryImportClick = useCallback(() => {
    libraryFileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    engine.initAudioContext();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const targetTrack = selectedTrackId || tracks[0]?.id;
      if (targetTrack) {
        const startTime = engine.state.currentTime + i * 0.1;
        await engine.importAudioFile(file, targetTrack, startTime);
      }
    }
    e.target.value = '';
  }, [engine, selectedTrackId, tracks]);

  const handleAddToLibrary = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems = Array.from(files).map((file) => ({
      id: generateId(),
      name: file.name.replace(/\.[^.]+$/, ''),
      file,
    }));
    setLibrary((prev) => [...prev, ...newItems]);
    e.target.value = '';
  }, []);

  const handleLibraryDragStart = (item: { id: string; file?: File }) => {
    setDraggedLibraryId(item.id);
    if (item.file) {
      dragClipDataRef.current = { file: item.file };
    }
  };

  const handleLibraryDragEnd = () => {
    setDraggedLibraryId(null);
    dragClipDataRef.current = null;
  };

  const handleTimelineDrop = async (trackId: string, time: number) => {
    if (!dragClipDataRef.current?.file) return;
    engine.initAudioContext();
    await engine.importAudioFile(dragClipDataRef.current.file, trackId, time);
    dragClipDataRef.current = null;
    setDraggedLibraryId(null);
  };

  const handleImportToTrack = useCallback((trackId: string, time: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      engine.initAudioContext();
      await engine.importAudioFile(file, trackId, time);
    };
    input.click();
  }, [engine]);

  const handleExport = useCallback(() => {
    const maxClipEnd = clips.reduce(
      (max, c) => Math.max(max, c.startTime + c.duration),
      0
    );
    if (maxClipEnd === 0) {
      alert('Tidak ada audio untuk diekspor. Rekam atau import audio terlebih dahulu.');
      return;
    }
    engine.exportMixdown(maxClipEnd + 2);
  }, [clips, engine]);

  return (
    <div className="h-screen w-screen flex flex-col bg-studio-bg text-white">
      <TransportBar
        state={engine.state}
        isRecording={engine.state.isRecording}
        onPlay={handlePlay}
        onStop={handleStop}
        onRecord={handleToggleRecord}
        onBpmChange={handleBpmChange}
        onExport={handleExport}
        onImportClick={handleImportClick}
        masterVolume={engine.masterVolume}
        onMasterVolumeChange={engine.setMasterVolume}
        masterMeter={engine.masterMeter}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-52 bg-studio-panel border-r border-studio-border flex flex-col shrink-0">
          <div className="h-12 border-b border-studio-border flex items-center px-3 justify-between shrink-0">
            <span className="text-sm font-semibold text-gray-300">LIBRARY</span>
            <button
              onClick={handleLibraryImportClick}
              className="w-7 h-7 rounded bg-studio-bg hover:bg-studio-accent flex items-center justify-center transition-all border border-studio-border hover:border-studio-accent"
              title="Add to Library"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {library.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-8 px-2">
                Tambahkan file audio ke library, lalu drag & drop ke timeline.
              </div>
            )}
            {library.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleLibraryDragStart(item)}
                onDragEnd={handleLibraryDragEnd}
                className={`px-2 py-2 rounded bg-studio-bg border border-studio-border cursor-grab active:cursor-grabbing hover:border-studio-accent transition-all text-xs truncate ${
                  draggedLibraryId === item.id ? 'opacity-50' : ''
                }`}
              >
                🎵 {item.name}
              </div>
            ))}
          </div>

          <div className="border-t border-studio-border p-3 shrink-0">
            <div className="text-xs text-gray-400 mb-2 font-semibold">SHORTCUTS</div>
            <div className="space-y-1 text-[10px] text-gray-500 font-mono">
              <div><span className="text-gray-300">Space</span> = Play/Pause</div>
              <div><span className="text-gray-300">R</span> = Record</div>
              <div><span className="text-gray-300">S</span> = Stop</div>
              <div><span className="text-gray-300">Double-click</span> timeline = Import to track</div>
            </div>
            <button
              onClick={() => setShowHelp(true)}
              className="mt-3 w-full text-xs text-studio-accent hover:text-purple-400 py-1 border border-studio-accent/30 rounded hover:bg-studio-accent/10 transition-all"
            >
              Tunjukkan Panduan
            </button>
          </div>
        </div>

        <TrackList
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          onSelectTrack={setSelectedTrackId}
          onUpdateTrack={handleUpdateTrack}
          onAddTrack={handleAddTrack}
          onDeleteTrack={handleDeleteTrack}
          meterLevels={engine.meterLevels}
          onArmTrack={handleArmTrack}
          isRecording={engine.state.isRecording}
          recordingTrackId={recordingTrackId}
          trackHeight={TRACK_HEIGHT}
        />

        <DropWrapper onDropToTrack={handleTimelineDrop}>
          <Timeline
            tracks={tracks}
            clips={clips}
            currentTime={engine.state.currentTime}
            bpm={engine.state.bpm}
            pixelsPerSecond={PIXELS_PER_SECOND}
            trackHeight={TRACK_HEIGHT}
            onSeek={engine.seekTo}
            onUpdateClip={handleUpdateClip}
            onDeleteClip={handleDeleteClip}
            onImportToTrack={handleImportToTrack}
            isPlaying={engine.state.isPlaying}
          />
        </DropWrapper>
      </div>

      <input
        ref={importFileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleImportFile}
      />
      <input
        ref={libraryFileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleAddToLibrary}
      />

      {showHelp && (
        <HelpModal onClose={() => setShowHelp(false)} />
      )}

      <KeyboardShortcuts
        onPlay={handlePlay}
        onStop={handleStop}
        onRecord={handleToggleRecord}
      />
    </div>
  );
}

const KeyboardShortcuts: React.FC<{
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
}> = ({ onPlay, onStop, onRecord }) => {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        onPlay();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        onStop();
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onRecord();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPlay, onStop, onRecord]);
  return null;
};

interface DropWrapperProps {
  children: React.ReactNode;
  onDropToTrack: (trackId: string, time: number) => void;
}

const DropWrapper: React.FC<DropWrapperProps> = ({ children, onDropToTrack }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timelineStateRef = useRef({ tracks: [] as Track[], pixelsPerSecond: PIXELS_PER_SECOND, trackHeight: TRACK_HEIGHT });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      alert('Gunakan fitur Library + drag drop, atau klik tombol Import di toolbar.');
      return;
    }
  };

  return (
    <div ref={wrapperRef} onDragOver={handleDragOver} onDrop={handleDrop} className="flex-1 flex flex-col overflow-hidden">
      {children}
    </div>
  );
};

const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-studio-panel border border-studio-border rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-studio-accent/30 to-pink-500/20 border-b border-studio-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🎵</div>
            <div>
              <h2 className="text-xl font-bold text-white">Selamat datang di Suno Studio</h2>
              <p className="text-sm text-gray-400">Studio musik digital di browser Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded bg-studio-bg hover:bg-studio-danger flex items-center justify-center transition-all"
          >
            ✕
          </button>
        </div>
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <Section title="🎙️ Cara Merekam Suara">
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300">
              <li>Klik tombol <span className="text-studio-danger font-bold">R</span> pada track yang ingin dijadikan tempat rekaman</li>
              <li>Klik tombol Record (lingkaran merah) di toolbar atas</li>
              <li>Izin akses mikrofin jika diminta</li>
              <li>Rekam suara/instrumen Anda</li>
              <li>Klik Stop untuk mengakhiri. Rekaman akan otomatis muncul di timeline.</li>
            </ol>
          </Section>

          <Section title="📂 Import Audio File">
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
              <li>Klik tombol <span className="text-studio-accent font-bold">Import</span> di toolbar untuk menambahkan ke track yang dipilih</li>
              <li>Atau tambahkan ke panel Library di kiri, lalu <span className="font-bold">drag & drop</span> ke timeline</li>
              <li>Atau <span className="font-bold">double-click</span> pada area timeline di track yang diinginkan</li>
              <li>Format yang didukung: MP3, WAV, OGG, WebM, M4A, dll.</li>
            </ul>
          </Section>

          <Section title="🎚️ Mengatur Track">
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
              <li><span className="font-bold">M</span> (Mute): Membisukan track</li>
              <li><span className="font-bold text-yellow-500">S</span> (Solo): Hanya memainkan track ini</li>
              <li><span className="font-bold text-red-500">R</span> (Record): Arm track untuk perekaman</li>
              <li>Geser slider Volume untuk mengatur volume tiap track</li>
              <li>Drag clip di timeline untuk memindahkan posisi</li>
              <li>Klik clip lalu tombol ✕ untuk menghapus</li>
            </ul>
          </Section>

          <Section title="⌨️ Shortcut Keyboard">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Shortcut k="Space" d="Play / Pause" />
              <Shortcut k="R" d="Mulai / Berhenti Rekam" />
              <Shortcut k="S" d="Stop" />
              <Shortcut k="Klik ruler" d="Pindah posisi playhead" />
            </div>
          </Section>

          <Section title="💾 Export Hasil">
            <p className="text-sm text-gray-300">
              Klik tombol <span className="text-studio-accent font-bold">Export WAV</span> di toolbar untuk mendownload hasil campuran semua track menjadi file WAV stereo.
            </p>
          </Section>
        </div>
        <div className="px-6 py-4 border-t border-studio-border bg-studio-bg flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-studio-accent hover:bg-studio-accent-hover rounded-lg text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all"
          >
            Mulai Buat Musik! 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
    {children}
  </div>
);

const Shortcut: React.FC<{ k: string; d: string }> = ({ k, d }) => (
  <div className="flex items-center gap-2">
    <kbd className="px-2 py-0.5 bg-studio-bg border border-studio-border rounded text-xs font-mono text-studio-accent">{k}</kbd>
    <span className="text-gray-400 text-xs">{d}</span>
  </div>
);

export default App;
