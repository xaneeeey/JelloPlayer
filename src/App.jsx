import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

// Helper to load a value with backward compatibility from legacy key
const loadStorage = (newKey, oldKey) => {
  try {
    const stored = localStorage.getItem(newKey);
    if (stored) return JSON.parse(stored);
    if (oldKey) {
      const oldStored = localStorage.getItem(oldKey);
      if (oldStored) {
        const parsed = JSON.parse(oldStored);
        localStorage.setItem(newKey, JSON.stringify(parsed));
        localStorage.removeItem(oldKey);
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`Failed to load storage key "${newKey}"`, e);
  }
  return [];
};
import Sidebar from './components/Sidebar/Sidebar';
import MainContent from './components/MainContent/MainContent';
import PlayerBar from './components/PlayerBar/PlayerBar';
import QueuePanel from './components/QueuePanel/QueuePanel';
import './index.css';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Sample the average colour of a small patch on a canvas
const sampleRegion = (ctx, cx, cy, size = 10) => {
  const x = Math.max(0, cx - size / 2);
  const y = Math.max(0, cy - size / 2);
  const data = ctx.getImageData(x, y, size, size).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
};

// Extract a 4-colour palette from corners + center of the thumbnail
const extractPalette = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const SIZE = 60;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const M = SIZE - 1;
      resolve([
        sampleRegion(ctx, M * 0.15, M * 0.15),
        sampleRegion(ctx, M * 0.85, M * 0.15),
        sampleRegion(ctx, M * 0.15, M * 0.85),
        sampleRegion(ctx, M * 0.85, M * 0.85),
      ]);
    };
    img.onerror = () => resolve([
      { r: 30, g: 20, b: 50 }, { r: 20, g: 30, b: 50 },
      { r: 50, g: 20, b: 30 }, { r: 20, g: 50, b: 40 },
    ]);
    img.src = url;
  });

