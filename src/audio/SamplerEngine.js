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

    const response = await fetch(`sample://${samplePath.replaceAll('#', '%23')}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.bufferCache.set(samplePath, audioBuffer);
    return audioBuffer;
  }

  playNote(samplePath, semitones = 0, voiceId = null) {
    const buffer = this.bufferCache.get(samplePath);
    if (!buffer) return null;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const id = voiceId || `${Date.now()}_${Math.random()}`;
    this._killVoice(id);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, semitones / 12);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.0;
    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    const voice = { source, gainNode, semitones };
    this.activeVoices.set(id, voice);

    source.onended = () => {
      if (this.activeVoices.get(id) === voice) {
        this.activeVoices.delete(id);
      }
    };

    source.start(0);
    return id;
  }

  _killVoice(voiceId) {
    const voice = this.activeVoices.get(voiceId);
    if (!voice) return;
    try { voice.source.stop(); } catch { /* already stopped */ }
    voice.gainNode.disconnect();
    this.activeVoices.delete(voiceId);
  }

  stopNote(voiceId) {
    const voice = this.activeVoices.get(voiceId);
    if (!voice) return;

    const now = this.audioContext.currentTime;
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
    voice.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    voice.source.stop(now + 0.06);
    this.activeVoices.delete(voiceId);
  }

  setPitchBend(bendAmount, rangeSemitones = 2) {
    const bendSemitones = bendAmount * rangeSemitones;
    for (const [, voice] of this.activeVoices) {
      voice.source.playbackRate.value = Math.pow(2, (voice.semitones + bendSemitones) / 12);
    }
  }

  triggerOneShot(samplePath) {
    this.playNote(samplePath, 0, null);
  }

  dispose() {
    for (const [id] of this.activeVoices) {
      this._killVoice(id);
    }
    this.activeVoices.clear();
    this.audioContext.close();
  }
}

export default SamplerEngine;
