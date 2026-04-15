import { useEffect, useRef } from 'react';

// Shared singleton so multiple hook instances (or StrictMode double-mounts)
// don't attach duplicate listeners to the same MIDI inputs.
let midiAccess = null;
let midiSubscribers = new Set();
let midiInputs = [];

function handleMidiMessage(e) {
  if (e.data.length < 2) return;
  const status = e.data[0];
  const note = e.data[1];
  const velocity = e.data.length > 2 ? e.data[2] : 0;
  const command = status & 0xf0;

  for (const sub of midiSubscribers) {
    if (command === 0x90 && velocity > 0) {
      sub.onNoteOn?.(note, velocity);
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      sub.onNoteOff?.(note);
    } else if (command === 0xe0) {
      // Pitch bend: 14-bit value from two 7-bit bytes, centered at 8192
      const bendValue = note | (velocity << 7); // LSB | (MSB << 7)
      const bendNormalized = (bendValue - 8192) / 8192; // -1.0 to +1.0
      sub.onPitchBend?.(bendNormalized);
    }
  }
}

function connectMidiInputs(access) {
  for (const input of midiInputs) {
    input.removeEventListener('midimessage', handleMidiMessage);
  }
  midiInputs = [];
  for (const input of access.inputs.values()) {
    input.addEventListener('midimessage', handleMidiMessage);
    midiInputs.push(input);
  }
}

function initMidi() {
  if (midiAccess) return;
  navigator.requestMIDIAccess?.()
    .then((access) => {
      midiAccess = access;
      connectMidiInputs(access);
      access.onstatechange = () => connectMidiInputs(access);
    })
    .catch(() => {});
}

/**
 * Hook that listens for MIDI input and calls onNoteOn / onNoteOff callbacks.
 * Uses a shared singleton so duplicate listeners are never attached.
 */
export default function useMidi({ onNoteOn, onNoteOff, onPitchBend }) {
  const subRef = useRef({ onNoteOn, onNoteOff, onPitchBend });
  subRef.current.onNoteOn = onNoteOn;
  subRef.current.onNoteOff = onNoteOff;
  subRef.current.onPitchBend = onPitchBend;

  useEffect(() => {
    midiSubscribers.add(subRef.current);
    initMidi();
    return () => {
      midiSubscribers.delete(subRef.current);
    };
  }, []);
}
