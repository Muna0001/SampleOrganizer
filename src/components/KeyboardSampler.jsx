import { useEffect, useRef, useState, useCallback } from 'react';
import useMidi from '../audio/useMidi';

const NOTES = [
  { note: 'C3',  semi: 0,  black: false, key: 'a' },
  { note: 'C#3', semi: 1,  black: true,  key: 'w' },
  { note: 'D3',  semi: 2,  black: false, key: 's' },
  { note: 'D#3', semi: 3,  black: true,  key: 'e' },
  { note: 'E3',  semi: 4,  black: false, key: 'd' },
  { note: 'F3',  semi: 5,  black: false, key: 'f' },
  { note: 'F#3', semi: 6,  black: true,  key: 't' },
  { note: 'G3',  semi: 7,  black: false, key: 'g' },
  { note: 'G#3', semi: 8,  black: true,  key: 'y' },
  { note: 'A3',  semi: 9,  black: false, key: 'h' },
  { note: 'A#3', semi: 10, black: true,  key: 'u' },
  { note: 'B3',  semi: 11, black: false, key: 'j' },
  { note: 'C4',  semi: 12, black: false, key: 'k' },
  { note: 'C#4', semi: 13, black: true,  key: 'o' },
  { note: 'D4',  semi: 14, black: false, key: 'l' },
  { note: 'D#4', semi: 15, black: true,  key: 'p' },
  { note: 'E4',  semi: 16, black: false, key: ';' },
  { note: 'F4',  semi: 17, black: false, key: null },
  { note: 'F#4', semi: 18, black: true,  key: null },
  { note: 'G4',  semi: 19, black: false, key: null },
  { note: 'G#4', semi: 20, black: true,  key: null },
  { note: 'A4',  semi: 21, black: false, key: null },
  { note: 'A#4', semi: 22, black: true,  key: null },
  { note: 'B4',  semi: 23, black: false, key: null },
];

const KEY_TO_NOTE = new Map(
  NOTES.filter((n) => n.key).map((n) => [n.key, n])
);

function KeyboardSampler({ engine, sample }) {
  const [activeKeys, setActiveKeys] = useState(new Set());
  const voiceMap = useRef(new Map()); // note name → voiceId
  const engineRef = useRef(engine);
  const sampleRef = useRef(sample);
  engineRef.current = engine;
  sampleRef.current = sample;

  const noteOn = useCallback(
    (noteObj) => {
      const eng = engineRef.current;
      const smp = sampleRef.current;
      if (!eng || !smp) return;
      const voiceId = eng.playNote(smp.path, noteObj.semi, `kb_${noteObj.note}`);
      voiceMap.current.set(noteObj.note, voiceId);
      setActiveKeys((prev) => new Set(prev).add(noteObj.note));
    },
    []
  );

  const noteOff = useCallback(
    (noteObj) => {
      const eng = engineRef.current;
      if (!eng) return;
      const voiceId = voiceMap.current.get(noteObj.note);
      if (voiceId) {
        eng.stopNote(voiceId);
        voiceMap.current.delete(noteObj.note);
      }
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(noteObj.note);
        return next;
      });
    },
    []
  );

  // MIDI input — C3 (MIDI 48) = semi 0 (original pitch)
  // Allow C1 (MIDI 24) to B5 (MIDI 83) = 2 octaves down to 2 octaves up
  const MIDI_BASE = 48; // C3 = original pitch
  const MIDI_LOW = 24;  // C1
  const MIDI_HIGH = 83; // B5
  const midiVoiceMap = useRef(new Map()); // midiNote → voiceId

  useMidi({
    onNoteOn: (midiNote) => {
      if (midiNote < MIDI_LOW || midiNote > MIDI_HIGH) return;
      const eng = engineRef.current;
      const smp = sampleRef.current;
      if (!eng || !smp) return;
      const semi = midiNote - MIDI_BASE;
      const voiceId = eng.playNote(smp.path, semi, `midi_${midiNote}`);
      if (voiceId) midiVoiceMap.current.set(midiNote, voiceId);
      // Highlight matching on-screen key if it exists
      const noteObj = NOTES.find((n) => n.semi === semi);
      if (noteObj) setActiveKeys((prev) => new Set(prev).add(noteObj.note));
    },
    onPitchBend: (bendAmount) => {
      const eng = engineRef.current;
      if (eng) eng.setPitchBend(bendAmount);
    },
    onNoteOff: (midiNote) => {
      const eng = engineRef.current;
      if (!eng) return;
      const voiceId = midiVoiceMap.current.get(midiNote);
      if (voiceId) {
        eng.stopNote(voiceId);
        midiVoiceMap.current.delete(midiNote);
      }
      const semi = midiNote - MIDI_BASE;
      const noteObj = NOTES.find((n) => n.semi === semi);
      if (noteObj) {
        setActiveKeys((prev) => {
          const next = new Set(prev);
          next.delete(noteObj.note);
          return next;
        });
      }
    },
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      // Don't trigger when typing in inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const noteObj = KEY_TO_NOTE.get(e.key.toLowerCase());
      if (noteObj && !activeKeys.has(noteObj.note)) {
        noteOn(noteObj);
      }
    };

    const handleKeyUp = (e) => {
      const noteObj = KEY_TO_NOTE.get(e.key.toLowerCase());
      if (noteObj) {
        noteOff(noteObj);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [noteOn, noteOff, activeKeys]);

  const whiteNotes = NOTES.filter((n) => !n.black);
  const blackNotes = NOTES.filter((n) => n.black);

  // Compute black key positions based on which white key they follow
  const whiteWidth = 40;
  const getBlackKeyLeft = (note) => {
    // Find the index of the white key to the left of this black key
    const whiteIndex = whiteNotes.findIndex((w) => w.semi === note.semi - 1);
    return whiteIndex * whiteWidth + whiteWidth - 14;
  };

  return (
    <div className="keyboard-container">
      <div className="keyboard-info">
        {sample ? (
          <>Loaded: <strong>{sample.filename}</strong> &mdash; keys A&ndash;; to play</>
        ) : (
          'Select a sample and click [K] to load it here'
        )}
      </div>
      <div className="keyboard-keys">
        {whiteNotes.map((note) => (
          <div
            key={note.note}
            className={`piano-key white ${activeKeys.has(note.note) ? 'active' : ''}`}
            onMouseDown={() => noteOn(note)}
            onMouseUp={() => noteOff(note)}
            onMouseLeave={() => activeKeys.has(note.note) && noteOff(note)}
          >
            <span>{note.key?.toUpperCase() || ''}</span>
          </div>
        ))}
        {blackNotes.map((note) => (
          <div
            key={note.note}
            className={`piano-key black ${activeKeys.has(note.note) ? 'active' : ''}`}
            style={{ left: getBlackKeyLeft(note) }}
            onMouseDown={(e) => { e.stopPropagation(); noteOn(note); }}
            onMouseUp={() => noteOff(note)}
            onMouseLeave={() => activeKeys.has(note.note) && noteOff(note)}
          >
            <span>{note.key?.toUpperCase() || ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default KeyboardSampler;
