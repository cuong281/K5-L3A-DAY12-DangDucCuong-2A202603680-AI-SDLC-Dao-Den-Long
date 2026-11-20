// Standard benchmark scene (Ticket-04 §1): Night 1, exactly 200 wander shades and 100 motes spread
// uniformly over the island from the seed, L1–L3 lit with fuel 100, Mây idle at (0,0,0).
// Spawns, damage, pickup, fuel decay and end conditions are disabled via Game({ bench: true }).
import { Game } from './sim.js';
import { mulberry32 } from './rng.js';

export const BENCH = { SHADES: 200, MOTES: 100, R: 38, CAM_R: 30, CAM_Y: 15, CAM_PERIOD_S: 15, WARMUP_S: 3 };

export function benchScenario(seed = 42) {
  const r = mulberry32(seed);
  const spot = () => {
    const a = r() * 2 * Math.PI, d = BENCH.R * Math.sqrt(r());
    return [d * Math.cos(a), d * Math.sin(a)];
  };
  const shades = [], motes = [];
  for (let i = 0; i < BENCH.SHADES; i++) { const [x, z] = spot(); shades.push({ id: `S${i + 1}`, pos: [x, 1, z], state: 'wander' }); }
  for (let i = 0; i < BENCH.MOTES; i++) { const [x, z] = spot(); motes.push([x, 0, z]); }
  return {
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    player: { pos: [0, 0, 0] },
    shades, motes,
    lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
  };
}

export function makeBenchGame(tuning, seed = 42) {
  return new Game(tuning, { seed, night: 1, scenario: benchScenario(seed), bench: true });
}

// camera: circle centre (0,0,0), radius 30, Y 15, starts at angle 0 = (30,15,0),
// counter-clockwise seen from above (angle from +X toward +Z, as the map convention), 15 s per lap
export function benchCamera(tSeconds) {
  const a = (2 * Math.PI * tSeconds) / BENCH.CAM_PERIOD_S;
  return [BENCH.CAM_R * Math.cos(a), BENCH.CAM_Y, BENCH.CAM_R * Math.sin(a)];
}

// stats exactly as defined in Ticket-04 §1 (dt in ms)
export function frameStats(dts) {
  const n = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  return {
    frames: n,
    avg_fps: n ? (1000 * n) / sum : 0,
    p1_low_fps: n ? 1000 / (worst.reduce((a, b) => a + b, 0) / k) : 0,
    frame_ms_p95: n ? p95 : 0,
  };
}
