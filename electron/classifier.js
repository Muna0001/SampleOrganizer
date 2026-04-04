const TYPE_PATTERNS = {
  kick:       /\b(kick|kik|bd)\b/i,
  snare:      /\b(snare|snr|sd)\b/i,
  hihat:      /\b(hi[\s-]?hat|hh|hat)\b/i,
  clap:       /\b(clap|clp)\b/i,
  cymbal:     /\b(cymbal|crash|ride)\b/i,
  tom:        /\b(tom)\b/i,
  percussion: /\b(perc|percussion|shaker|tambourine|conga|bongo|rim)\b/i,
  bass:       /\b(bass|sub|808)\b/i,
  synth:      /\b(synth|lead|pad|pluck|arp|stab)\b/i,
  vocal:      /\b(vocal|vox|voice|acapella|choir)\b/i,
  fx:         /\b(fx|effect|riser|impact|sweep|transition|whoosh|noise)\b/i,
  keys:       /\b(piano|keys|organ|rhodes|wurlitzer|electric[\s-]?piano)\b/i,
  guitar:     /\b(guitar|gtr|guit)\b/i,
  strings:    /\b(strings|violin|cello|viola|orchestr)/i,
  brass:      /\b(brass|trumpet|horn|trombone|sax)/i,
  loop:       /\b(loop|beat|groove|break)\b/i,
};

function classify(filePath) {
  const searchText = filePath.replace(/[/_-]/g, ' ');

  for (const [type, pattern] of Object.entries(TYPE_PATTERNS)) {
    if (pattern.test(searchText)) {
      return type;
    }
  }

  return 'other';
}

module.exports = { classify };
