// Tiny procedural sound (WebAudio, no asset files). Pentatonic chimes for good
// things, low soft thud for being touched. Render-only: never affects the sim.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

export class Sfx {
  constructor() { this.ctx = null; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { this.ctx = null; }
    }
    this.ctx?.resume?.();
  }
  tone(freq, dur = 0.25, type = 'sine', vol = 0.15, delay = 0) {
    const c = this.ctx;
    if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  pick(n) { this.tone(PENTA[Math.min(PENTA.length - 1, n - 1)], 0.2, 'triangle', 0.12); }
  deposit() { this.tone(392, 0.3, 'triangle', 0.15); }
  lit() { [0, 2, 4, 5].forEach((i, j) => this.tone(PENTA[i], 0.9, 'sine', 0.12, j * 0.09)); }
  pulse() { this.tone(880, 0.35, 'sine', 0.1); this.tone(1318.5, 0.35, 'sine', 0.07, 0.05); }
  hit() { this.tone(110, 0.35, 'sawtooth', 0.12); }
  win() { [0, 2, 4, 5, 7, 9].forEach((i, j) => this.tone(PENTA[i], 1.2, 'sine', 0.1, j * 0.15)); }
  lose() { [4, 2, 0].forEach((i, j) => this.tone(PENTA[i] / 2, 0.8, 'triangle', 0.1, j * 0.25)); }
}
