// Procedural sound (WebAudio, no asset files). Render-only: never affects the sim.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

export class Sfx {
  constructor(volume = 0.7) {
    this.ctx = null;
    this.master = null;
    this.volume = volume;
    this.music = null;
  }
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      } catch { this.ctx = null; }
    }
    this.ctx?.resume?.();
  }
  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }
  tone(freq, dur = 0.25, type = 'sine', vol = 0.15, delay = 0, slide = 0) {
    const c = this.ctx;
    if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  noise(dur = 0.4, vol = 0.08, freq = 800) {
    const c = this.ctx;
    if (!c) return;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf;
    f.type = 'bandpass';
    f.frequency.value = freq;
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }
  // night ambience: slow pentatonic arpeggio over a soft drone
  startMusic() {
    if (!this.ctx || this.music) return;
    const notes = [0, 2, 4, 2, 5, 4, 2, 0];
    let i = 0;
    const drone = () => { this.tone(130.81, 4.2, 'sine', 0.03); this.tone(196, 4.2, 'sine', 0.02); };
    drone();
    this.music = setInterval(() => {
      if (i % 8 === 0) drone();
      this.tone(PENTA[notes[i % notes.length]] / 2, 0.9, 'triangle', 0.025);
      i++;
    }, 520);
  }
  stopMusic() {
    clearInterval(this.music);
    this.music = null;
  }
  pick(n) { this.tone(PENTA[Math.min(PENTA.length - 1, Math.max(0, n - 1))], 0.2, 'triangle', 0.12); }
  deposit() { this.tone(392, 0.3, 'triangle', 0.15); }
  lit() { [0, 2, 4, 5].forEach((k, j) => this.tone(PENTA[k], 0.9, 'sine', 0.12, j * 0.09)); }
  pulse() { this.tone(880, 0.35, 'sine', 0.1); this.tone(1318.5, 0.35, 'sine', 0.07, 0.05); }
  hit() { this.tone(110, 0.35, 'sawtooth', 0.12, 0, 0.6); }
  fall() { this.tone(600, 0.8, 'sine', 0.1, 0, 0.2); }
  jump() { this.tone(440, 0.12, 'sine', 0.06, 0, 1.6); }
  dash() { this.noise(0.18, 0.1, 1800); }
  charm() { [5, 7, 9].forEach((k, j) => this.tone(PENTA[k], 0.3, 'sine', 0.08, j * 0.06)); }
  steal() { this.tone(700, 0.3, 'square', 0.04, 0, 0.5); }
  shade() { this.tone(98, 0.7, 'triangle', 0.08, 0, 0.7); }
  wind() { this.noise(1.6, 0.06, 500); }
  out() { this.tone(330, 0.6, 'sine', 0.1, 0, 0.5); }
  tick() { this.tone(1200, 0.06, 'square', 0.04); }
  win() { [0, 2, 4, 5, 7, 9].forEach((k, j) => this.tone(PENTA[k], 1.2, 'sine', 0.1, j * 0.15)); }
  lose() { [4, 2, 0].forEach((k, j) => this.tone(PENTA[k] / 2, 0.8, 'triangle', 0.1, j * 0.25)); }
}
