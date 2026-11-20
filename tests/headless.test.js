// Black-box tests of the headless CLI against Test Contract v1.0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
const writeTmp = (name, obj) => {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return p;
};
function headless(args) {
  const out = path.join(tmp, `out-${Math.random().toString(36).slice(2)}.jsonl`);
  const r = spawnSync(process.execPath, ['headless.js', ...args, '--out', out], { cwd: root, encoding: 'utf8' });
  const lines = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { code: r.status, stderr: r.stderr, lines, raw: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '' };
}
const ex = (n) => path.join(root, 'scenarios', 'contract-example', n);

test('snapshots every N from tick 0, end line last, exit 0', () => {
  const r = headless(['--seed', '1', '--night', '1', '--ticks', '100', '--snapshot-every', '25']);
  assert.equal(r.code, 0);
  assert.deepEqual(r.lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 25, 50, 75, 100]);
  assert.deepEqual(r.lines.at(-1), { type: 'end', ticks: 100, state: 'playing', score: r.lines.at(-1).score });
  for (const s of r.lines.filter((l) => l.type === 'snapshot')) assert.equal(s.sim_tick, s.tick);
});

test('default snapshot-every is 10', () => {
  const r = headless(['--seed', '1', '--night', '1', '--ticks', '30']);
  assert.deepEqual(r.lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 10, 20, 30]);
});

test('contract example: deterministic and byte-identical across runs', () => {
  const args = ['--seed', '42', '--night', '1', '--scenario', ex('scenario.json'), '--inputs', ex('inputs.json'), '--ticks', '600'];
  const a = headless(args), b = headless(args);
  assert.equal(a.code, 0);
  assert.equal(a.raw, b.raw);
  // mote at z=5, pickup 1.0 m, 0.1 m/tick -> reached z>=4 after 40 steps
  assert.ok(a.lines.some((l) => l.name === 'mote_picked' && l.tick === 40));
});

test('full random nights 1-3 are deterministic for the same seed', () => {
  for (const n of ['1', '2', '3']) {
    const args = ['--seed', '123', '--night', n, '--ticks', '5000', '--snapshot-every', '60'];
    assert.equal(headless(args).raw, headless(args).raw);
  }
});

test('v1.1 snapshot shape + night_start event at tick 0', () => {
  for (const n of [1, 2, 3]) {
    const r = headless(['--seed', '4', '--night', String(n), '--ticks', '20']);
    assert.equal(r.code, 0);
    const s = r.lines[0];
    assert.equal(s.night, n);
    assert.deepEqual(Object.keys(s.wind).sort(), ['active', 'dir_deg']);
    for (const k of ['pos', 'vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s', 'flames', 'carried']) assert.ok(k in s.player, k);
    for (const k of ['motes', 'drifters', 'charms', 'shades', 'lanterns']) assert.ok(Array.isArray(s[k]), k);
    for (const m of s.motes) assert.deepEqual(Object.keys(m).sort(), ['id', 'kind', 'pos', 'ttl_s']);
    assert.equal(s.lanterns.length, [0, 5, 6, 7][n]);
    assert.deepEqual(r.lines[1], { type: 'event', tick: 0, name: 'night_start', data: { night: n } });
  }
});

test('--night outside 1..3 -> non-zero exit', () => {
  const r = headless(['--seed', '1', '--night', '4', '--ticks', '10']);
  assert.notEqual(r.code, 0);
  assert.ok(r.stderr.length > 0);
});

test('pause: tick advances, sim_tick and time frozen, state paused', () => {
  const inp = writeTmp('pause.json', { frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 70, pause: true }, { tick: 71, pause: false }] });
  const sc = writeTmp('quiet.json', { random_motes: false, random_shades: false });
  const r = headless(['--seed', '1', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '100', '--snapshot-every', '10']);
  const at = (t) => r.lines.find((l) => l.type === 'snapshot' && l.tick === t);
  assert.equal(at(60).state, 'paused');
  assert.equal(at(60).sim_tick, 10);
  assert.equal(at(100).sim_tick, 40);
  assert.deepEqual(at(100).player.pos, [0, 0, 4]);
  assert.deepEqual(r.lines.filter((l) => l.type === 'event' && l.tick > 0).map((l) => [l.tick, l.name]), [[11, 'paused'], [71, 'resumed']]);
});

test('game over stops the run early with end line', () => {
  const sc = writeTmp('dawn.json', { random_motes: false, random_shades: false, time_left_s: 0.5 });
  const r = headless(['--seed', '1', '--night', '1', '--scenario', sc, '--ticks', '1000']);
  assert.equal(r.code, 0);
  const go = r.lines.find((l) => l.name === 'game_over');
  assert.deepEqual(go, { type: 'event', tick: 30, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.deepEqual(r.lines.at(-1), { type: 'end', ticks: 30, state: 'lost', score: 0 });
});

test('coordinates rounded to 3 decimals', () => {
  const inp = writeTmp('diag.json', { frames: [{ tick: 0, move: [1, 1], cam_yaw_deg: 33 }] });
  const r = headless(['--seed', '1', '--night', '1', '--inputs', inp, '--ticks', '7', '--snapshot-every', '7']);
  const snap = r.lines.find((l) => l.type === 'snapshot' && l.tick === 7);
  for (const v of [...snap.player.pos, ...snap.player.vel]) assert.equal(v, Math.round(v * 1000) / 1000);
});

test('malformed inputs / scenario -> exit code 2 with stderr message', () => {
  const cases = [
    ['--inputs', writeTmp('bad1.json', '{not json')],
    ['--inputs', writeTmp('bad2.json', { frames: [{ tick: 5 }, { tick: 5 }] })],
    ['--inputs', writeTmp('bad3.json', { frames: [{ tick: 0, move: [2, 0] }] })],
    ['--inputs', writeTmp('bad4.json', { frames: [{ tick: 0, pulse: 'yes' }] })],
    ['--inputs', writeTmp('bad5.json', { nope: [] })],
    ['--scenario', writeTmp('bad6.json', { player: { pos: [0, 0] } })],
    ['--scenario', writeTmp('bad7.json', '[]')],
    ['--scenario', writeTmp('bad8.json', { shades: [{ pos: [1, 0, 1], state: 'angry' }] })],
    ['--scenario', writeTmp('bad9.json', { player: { invuln_ticks: -1 } })],
    ['--inputs', writeTmp('bad10.json', { frames: [{ tick: 0, dash: 1 }] })],
  ];
  for (const c of cases) {
    const r = headless(['--seed', '1', '--night', '1', '--ticks', '10', ...c]);
    assert.equal(r.code, 2, `expected exit 2 for ${c[1]}`);
    assert.ok(r.stderr.length > 0);
  }
});

test('missing required args -> non-zero exit', () => {
  const r = spawnSync(process.execPath, ['headless.js', '--night', '1'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
});
