#!/usr/bin/env node
// Soak test (Ticket-04 §2): node tools/soak.js --seed 7 --nights 10 --out soak.json
// Runs N nights in ONE process (night 1 -> 2 -> 3 -> 1 ...), night i (0-based) uses seed + i, each until it ends
// or its standard duration elapses. Random input from the seed: new move direction every 30 ticks; per tick
// 5% jump, 3% dash, 2% pulse, 10% interact. RSS: start = after loading the first night, end = after resetting the last.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game, TICK_HZ } from '../src/sim/sim.js';
import { mulberry32 } from '../src/sim/rng.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const seed = parseInt(args.seed ?? '7', 10);
const nights = parseInt(args.nights ?? '10', 10);
const out = args.out ?? 'soak.json';
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
  process.stderr.write('usage: soak --seed <int> --nights <int> --out <file>\n');
  process.exit(2);
}
const tuning = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8')).tuning;
const rssMb = () => {
  if (global.gc) { global.gc(); global.gc(); }
  return Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
};

const t0 = process.hrtime.bigint();
const results = [];
let crashes = 0, memStart = null, memEnd = null, totalTicks = 0;
for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1;
  const s = seed + i;
  let game = null;
  try {
    game = new Game(tuning, { seed: s, night });
    if (i === 0) memStart = rssMb();
    const rng = mulberry32(s ^ 0x5eed);
    const maxTicks = Math.round(tuning[`night${night}_duration_s`] * TICK_HZ);
    let move = [0, 0];
    for (let k = 0; k < maxTicks && game.state !== 'won' && game.state !== 'lost'; k++) {
      if (k % 30 === 0) {
        const a = rng() * 2 * Math.PI;
        move = [Math.cos(a), Math.sin(a)];
      }
      game.applyFrame({ move, jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.1 });
      game.step();
      if (k % 10 === 0) game.snapshot(); // serialize like the headless runner (default --snapshot-every 10)
      totalTicks++;
    }
    results.push(game.state === 'won' ? 'won' : game.state === 'lost' ? 'lost' : 'timeout');
  } catch (e) {
    crashes++;
    results.push('crash');
    process.stderr.write(`night ${i + 1} crashed: ${e.stack}\n`);
  }
  game = null; // reset
  if (i === nights - 1) memEnd = rssMb();
}
const report = {
  nights,
  crashes,
  results,
  mem_start_mb: memStart,
  mem_end_mb: memEnd,
  duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e7) / 100,
  ticks: totalTicks,
  gc_exposed: !!global.gc,
  pass: crashes === 0 && memEnd <= 1.2 * memStart,
};
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exit(0);
