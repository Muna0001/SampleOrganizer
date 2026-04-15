const Database = require('better-sqlite3');

let db;

function initDatabase(dbPath) {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      filename TEXT NOT NULL,
      directory TEXT NOT NULL,
      pack TEXT,
      genre TEXT,
      content_hash TEXT,
      is_duplicate INTEGER DEFAULT 0,
      favorite INTEGER DEFAULT 0,
      format TEXT,
      duration REAL,
      sample_rate INTEGER,
      channels INTEGER,
      bpm REAL,
      musical_key TEXT,
      sample_type TEXT,
      tags TEXT DEFAULT '[]',
      size INTEGER,
      modified_at INTEGER,
      indexed_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sample_type ON samples(sample_type);
    CREATE INDEX IF NOT EXISTS idx_bpm ON samples(bpm);
    CREATE INDEX IF NOT EXISTS idx_filename ON samples(filename);
  `);

  // Migrate older schemas — add columns first, then create their indexes
  const cols = db.prepare("PRAGMA table_info(samples)").all().map(c => c.name);
  if (!cols.includes('pack')) {
    db.exec("ALTER TABLE samples ADD COLUMN pack TEXT");
  }
  if (!cols.includes('genre')) {
    db.exec("ALTER TABLE samples ADD COLUMN genre TEXT");
  }
  if (!cols.includes('content_hash')) {
    db.exec("ALTER TABLE samples ADD COLUMN content_hash TEXT");
    db.exec("ALTER TABLE samples ADD COLUMN is_duplicate INTEGER DEFAULT 0");
  }
  if (!cols.includes('favorite')) {
    db.exec("ALTER TABLE samples ADD COLUMN favorite INTEGER DEFAULT 0");
  }

  // Create indexes for all columns (safe now that migrations ran)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pack ON samples(pack);
    CREATE INDEX IF NOT EXISTS idx_genre ON samples(genre);
    CREATE INDEX IF NOT EXISTS idx_content_hash ON samples(content_hash);
  `);

  return db;
}

function upsertSample(sample) {
  const stmt = db.prepare(`
    INSERT INTO samples (path, filename, directory, pack, genre, content_hash, format, duration, sample_rate, channels, bpm, musical_key, sample_type, size, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      filename = excluded.filename,
      pack = excluded.pack,
      genre = excluded.genre,
      content_hash = excluded.content_hash,
      duration = excluded.duration,
      sample_rate = excluded.sample_rate,
      channels = excluded.channels,
      bpm = excluded.bpm,
      musical_key = excluded.musical_key,
      sample_type = excluded.sample_type,
      size = excluded.size,
      modified_at = excluded.modified_at
  `);

  return stmt.run(
    sample.path, sample.filename, sample.directory, sample.pack, sample.genre,
    sample.contentHash, sample.format, sample.duration, sample.sampleRate,
    sample.channels, sample.bpm, sample.key, sample.sampleType, sample.size,
    sample.modifiedAt
  );
}

function markDuplicates() {
  // Reset all duplicate flags
  db.prepare('UPDATE samples SET is_duplicate = 0').run();

  // Find content hashes that appear more than once
  const dupes = db.prepare(`
    SELECT content_hash, COUNT(*) as cnt
    FROM samples
    WHERE content_hash IS NOT NULL
    GROUP BY content_hash
    HAVING cnt > 1
  `).all();

  const markStmt = db.prepare('UPDATE samples SET is_duplicate = 1 WHERE id = ?');

  for (const { content_hash } of dupes) {
    const group = db.prepare(
      'SELECT id, path FROM samples WHERE content_hash = ? ORDER BY path ASC'
    ).all(content_hash);

    // Prefer paths containing /samples/, then shorter paths
    group.sort((a, b) => {
      const aInSamples = a.path.includes('/samples/') ? 0 : 1;
      const bInSamples = b.path.includes('/samples/') ? 0 : 1;
      if (aInSamples !== bInSamples) return aInSamples - bInSamples;
      return a.path.length - b.path.length;
    });

    // Mark all except the preferred (first) as duplicate
    for (let i = 1; i < group.length; i++) {
      markStmt.run(group[i].id);
    }
  }
}

function getSamples(filters = {}) {
  let query = 'SELECT * FROM samples WHERE is_duplicate = 0';
  const params = [];

  if (filters.search) {
    query += ' AND (filename LIKE ? OR path LIKE ? OR pack LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  if (filters.types && filters.types.length > 0) {
    query += ` AND sample_type IN (${filters.types.map(() => '?').join(',')})`;
    params.push(...filters.types);
  }

  if (filters.genres && filters.genres.length > 0) {
    query += ` AND genre IN (${filters.genres.map(() => '?').join(',')})`;
    params.push(...filters.genres);
  }

  if (filters.favoritesOnly) {
    query += ' AND favorite = 1';
  }

  if (filters.bpmMin != null) {
    query += ' AND bpm >= ?';
    params.push(filters.bpmMin);
  }

  if (filters.bpmMax != null) {
    query += ' AND bpm <= ?';
    params.push(filters.bpmMax);
  }

  query += ' ORDER BY filename ASC LIMIT 1000';

  return db.prepare(query).all(...params);
}

function toggleFavorite(id) {
  db.prepare('UPDATE samples SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
  return db.prepare('SELECT favorite FROM samples WHERE id = ?').get(id);
}

function updateTags(id, tags) {
  return db.prepare('UPDATE samples SET tags = ? WHERE id = ?').run(JSON.stringify(tags), id);
}

function getStats() {
  return {
    total: db.prepare('SELECT COUNT(*) as count FROM samples WHERE is_duplicate = 0').get().count,
    types: db.prepare('SELECT sample_type, COUNT(*) as count FROM samples WHERE is_duplicate = 0 GROUP BY sample_type ORDER BY count DESC').all(),
    genres: db.prepare('SELECT genre, COUNT(*) as count FROM samples WHERE is_duplicate = 0 AND genre IS NOT NULL GROUP BY genre ORDER BY count DESC').all(),
    favorites: db.prepare('SELECT COUNT(*) as count FROM samples WHERE is_duplicate = 0 AND favorite = 1').get().count,
    bpmRange: db.prepare('SELECT MIN(bpm) as min, MAX(bpm) as max FROM samples WHERE is_duplicate = 0 AND bpm IS NOT NULL').get(),
  };
}

module.exports = { initDatabase, upsertSample, markDuplicates, getSamples, toggleFavorite, updateTags, getStats };