function App() {
  // ── Channel / song state ──────────────────────────────────────────────────
  const [activeChannel, setActiveChannel] = useState(null);
  const [songs, setSongs] = useState([]);          // current view songs
  const [activePlaylist, setActivePlaylist] = useState(null);

  // ── Playback state ────────────────────────────────────────────────────────
  const [currentSong, setCurrentSong] = useState(null);
  const [currentSongIndex, setCurrentSongIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [volume, setVolume] = useState(0.8);

  // ── Queue state ───────────────────────────────────────────────────────────
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(null);
  const [playSource, setPlaySource] = useState('channel'); // 'channel' | 'queue'
  const [showQueuePanel, setShowQueuePanel] = useState(false);

  // ── Playlists (localStorage) ──────────────────────────────────────────────
  const [playlists, setPlaylists] = useState(() => loadStorage('relody-playlists', 'jello-playlists'));

  // ── Favourite channels (localStorage) ────────────────────────────────────
  const [favouriteChannels, setFavouriteChannels] = useState(() => loadStorage('relody-favourites', 'jello-favourites'));

  // ── Refs ──────────────────────────────────────────────────────────────────
  const audioRef = useRef(null);
  const songsRef = useRef(songs);
  const currentSongIndexRef = useRef(currentSongIndex);
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const playSourceRef = useRef(playSource);

  // Ambience refs
  const appRef = useRef(null);
  const paletteRef = useRef([
    { r: 30, g: 20, b: 50 }, { r: 20, g: 30, b: 50 },
    { r: 50, g: 20, b: 30 }, { r: 20, g: 50, b: 40 },
  ]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Initialise audio element once with crossOrigin before any src is set
  if (!audioRef.current) {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;
  }

  // Keep refs in sync
  useEffect(() => { songsRef.current = songs; }, [songs]);
  useEffect(() => { currentSongIndexRef.current = currentSongIndex; }, [currentSongIndex]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { playSourceRef.current = playSource; }, [playSource]);

  // Persist playlists to localStorage
  useEffect(() => {
    localStorage.setItem('relody-playlists', JSON.stringify(playlists));
  }, [playlists]);

  // Persist favourite channels to localStorage
  useEffect(() => {
    localStorage.setItem('relody-favourites', JSON.stringify(favouriteChannels));
  }, [favouriteChannels]);

  // ── Visualiser ────────────────────────────────────────────────────────────
  const setupAnalyser = useCallback(() => {
    if (analyserRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch (e) {
      console.warn('Web Audio setup failed:', e);
    }
  }, []);

  const startVisualizer = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (!appRef.current) return;

    const dataArray = analyserRef.current
      ? new Uint8Array(analyserRef.current.frequencyBinCount)
      : null;

    const tick = () => {
      animFrameRef.current = requestAnimationFrame(tick);
      let bass = 0;
      if (analyserRef.current && dataArray) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 10; i++) sum += dataArray[i];
        bass = sum / (10 * 255);
      }
      const t = Date.now() / 4000;
      const blobs = [
        { x: 20 + Math.sin(t * 0.7)       * 16, y: 30 + Math.cos(t * 0.5)       * 20 },
        { x: 78 + Math.cos(t * 0.55)      * 16, y: 22 + Math.sin(t * 0.75)      * 18 },
        { x: 50 + Math.sin(t * 0.45 + 2)  * 20, y: 78 + Math.cos(t * 0.6)       * 14 },
        { x: 15 + Math.cos(t * 0.5  + 1)  * 12, y: 68 + Math.sin(t * 0.4)       * 20 },
      ];
      const palette = paletteRef.current;
      const alpha  = 0.28 + bass * 0.10;
      const spread = 52  + bass * 12;
      const parts = blobs.map((b, i) => {
        const c = palette[i % palette.length];
        return (
          `radial-gradient(ellipse at ${b.x.toFixed(1)}% ${b.y.toFixed(1)}%, ` +
          `rgba(${c.r},${c.g},${c.b},${alpha.toFixed(2)}) 0%, ` +
          `transparent ${spread.toFixed(0)}%)`
        );
      });
      appRef.current.style.background = [...parts, '#0a0a0f'].join(', ');
    };
    tick();
  }, []);

  const stopVisualizer = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (appRef.current) appRef.current.style.background = '#0a0a0f';
  }, []);

  useEffect(() => {
    if (currentSong) { startVisualizer(); } else { stopVisualizer(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id]);

  useEffect(() => {
    if (isPlaying) {
      setupAnalyser();
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      startVisualizer();
    }
  }, [isPlaying, setupAnalyser, startVisualizer]);

  useEffect(() => {
    if (currentSong?.cover) {
      extractPalette(currentSong.cover).then((palette) => { paletteRef.current = palette; });
    }
  }, [currentSong]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Home screen recommendations ───────────────────────────────────────────
  useEffect(() => {
    if (activeChannel || activePlaylist) return;
    let cancelled = false;
    const fetchHome = async () => {
      const allSongs = playlists.flatMap((pl) => pl.songs);
      let data;
      if (allSongs.length > 0) {
        const sample = [...allSongs]
          .sort(() => Math.random() - 0.5)
          .slice(0, 5)
          .map((s) => s.title);
        const res = await axios.get(`${API_BASE_URL}/recommendations`, {
          params: { titles: sample.join('|') },
        });
        data = res.data;
      } else {
        const res = await axios.get(`${API_BASE_URL}/trending`);
        data = res.data;
      }
      if (!cancelled) setSongs(data);
    };
    fetchHome().catch(console.error);
    return () => { cancelled = true; };
  }, [activeChannel, activePlaylist, playlists]);

  // ── Channel loading ───────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API_BASE_URL}/channels`).catch(() => {});
    // Channels are no longer auto-selected; start at home screen
  }, []);

  const handleSelectChannel = async (channel) => {
    setActiveChannel(channel);
    setActivePlaylist(null);
    try {
      setSongs([]);
      const response = await axios.get(`${API_BASE_URL}/uploads/${channel.id}`);
      setSongs(response.data);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  };

  // ── Playback navigation ───────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (playSourceRef.current === 'queue' && queueRef.current.length > 0) {
      const nextIdx = queueIndexRef.current === null
        ? 0
        : (queueIndexRef.current + 1) % queueRef.current.length;
      setCurrentSong(queueRef.current[nextIdx]);
      setQueueIndex(nextIdx);
      setIsPlaying(true);
    } else {
      const list = songsRef.current;
      const idx = currentSongIndexRef.current;
      if (!list.length) return;
      const nextIdx = idx === null ? 0 : (idx + 1) % list.length;
      setCurrentSong(list[nextIdx]);
      setCurrentSongIndex(nextIdx);
      setIsPlaying(true);
    }
  }, []);

  const handlePrev = useCallback(() => {
    if (playSourceRef.current === 'queue' && queueRef.current.length > 0) {
      const prevIdx = queueIndexRef.current === null
        ? 0
        : (queueIndexRef.current - 1 + queueRef.current.length) % queueRef.current.length;
      setCurrentSong(queueRef.current[prevIdx]);
      setQueueIndex(prevIdx);
      setIsPlaying(true);
    } else {
      const list = songsRef.current;
      const idx = currentSongIndexRef.current;
      if (!list.length) return;
      const prevIdx = idx === null ? 0 : (idx - 1 + list.length) % list.length;
      setCurrentSong(list[prevIdx]);
      setCurrentSongIndex(prevIdx);
      setIsPlaying(true);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    const updateProgress = () => {
      // sanitize duration value before using it
      const durationValue = Number.isFinite(audio.duration) ? audio.duration : 0;
      const progressValue = durationValue > 0
        ? (audio.currentTime / durationValue) * 100
        : 0;
      setProgress(progressValue);
      setCurrentTime(formatTime(audio.currentTime));
      setDuration(formatTime(durationValue));
    };
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleNext);
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleNext);
    };
  }, [handleNext]);

  useEffect(() => {
    if (currentSong) {
      if (audioRef.current.src !== currentSong.audio) {
        audioRef.current.src = currentSong.audio;
        audioRef.current.load();
      }
      if (isPlaying) {
        const p = audioRef.current.play();
        if (p !== undefined) p.catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [currentSong, isPlaying]);

  // sync audio element volume whenever `volume` changes
  useEffect(() => { audioRef.current.volume = volume; }, [volume]);

  const handlePlaySong = (song) => {
    if (currentSong?.id === song.id) {
      setIsPlaying((p) => !p);
    } else {
      const idx = songs.findIndex((s) => s.id === song.id);
      setCurrentSong(song);
      setCurrentSongIndex(idx);
      setPlaySource('channel');
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (val) => {
    setVolume(val);
    audioRef.current.volume = val;
  };

  // ── Queue handlers ────────────────────────────────────────────────────────
  const handleAddToQueue = (song) => {
    setQueue((prev) => {
      const newQueue = [...prev, song];
      if (!currentSong) {
        // Nothing playing — start from this song
        setCurrentSong(song);
        setQueueIndex(newQueue.length - 1);
        setPlaySource('queue');
        setIsPlaying(true);
      }
      return newQueue;
    });
  };

  const handleRemoveFromQueue = (idx) => {
    setQueue((prev) => {
      const newQueue = prev.filter((_, i) => i !== idx);
      setQueueIndex((qi) => {
        if (qi === null) return null;
        if (idx < qi) return qi - 1;
        if (idx === qi && newQueue.length === 0) {
          setPlaySource('channel');
          return null;
        }
        return qi;
      });
      return newQueue;
    });
  };

  const handleShuffleQueue = () => {
    setQueue((prev) => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      if (currentSong) {
        const newIdx = shuffled.findIndex((s) => s.id === currentSong.id);
        setQueueIndex(newIdx >= 0 ? newIdx : 0);
      }
      return shuffled;
    });
  };

  const handlePlayFromQueue = (idx) => {
    setCurrentSong(queue[idx]);
    setQueueIndex(idx);
    setPlaySource('queue');
    setIsPlaying(true);
  };

  const handleClearQueue = () => {
    setQueue([]);
    setQueueIndex(null);
    setPlaySource('channel');
  };

  const handleAddAllToQueue = () => {
    songs.forEach((s) => handleAddToQueue(s));
  };

  // ── Playlist handlers ─────────────────────────────────────────────────────
  const handleCreatePlaylist = (name) => {
    setPlaylists((prev) => [
      ...prev,
      { id: Date.now().toString(), name, songs: [] },
    ]);
  };

  const handleDeletePlaylist = (id) => {
    setPlaylists((prev) => prev.filter((pl) => pl.id !== id));
    if (activePlaylist?.id === id) {
      setActivePlaylist(null);
      setSongs([]);
    }
  };

  const handleOpenPlaylist = (id) => {
    const pl = playlists.find((p) => p.id === id);
    if (!pl) return;
    setActivePlaylist(pl);
    setActiveChannel(null);
    setSongs(pl.songs);
  };

  const handleDropOnPlaylist = (playlistId, song) => {
    setPlaylists((prev) => {
      const next = prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        if (pl.songs.some((s) => s.id === song.id)) return pl; // dedupe
        return { ...pl, songs: [...pl.songs, song] };
      });
      // If this playlist is currently open, refresh the songs view
      if (activePlaylist?.id === playlistId) {
        const updated = next.find((p) => p.id === playlistId);
        if (updated) setSongs(updated.songs);
      }
      return next;
    });
  };

  const handleHome = () => {
    setActiveChannel(null);
    setActivePlaylist(null);
    setSongs([]);
  };

  const handleFavouriteChannel = (channel) => {
    setFavouriteChannels((prev) =>
      prev.some((c) => c.id === channel.id)
        ? prev.filter((c) => c.id !== channel.id)
        : [...prev, { id: channel.id, name: channel.name, thumbnail: channel.thumbnail }]
    );
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = (time) => {
    // guard against NaN/Infinity/negative values
    if (!Number.isFinite(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const currentMode = activePlaylist ? 'playlist' : activeChannel ? 'channel' : 'home';
  const homeTitle = playlists.some((pl) => pl.songs.length > 0)
    ? 'Recommended for You'
    : 'Trending Music';

  return (
    <div className="app-container" ref={appRef}>
      <Sidebar
        onSelectChannel={handleSelectChannel}
        activeChannelId={activeChannel?.id}
        currentSong={currentSong}
        isPlaying={isPlaying}
        playlists={playlists}
        activePlaylistId={activePlaylist?.id}
        onCreatePlaylist={handleCreatePlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onOpenPlaylist={handleOpenPlaylist}
        onDropOnPlaylist={handleDropOnPlaylist}
        onHome={handleHome}
        favouriteChannels={favouriteChannels}
        onFavouriteChannel={handleFavouriteChannel}
      />
      <MainContent
        songs={songs}
        onPlaySong={handlePlaySong}
        onAddToQueue={handleAddToQueue}
        channelName={activePlaylist?.name || activeChannel?.name}
        channelId={activeChannel?.id}
        mode={currentMode}
        onAddAllToQueue={handleAddAllToQueue}
        homeTitle={homeTitle}
      />
      {showQueuePanel && (
        <QueuePanel
          queue={queue}
          queueIndex={queueIndex}
          currentSong={currentSong}
          onClose={() => setShowQueuePanel(false)}
          onPlayFromQueue={handlePlayFromQueue}
          onRemoveFromQueue={handleRemoveFromQueue}
          onShuffle={handleShuffleQueue}
          onClear={handleClearQueue}
        />
      )}
      <PlayerBar
        currentSong={currentSong}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onNext={handleNext}
        onPrev={handlePrev}
        progress={progress}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        onShowQueue={() => setShowQueuePanel((v) => !v)}
      />
    </div>
  );
}

export default App;
