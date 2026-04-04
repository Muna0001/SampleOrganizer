import SampleRow from './SampleRow';

function SampleList({ samples, onPlay, currentSample, isPlaying, onToggleFavorite, onLoadToKeyboard, instrumentOpen }) {
  return (
    <div className="sample-list">
      <div className="sample-list-header">
        <span className="col-fav"></span>
        <span className="col-play"></span>
        <span className="col-name">Name</span>
        <span className="col-pack">Pack</span>
        <span className="col-type">Type</span>
        <span className="col-bpm">BPM</span>
        <span className="col-duration">Duration</span>
        <span className="col-format">Format</span>
      </div>
      <div className="sample-list-body">
        {samples.length === 0 ? (
          <div className="empty-state">
            <p>No samples found</p>
            <p className="empty-hint">Click &ldquo;Scan Library&rdquo; to index your samples</p>
          </div>
        ) : (
          samples.map((sample) => (
            <SampleRow
              key={sample.id}
              sample={sample}
              onPlay={onPlay}
              isActive={currentSample?.id === sample.id}
              isPlaying={currentSample?.id === sample.id && isPlaying}
              onToggleFavorite={onToggleFavorite}
              onLoadToKeyboard={onLoadToKeyboard}
              instrumentOpen={instrumentOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default SampleList;
