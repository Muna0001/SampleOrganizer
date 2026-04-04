class SamplerEngine {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.bufferCache = new Map();  // path → AudioBuffer
    this.activeVoices = new Map(); // voiceId → { source, gainNode }
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
  }

  async loadSample(samplePath) {
    if (this.bufferCache.has(samplePath)) {
      return this.bufferCache.get(samplePath);
    }

    const response = await fetch(`sample://${samplePath}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.bufferCache.set(samplePath, audioBuffer);
    return audioBuffer;
  }

  /**
   * Play a sample pitched by the given number of semitones.
   * Returns a voiceId that can be passed to stopNote() for sustained playback.
   */
  playNote(samplePath, semitones = 0, voiceId = null) {
    const buffer = this.bufferCache.get(samplePath);
    if (!buffer) return null;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, semitones / 12);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.0;
    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start(0);

    const id = voiceId || `${Date.now()}_${Math.random()}`;
    this.activeVoices.set(id, { source, gainNode });

    source.onended = () => {
      this.activeVoices.delete(id);
    };

    return id;
  }

  /** Stop a sustained voice with a short fade-out. */
  stopNote(voiceId) {
    const voice = this.activeVoices.get(voiceId);
    if (!voice) return;

    const now = this.audioContext.currentTime;
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
    voice.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    voice.source.stop(now + 0.05);
    this.activeVoices.delete(voiceId);
  }

  /** Fire-and-forget playback at original pitch (for drum pads). */
  triggerOneShot(samplePath) {
    this.playNote(samplePath, 0, null);
  }

  dispose() {
    for (const [, voice] of this.activeVoices) {
      try { voice.source.stop(); } catch { /* already stopped */ }
    }
    this.activeVoices.clear();
    this.audioContext.close();
  }
}

export default SamplerEngine;
