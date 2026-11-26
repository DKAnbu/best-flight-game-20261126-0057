// sound.js — Procedural Web Audio Engine Synthesizer for Jet Turbines, Cannon & Stall Horn

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineGain = null;
    this.engineOsc = null;
    this.windGain = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Jet turbine synthesized noise
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 450;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.05;

      whiteNoise.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      whiteNoise.start(0);

      // Wind turbulence node
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 300;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.02;

      whiteNoise.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
    } catch {
      // Audio not supported in headless environments
    }
  }

  updateEngine(throttle, speedRatio) {
    if (!this.ctx || !this.engineGain) return;
    try {
      const targetGain = 0.03 + throttle * 0.15;
      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
      if (this.windGain) {
        this.windGain.gain.setTargetAtTime(0.01 + speedRatio * 0.08, this.ctx.currentTime, 0.1);
      }
    } catch {}
  }

  playCannon() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {}
  }

  playBeep(freq = 880, dur = 0.1) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch {}
  }
}
