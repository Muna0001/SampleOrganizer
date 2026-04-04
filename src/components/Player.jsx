import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

function Player({ sample, onPlayingChange }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Create WaveSurfer instance once
  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#005500',
      progressColor: '#33ff33',
      cursorColor: '#33ff33',
      height: 48,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });

    ws.on('play', () => { setIsPlaying(true); onPlayingChange?.(true); });
    ws.on('pause', () => { setIsPlaying(false); onPlayingChange?.(false); });
    ws.on('finish', () => { setIsPlaying(false); onPlayingChange?.(false); });
    ws.on('timeupdate', (time) => setCurrentTime(time));
    ws.on('ready', () => setDuration(ws.getDuration()));

    wsRef.current = ws;
    return () => ws.destroy();
  }, []);

  // Load new sample or stop when cleared
  useEffect(() => {
    if (!wsRef.current) return;
    if (!sample) {
      wsRef.current.stop();
      setIsPlaying(false);
      onPlayingChange?.(false);
      return;
    }
    wsRef.current.load(`sample://${sample.path}`);
    wsRef.current.once('ready', () => wsRef.current.play());
  }, [sample]);

  const togglePlay = () => wsRef.current?.playPause();

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
