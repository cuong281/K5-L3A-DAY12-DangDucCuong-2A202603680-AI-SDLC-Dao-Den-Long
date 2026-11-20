// Memory probe: RSS / JS heap (MB) after each of 30 nights. Shows the heap is flat (no leak) while RSS drifts with JIT code.
// Usage: node --expose-gc tools/memprobe.js   (compare with: node --expose-gc --lite-mode tools/memprobe.js)
import fs from 'node:fs';
import { Game } from '../src/sim/sim.js';
import { mulberry32 } from '../src/sim/rng.js';
const T = JSON.parse(fs.readFileSync('game.contract.json')).tuning;
const rss = () => { global.gc(); global.gc(); return (process.memoryUsage().rss/1048576).toFixed(1) + '/' + (process.memoryUsage().heapUsed/1048576).toFixed(1); };
const row = [];
for (let i = 0; i < 30; i++) {
  const night = i % 3 + 1; let g = new Game(T, { seed: 7 + i, night }); if (i===0) row.push('start ' + rss());
  const r = mulberry32(i); let mv=[0,0];
  for (let k = 0; k < T[`night${night}_duration_s`]*60 && g.state!=='won' && g.state!=='lost'; k++) { if(k%30===0){const a=r()*6.28;mv=[Math.cos(a),Math.sin(a)];} g.applyFrame({move:mv,jump:r()<.05,dash:r()<.03,pulse:r()<.02,interact:r()<.1}); g.step(); g.snapshot(); }
  g = null; row.push(rss());
}
console.log(row.join(' '));
