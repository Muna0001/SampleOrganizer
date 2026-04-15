import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

function Player({ sample, onPlayingChange }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const bufferRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const animRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Create WaveSurfer (visuals only) and AudioContext once
  useEffect(() => {
    if (!containerRef.current) return;

    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#1e2e27',
      progressColor: '#4ade80',
      cursorColor: '#4ade80',
      height: 48,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: true,
    });

    // Mute WaveSurfer — we handle audio ourselves
    ws.setVolume(0);

    // Allow clicking waveform to seek (but ignore programmatic seeks)
    ws.on('interaction', () => { ws._userSeeking = true; });
    ws.on('seeking', (progress) => {
      if (!ws._userSeeking) return;
      ws._userSeeking = false;
      const buf = bufferRef.current;
      if (!buf) return;
      const seekTime = progress * buf.duration;
      pauseOffsetRef.current = seekTime;
      if (sourceRef.current) {
        _stopSource();
        _startSource(seekTime);
      }
    });

    wsRef.current = ws;
    return () => {
      ws.destroy();
      _stopSource();
      audioCtxRef.current?.close();
    };
  }, []);

  // Load new sample
  useEffect(() => {
    if (!wsRef.current) return;
    _stopSource();
    cancelAnimationFrame(animRef.current);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    onPlayingChange?.(false);
    pauseOffsetRef.current = 0;
    bufferRef.current = null;

    if (!sample) return;

    const url = `sample://${sample.path.replaceAll('#', '%23')}`;

    // Load waveform visuals
    wsRef.current.load(url);

    // Load audio buffer for gapless playback
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((arr) => audioCtxRef.current.decodeAudioData(arr))
      .then((audioBuffer) => {
        bufferRef.current = audioBuffer;
        setDuration(audioBuffer.duration);
        _startSource(0);
        setIsPlaying(true);
        onPlayingChange?.(true);
      })
      .catch(() => {});
  }, [sample]);

  function _startSource(offset) {
    const ctx = audioCtxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) return;

    if (ctx.state === 'suspended') ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(ctx.destination);
    source.start(0, offset);

    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime - offset;

    // Animate waveform progress
    const tick = () => {
      if (!sourceRef.current) return;
      const elapsed = ctx.currentTime - startTimeRef.current;
      const pos = elapsed % buffer.duration;
      setCurrentTime(pos);
      if (wsRef.current) {
        wsRef.current.seekTo(pos / buffer.duration);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }

  function _stopSource() {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    cancelAnimationFrame(animRef.current);
  }

  const togglePlay = () => {
    if (!bufferRef.current) return;

    if (isPlaying) {
      // Pause: save position
      const ctx = audioCtxRef.current;
      const elapsed = ctx.currentTime - startTimeRef.current;
      pauseOffsetRef.current = elapsed % bufferRef.current.duration;
      _stopSource();
      setIsPlaying(false);
      onPlayingChange?.(false);
    } else {
      // Resume from saved position
      _startSource(pauseOffsetRef.current);
      setIsPlaying(true);
      onPlayingChange?.(true);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="player">
      <div className="player-controls">
        <button className="player-play-btn" onClick={togglePlay} disabled={!sample}>
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <div className="player-info">
          <span className="player-filename">
            {sample?.filename || 'No sample selected'}
          </span>
          <span className="player-time">
            {sample ? `${formatTime(currentTime)} / ${formatTime(duration)}` : ''}
          </span>
        </div>
      </div>
      <div className="player-waveform" ref={containerRef} />
    </div>
  );
}

export default Player;
