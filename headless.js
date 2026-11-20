#!/usr/bin/env node
// Headless runner — Test Contract v1.0
// node headless.js --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out f.jsonl [--snapshot-every n]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from './src/sim/sim.js';
import { validateInputs, validateScenario } from './src/sim/validate.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function fail(msg, code) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) fail(`unexpected argument ${key}`, 1);
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) fail(`missing value for ${key}`, 1);
    a[key.slice(2)] = val;
    i++;
  }
  return a;
}

function intArg(a, name, def) {
  if (a[name] === undefined) {
    if (def === undefined) fail(`--${name} is required`, 1);
    return def;
  }
  if (!/^-?\d+$/.test(a[name])) fail(`--${name} must be an integer`, 1);
  return parseInt(a[name], 10);
}

function readJson(file, kind) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { fail(`cannot read ${kind} file ${file}: ${e.message}`, 2); }
  try { return JSON.parse(text); } catch (e) { fail(`${kind} file is not valid JSON: ${e.message}`, 2); }
}

const args = parseArgs(process.argv.slice(2));
const seed = intArg(args, 'seed');
const night = intArg(args, 'night', 1);
const ticks = intArg(args, 'ticks');
const every = intArg(args, 'snapshot-every', 10);
if (!args.out) fail('--out is required', 1);
if (night !== 1) fail(`night ${night} is not available (only night 1)`, 1);
if (ticks < 0) fail('--ticks must be >= 0', 1);
if (every <= 0) fail('--snapshot-every must be > 0', 1);

let scenario = null;
if (args.scenario) {
  scenario = readJson(args.scenario, 'scenario');
  const err = validateScenario(scenario);
  if (err) fail(`invalid scenario: ${err}`, 2);
}
let frames = [];
if (args.inputs) {
  const inputs = readJson(args.inputs, 'inputs');
  const err = validateInputs(inputs);
  if (err) fail(`invalid inputs: ${err}`, 2);
  frames = inputs.frames;
}

const contract = JSON.parse(fs.readFileSync(path.join(here, 'game.contract.json'), 'utf8'));
const game = new Game(contract.tuning, { seed, scenario });

const lines = [];
const out = (o) => lines.push(JSON.stringify(o));
out(game.snapshot());
let fi = 0;
for (let k = 0; k < ticks && game.state === 'playing'; k++) {
  while (fi < frames.length && frames[fi].tick <= k) game.applyFrame(frames[fi++]);
  for (const ev of game.step()) out(ev);
  if (game.tick % every === 0) out(game.snapshot());
}
out({ type: 'end', ticks: game.tick, state: game.state, score: game.score });

try {
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, lines.join('\n') + '\n');
} catch (e) {
  fail(`cannot write ${args.out}: ${e.message}`, 1);
}
process.exit(0);
