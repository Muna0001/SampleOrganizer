const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { classify } = require('./classifier');
const { classifyGenre } = require('./genre-classifier');

const AUDIO_EXTENSIONS = new Set([
  '.wav', '.aiff', '.aif', '.mp3', '.flac', '.ogg', '.m4a', '.wma', '.aac',
]);

function collectAudioFiles(dirPath, results) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      collectAudioFiles(fullPath, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }
}

function extractBpmFromFilename(filename) {
  const match = filename.match(/(\d{2,3})\s*bpm/i);
  if (match) {
    const bpm = parseInt(match[1]);
    if (bpm >= 40 && bpm <= 300) return bpm;
  }
  return null;
}

function extractPack(filePath, rootDir) {
  const relative = path.relative(rootDir, filePath);
  const parts = relative.split(path.sep);
  return parts.length > 1 ? parts[0] : null;
}

function computeContentHash(filePath, fileSize) {
  const CHUNK = 8192;
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(Math.min(CHUNK, fileSize));
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);

  const hash = crypto.createHash('md5');
  hash.update(buf);
  hash.update(String(fileSize));
  return hash.digest('hex');
}

async function scanDirectory(dirPath, onProgress, db) {
  const files = [];
  collectAudioFiles(dirPath, files);

  const total = files.length;
  let processed = 0;

  const { parseFile } = await import('music-metadata');

  for (const filePath of files) {
    try {
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const filename = path.basename(filePath);
      const directory = path.dirname(filePath);
      const pack = extractPack(filePath, dirPath);
      const genre = classifyGenre(filePath, dirPath);
      const contentHash = computeContentHash(filePath, stat.size);

      let metadata = {};
      try {
        metadata = await parseFile(filePath, { duration: true, skipCovers: true });
      } catch {
        // Some files may not have parseable metadata
      }

      const bpm = metadata?.common?.bpm || extractBpmFromFilename(filename);
      const key = metadata?.common?.key || null;
      const duration = metadata?.format?.duration || null;
      const sampleRate = metadata?.format?.sampleRate || null;
      const channels = metadata?.format?.numberOfChannels || null;
      const sampleType = classify(filePath);

      db.upsertSample({
        path: filePath,
        filename,
        directory,
        pack,
        genre,
        contentHash,
        format: ext.slice(1),
        duration,
        sampleRate,
        channels,
        bpm,
        key,
        sampleType,
        size: stat.size,
        modifiedAt: Math.floor(stat.mtimeMs),
      });
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err.message);
    }

    processed++;
    if (onProgress && processed % 25 === 0) {
      onProgress({ processed, total });
    }
  }

  if (onProgress) onProgress({ processed: total, total });
  return { processed, total };
}

module.exports = { scanDirectory };
