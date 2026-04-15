import { useEffect, useState, useCallback, useRef } from 'react';
import useMidi from '../audio/useMidi';

// Pad layout: bottom-left = 1, top-right = 9
// Displayed as:
//   7 8 9
//   4 5 6
//   1 2 3
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DISPLAY_ORDER = [6, 7, 8, 3, 4, 5, 0, 1, 2]; // maps grid position to pad index

function DrumPad({ engine, pads, onPadClick, onClearPad }) {
  const [triggered, setTriggered] = useState(new Set());
  const engineRef = useRef(engine);
  const padsRef = useRef(pads);
  const onPadClickRef = useRef(onPadClick);
  engineRef.current = engine;
  padsRef.current = pads;
  onPadClickRef.current = onPadClick;

  const flash = useCallback((index) => {
    setTriggered((prev) => new Set(prev).add(index));
    setTimeout(() => {
      setTriggered((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 120);
  }, []);

  const handleTrigger = useCallback(
    (index) => {
      if (padsRef.current[index]) {
        engineRef.current?.triggerOneShot(padsRef.current[index].path);
        flash(index);
      } else {
        onPadClickRef.current(index);
      }
    },
    [flash]
  );

  // MIDI input — notes 48–56 (C3–G#3) map to pads 0–8
  const MIDI_DRUM_BASE = 48;
  const midiVoices = useRef(new Map()); // midiNote → voiceId

  const handleMidiNoteOn = useCallback(
    (midiNote) => {
      const padIndex = midiNote - MIDI_DRUM_BASE;
      if (padIndex < 0 || padIndex >= 9) return;
      if (!padsRef.current[padIndex]) {
        onPadClickRef.current(padIndex);
        return;
      }
      const voiceId = engineRef.current?.playNote(padsRef.current[padIndex].path, 0, `midi_pad_${midiNote}`);
      if (voiceId) midiVoices.current.set(midiNote, voiceId);
      setTriggered((prev) => new Set(prev).add(padIndex));
    },
    []
  );

  const handleMidiNoteOff = useCallback(
    (midiNote) => {
      const padIndex = midiNote - MIDI_DRUM_BASE;
      if (padIndex < 0 || padIndex >= 9) return;
      const voiceId = midiVoices.current.get(midiNote);
      if (voiceId) {
        engineRef.current?.stopNote(voiceId);
        midiVoices.current.delete(midiNote);
      }
      setTriggered((prev) => {
        const next = new Set(prev);
        next.delete(padIndex);
        return next;
      });
    },
    []
  );

  useMidi({
    onNoteOn: handleMidiNoteOn,
    onNoteOff: handleMidiNoteOff,
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const padIndex = PAD_KEYS.indexOf(e.key);
      if (padIndex !== -1) {
        handleTrigger(padIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTrigger]);

  return (
    <div className="drumpad-container">
      <div className="drumpad-grid">
        {DISPLAY_ORDER.map((padIndex) => {
          const sample = pads[padIndex];
          const isTriggered = triggered.has(padIndex);

          return (
            <div
              key={padIndex}
              className={`drum-pad ${sample ? 'occupied' : ''} ${isTriggered ? 'triggered' : ''}`}
              onClick={() => handleTrigger(padIndex)}
              onContextMenu={(e) => {
                e.preventDefault();
                onClearPad(padIndex);
              }}
            >
              <span className="pad-number">{padIndex + 1}</span>
              {sample && <span className="pad-filename">{sample.filename}</span>}
              {!sample && <span className="pad-empty">EMPTY</span>}
            </div>
          );
        })}
      </div>
      <div className="drumpad-info">
        <p>Keys 1&ndash;9 to trigger pads</p>
        <p>Select a sample, click empty pad to assign</p>
        <p>Right-click pad to clear</p>
      </div>
    </div>
  );
}

export default DrumPad;
