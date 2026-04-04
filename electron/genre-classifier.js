const path = require('path');

// Known pack folder names → genre
const PACK_GENRES = {
  'SD_EDM_SamplePack':                        'EDM',
  'SD_PASADENA Pop Sample Pack':              'Pop',
  'SD MIDNIGHT Sample Pack':                  'Trap',
  'SD_VIBRATIONS_SamplePack':                 'Trap',
  'SD_OMNIVOX Vocal Sample Pack':             'Vocal',
  'SD_OMNIVOX_2_Sample_Pack':                 'Vocal',
  'Drum Sounds of the 1980s':                 '80s',
  'Tape Haze VI_48khz 24bit_BlankFor_ms':     'Lo-Fi',
  'Tape Haze VII_48khz 24bit_BlankFor_ms':    'Lo-Fi',
  'BlankFor.ms TH5_48khz 24bit_SamplePack_':  'Lo-Fi',
  'BlankFor.ms_Machines_Sample_Pack_48_24bit': 'Electronic',
  'bird day sample pack':                      'Ambient',
  'jmn :: kitchen percussion':                 'Experimental',
  'TeletoneAudio-PostcardPiano-Loops':         'Lo-Fi',
  'Grooves From Mars':                         'Electronic',
  'Falling Stems':                             'Indie',
};

// Regex patterns matched against the full normalized path
const GENRE_PATTERNS = [
  { pattern: /\bdream\s*pop\b/i,                genre: 'Dream Pop' },
  { pattern: /\b(synth\s*wave|retro\s*wave)\b/i, genre: 'Synthwave' },
  { pattern: /\b(lo[\s-]?fi|lofi)\b/i,          genre: 'Lo-Fi' },
  { pattern: /\bchill\s*wave\b/i,               genre: 'Chillwave' },
  { pattern: /\bambient\b/i,                    genre: 'Ambient' },
  { pattern: /\btrap\b/i,                       genre: 'Trap' },
  { pattern: /\bedm\b/i,                        genre: 'EDM' },
  { pattern: /\bhouse\b/i,                      genre: 'House' },
  { pattern: /\bhip[\s-]?hop\b/i,               genre: 'Hip Hop' },
  { pattern: /\b(rnb|r&b|r\s*n\s*b)\b/i,       genre: 'R&B' },
  { pattern: /\b(dnb|drum\s*(and|&|n)\s*bass)\b/i, genre: 'DnB' },
  { pattern: /\bfunk\b/i,                       genre: 'Funk' },
  { pattern: /\bdisco\b/i,                      genre: 'Disco' },
  { pattern: /\bpop\b/i,                        genre: 'Pop' },
  { pattern: /\b(80s|80'?s|1980)\b/i,           genre: '80s' },
  { pattern: /\bdrill\b/i,                      genre: 'Drill' },
  { pattern: /\bjazz\b/i,                       genre: 'Jazz' },
  { pattern: /\bafro\s*beat\b/i,                genre: 'Afrobeat' },
  { pattern: /\bindie\b/i,                      genre: 'Indie' },
  { pattern: /\bacoustic\b/i,                   genre: 'Acoustic' },
  { pattern: /\bdancehall\b/i,                  genre: 'Dancehall' },
  { pattern: /\btropical\b/i,                   genre: 'Tropical' },
  { pattern: /\bfuture\s*bass\b/i,              genre: 'Future Bass' },
  { pattern: /\bsoul\b/i,                       genre: 'Soul' },
];

function classifyGenre(filePath, rootDir) {
  const relative = path.relative(rootDir, filePath);
  const parts = relative.split(path.sep);

  // Layer 1: check pack folder name against known map
  if (parts.length > 1) {
    const packName = parts[0];
    if (PACK_GENRES[packName]) return PACK_GENRES[packName];
  }

  // Layer 2: regex patterns on the full path (normalized)
  const searchText = filePath.replace(/[/_-]/g, ' ');
  for (const { pattern, genre } of GENRE_PATTERNS) {
    if (pattern.test(searchText)) return genre;
  }

  return null;
}

module.exports = { classifyGenre };
