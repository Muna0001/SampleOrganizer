const SAMPLE_TYPES = [
  { id: 'drums', label: 'Drums', types: ['kick', 'snare', 'hihat', 'clap', 'cymbal', 'tom', 'percussion'] },
  { id: 'bass', label: 'Bass', types: ['bass'] },
  { id: 'synth', label: 'Synth', types: ['synth'] },
  { id: 'vocal', label: 'Vocal', types: ['vocal'] },
  { id: 'keys', label: 'Keys', types: ['keys'] },
  { id: 'guitar', label: 'Guitar', types: ['guitar'] },
  { id: 'strings', label: 'Strings', types: ['strings'] },
  { id: 'brass', label: 'Brass', types: ['brass'] },
  { id: 'fx', label: 'FX', types: ['fx'] },
  { id: 'loop', label: 'Loops', types: ['loop'] },
  { id: 'other', label: 'Other', types: ['other'] },
];

function Sidebar({ filters, onFiltersChange, stats }) {
  const handleTypeToggle = (entry) => {
    const allActive = entry.types.every((t) => filters.types.includes(t));
    const newTypes = allActive
      ? filters.types.filter((t) => !entry.types.includes(t))
      : [...new Set([...filters.types, ...entry.types])];
    onFiltersChange({ ...filters, types: newTypes });
  };

  const isTypeActive = (entry) => entry.types.some((t) => filters.types.includes(t));

  const getTypeCount = (entry) => {
    if (!stats?.types) return 0;
    return entry.types.reduce((sum, t) => {
      const found = stats.types.find((s) => s.sample_type === t);
      return sum + (found?.count || 0);
    }, 0);
  };

  return (
    <div className="sidebar">
      {stats?.favorites > 0 && (
        <div className="sidebar-section">
          <button
            className={`fav-filter-btn ${filters.favoritesOnly ? 'active' : ''}`}
            onClick={() => onFiltersChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
          >
            {'\u2605'} FAVORITES
            <span className="type-count">{stats.favorites}</span>
          </button>
        </div>
      )}

      <div className="sidebar-section">
        <label className="sidebar-label">Search</label>
        <input
          type="text"
          className="search-input"
          placeholder="Search samples..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        />
      </div>

      <div className="sidebar-section">
        <label className="sidebar-label">Type</label>
        <div className="type-filters">
          {SAMPLE_TYPES.map((entry) => (
            <button
              key={entry.id}
              className={`type-btn ${isTypeActive(entry) ? 'active' : ''}`}
              onClick={() => handleTypeToggle(entry)}
            >
              {entry.label}
              <span className="type-count">{getTypeCount(entry)}</span>
            </button>
          ))}
        </div>
      </div>

      {stats?.genres?.length > 0 && (
        <div className="sidebar-section">
          <label className="sidebar-label">Genre</label>
          <div className="type-filters">
            {stats.genres.map(({ genre, count }) => (
              <button
                key={genre}
                className={`type-btn ${filters.genres.includes(genre) ? 'active' : ''}`}
                onClick={() => {
                  const active = filters.genres.includes(genre);
                  const newGenres = active
                    ? filters.genres.filter((g) => g !== genre)
                    : [...filters.genres, genre];
                  onFiltersChange({ ...filters, genres: newGenres });
                }}
              >
                {genre}
                <span className="type-count">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <label className="sidebar-label">BPM Range</label>
        <div className="bpm-range">
          <input
            type="number"
            className="bpm-input"
            placeholder="Min"
            min="0"
            max="300"
            value={filters.bpmMin ?? ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, bpmMin: e.target.value ? parseInt(e.target.value) : null })
            }
          />
          <span className="bpm-separator">&mdash;</span>
          <input
            type="number"
            className="bpm-input"
            placeholder="Max"
            min="0"
            max="300"
            value={filters.bpmMax ?? ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, bpmMax: e.target.value ? parseInt(e.target.value) : null })
            }
          />
        </div>
      </div>

      {stats && (
        <div className="sidebar-section stats">
          <label className="sidebar-label">Library</label>
          <p>{stats.total.toLocaleString()} samples indexed</p>
          {stats.bpmRange?.min != null && (
            <p>BPM: {stats.bpmRange.min} &mdash; {stats.bpmRange.max}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
