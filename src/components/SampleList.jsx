import SampleRow from './SampleRow';

function SampleList({ samples, onPlay, currentSample, isPlaying, onToggleFavorite, onLoadToKeyboard, instrumentOpen, sortKey, sortDir, onSort }) {
  const SortHeader = ({ label, field, className }) => {
    const active = sortKey === field;
    return (
      <span className={`${className} sortable-col`} onClick={() => onSort(field)}>
        {label}
        <span className="sort-icon">
          {active ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25B4'}
        </span>
      </span>
    );
  };

  return (
    <div className="sample-list">
      <div className="sample-list-header">
        <span className="col-fav"></span>
        <span className="col-play"></span>
        <SortHeader label="Name" field="filename" className="col-name" />
        <span className="col-pack">Pack</span>
        <SortHeader label="Type" field="sample_type" className="col-type" />
        <SortHeader label="BPM" field="bpm" className="col-bpm" />
        <SortHeader label="Duration" field="duration" className="col-duration" />
        <SortHeader label="Format" field="format" className="col-format" />
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
