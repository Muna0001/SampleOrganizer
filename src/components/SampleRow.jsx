function formatDuration(seconds) {
  if (!seconds) return '\u2014';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
}

function SampleRow({ sample, onPlay, isActive, isPlaying, onToggleFavorite, onLoadToKeyboard, instrumentOpen }) {
  const handleDragStart = (e) => {
    e.preventDefault();
    window.electronAPI.startDrag(sample.path);
  };

  return (
    <div
      className={`sample-row ${isActive ? 'active' : ''}`}
      draggable
      onDragStart={handleDragStart}
    >
      <span className="col-fav">
        <button
          className={`fav-btn ${sample.favorite ? 'on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(sample); }}
          title={sample.favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {sample.favorite ? '\u2605' : '\u2606'}
        </button>
      </span>
      <span className="col-play">
        <button className="play-btn" onClick={() => onPlay(sample)}>
          {isPlaying ? '\u25A0' : '\u25B6'}
        </button>
        {instrumentOpen && (
          <button
            className="load-kb-btn"
            title="Load to keyboard"
            onClick={(e) => { e.stopPropagation(); onLoadToKeyboard(sample); }}
          >
            K
          </button>
        )}
      </span>
      <span className="col-name" title={sample.path}>
        {sample.filename}
      </span>
      <span className="col-pack" title={sample.pack || ''}>
        {sample.pack || '\u2014'}
      </span>
      <span className="col-type">
        <span className={`type-badge ${sample.sample_type}`}>
          {sample.sample_type}
        </span>
      </span>
      <span className="col-bpm">{sample.bpm || '\u2014'}</span>
      <span className="col-duration">{formatDuration(sample.duration)}</span>
      <span className="col-format">{sample.format}</span>
    </div>
  );
}

export default SampleRow;
