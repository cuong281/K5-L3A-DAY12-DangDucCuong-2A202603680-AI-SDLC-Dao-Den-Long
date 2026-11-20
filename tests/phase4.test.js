// Phase 4 (Ticket-04): leaderboard rules + export, bench scene + frame stats, soak runner, contract v1.3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validName, makeEntry, addEntry, exportLeaderboard, isoWithOffset } from '../src/leaderboard.js';
import { makeBenchGame, benchCamera, frameStats, BENCH } from '../src/sim/benchScene.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));
const T = contract.tuning;

test('contract v1.3 declares bench_cmd and soak_cmd (and keeps v1.2 tuning)', () => {
  assert.equal(contract.contract_version, '1.3');
  assert.ok(contract.bench_cmd && contract.soak_cmd && contract.run_cmd && contract.headless_cmd);
  assert.equal(T.fuel_max, 100);
  assert.equal(T.night1_duration_s, 240);
});

test('leaderboard names: 3-12 of [A-Za-z0-9_], Vietnamese letters accepted', () => {
  for (const ok of ['May', 'abc_123', 'ABCDEFGHIJKL', 'Mây_đẹp', 'Đăng']) assert.ok(validName(ok), ok);
  for (const bad of ['ab', 'ABCDEFGHIJKLM', 'a b c', 'x-y-z', '', 'tên!']) assert.ok(!validName(bad), bad);
});

test('leaderboard: score desc, ties -> earlier first, top 10 only', () => {
  let list = [];
  const e = (name, score, t) => makeEntry({ name, score, nights_won: 1, seed: 1, achieved_at: `2026-11-20T10:00:${String(t).padStart(2, '0')}+07:00` });
  list = addEntry(list, e('late', 500, 30));
  list = addEntry(list, e('early', 500, 10));
  list = addEntry(list, e('top', 900, 50));
  for (let i = 0; i < 10; i++) list = addEntry(list, e(`p${i}xx`, 10 * i, 0));
  assert.equal(list.length, 10);
  assert.deepEqual(list.slice(0, 3).map((x) => x.name), ['top', 'early', 'late']);
  assert.deepEqual(Object.keys(list[0]).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
  assert.match(isoWithOffset(), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.throws(() => makeEntry({ name: 'ok_name', score: 1, nights_won: 4, seed: 1 }));
});

test('play.js --export-leaderboard writes {"entries": [...]} sorted from the disk file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-lb-'));
  const entries = [
    makeEntry({ name: 'bbb', score: 100, nights_won: 1, seed: 3, achieved_at: '2026-11-20T10:00:00+07:00' }),
    makeEntry({ name: 'aaa', score: 300, nights_won: 3, seed: 4, achieved_at: '2026-11-20T11:00:00+07:00' }),
  ];
  fs.writeFileSync(path.join(dir, 'leaderboard.json'), JSON.stringify({ entries }));
  const out = path.join(dir, 'out.json');
  const r = spawnSync(process.execPath, ['play.js', '--export-leaderboard', out], { cwd: root, env: { ...process.env, DDL_DATA_DIR: dir }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), exportLeaderboard(entries));
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')).entries.map((x) => x.name), ['aaa', 'bbb']);
});

test('bench scene: exactly 200 wander shades, 100 motes, L1-L3 lit fuel 100; no damage/pickup/decay/end', () => {
  const g = makeBenchGame(T, 42);
  const s = g.snapshot();
  assert.equal(s.shades.length, BENCH.SHADES);
  assert.ok(s.shades.every((x) => x.state === 'wander' || x.state === 'chase'));
  assert.equal(s.motes_active, BENCH.MOTES);
  assert.deepEqual(s.lanterns.slice(0, 3).map((l) => [l.lit, l.fuel]), [[true, 100], [true, 100], [true, 100]]);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  for (let i = 0; i < 60 * 60; i++) g.step();
  const e = g.snapshot();
  assert.equal(e.state, 'playing');
  assert.equal(e.shades.length, 200, 'no spawns');
  assert.equal(e.motes_active, 100, 'no pickup');
  assert.equal(e.player.flames, T.flames, 'no damage');
  assert.equal(e.lanterns[0].fuel, 100, 'no fuel decay');
  assert.deepEqual(makeBenchGame(T, 42).snapshot(), makeBenchGame(T, 42).snapshot(), 'deterministic from the seed');
});

test('bench camera: (30,15,0) at t=0, counter-clockwise (toward +Z), 15 s per lap', () => {
  const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} vs ${b}`));
  near(benchCamera(0), [30, 15, 0]);
  near(benchCamera(3.75), [0, 15, 30]);
  near(benchCamera(15), [30, 15, 0]);
});

test('frame stats follow the Ticket-04 definitions', () => {
  const dts = [...Array(198).fill(10), 40, 50]; // 200 frames
  const s = frameStats(dts);
  assert.equal(s.frames, 200);
  assert.ok(Math.abs(s.avg_fps - (1000 * 200) / (198 * 10 + 90)) < 1e-9);
  assert.ok(Math.abs(s.p1_low_fps - 1000 / 45) < 1e-9); // k = ceil(0.01*200) = 2 worst: 40, 50
  assert.equal(s.frame_ms_p95, 10);
});

test('soak runner: 2 nights, no crash, writes the documented fields', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-soak-')), 'soak.json');
  const cmd = contract.soak_cmd.split(' ');
  const r = spawnSync(cmd[0] === 'node' ? process.execPath : cmd[0], [...cmd.slice(1), '--seed', '7', '--nights', '2', '--out', out], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.nights, 2);
  assert.equal(j.crashes, 0);
  assert.equal(j.results.length, 2);
  for (const k of ['mem_start_mb', 'mem_end_mb', 'duration_s']) assert.equal(typeof j[k], 'number', k);
});
