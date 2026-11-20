// Unit tests for the pure sim. Expected values are derived from game.contract.json tuning,
// so they stay correct if tuning numbers change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game, TICK_HZ } from '../src/sim/sim.js';

const T = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url))).tuning;
const empty = (extra = {}) => ({ random_motes: false, random_shades: false, motes: [], shades: [], ...extra });
const run = (g, n, frame) => {
  const evs = [];
  if (frame) g.applyFrame(frame);
  for (let i = 0; i < n && g.state === 'playing'; i++) evs.push(...g.step());
  return evs;
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('tick 0 snapshot: player at origin, 5 lanterns, playing', () => {
  const s = new Game(T, { seed: 1 }).snapshot();
  assert.equal(s.tick, 0);
  assert.equal(s.state, 'playing');
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.equal(s.player.flames, T.flames);
  assert.equal(s.lanterns.length, T.lantern_count_night1);
  assert.equal(s.time_left_s, T.night1_duration_s);
});

test('move [0,1] yaw 0 for 60 ticks travels player_speed metres along +Z', () => {
  const g = new Game(T, { scenario: empty() });
  run(g, 60, { move: [0, 1] });
  near(g.player.pos[2], T.player_speed);
  near(g.player.pos[0], 0);
});

test('cam yaw 90: move [0,1] goes +X; move [1,0] goes -Z', () => {
  const g = new Game(T, { scenario: empty() });
  run(g, 60, { move: [0, 1], cam_yaw_deg: 90 });
  near(g.player.pos[0], T.player_speed);
  near(g.player.pos[2], 0);
  const h = new Game(T, { scenario: empty() });
  run(h, 60, { move: [1, 0], cam_yaw_deg: 90 });
  near(h.player.pos[2], -T.player_speed);
});

test('diagonal move [1,1] is normalized to speed', () => {
  const g = new Game(T, { scenario: empty() });
  run(g, 60, { move: [1, 1] });
  near(Math.hypot(g.player.pos[0], g.player.pos[2]), T.player_speed);
});

test('pickup within pickup_radius, event carries count, score per_mote', () => {
  const g = new Game(T, { scenario: empty({ motes: [[T.pickup_radius, 0, 0]] }) });
  const evs = run(g, 1);
  assert.deepEqual(evs.map((e) => [e.tick, e.name, e.data.carried]), [[1, 'mote_picked', 1]]);
  assert.equal(g.score, T.score.per_mote);
  assert.equal(g.motes.length, 0);
});

test('mote just outside pickup_radius is not picked', () => {
  const g = new Game(T, { scenario: empty({ motes: [[T.pickup_radius + 0.01, 0, 0]] }) });
  assert.equal(run(g, 1).length, 0);
});

test('carry_capacity limits pickups', () => {
  const g = new Game(T, { scenario: empty({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] }) });
  assert.equal(run(g, 1).length, 0);
  assert.equal(g.player.carried, T.carry_capacity);
});

test('interact deposits, lantern lit at lantern_cost, score per_lantern', () => {
  const g = new Game(T, { scenario: empty({ player: { carried: T.lantern_cost + 2 }, lanterns: [{ id: 'L1', pos: [T.interact_radius, 0, 0] }] }) });
  const evs = run(g, 1, { interact: true });
  assert.deepEqual(evs.map((e) => e.name), ['deposit', 'lantern_lit']);
  assert.deepEqual(evs[0].data, { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.equal(g.player.carried, 2);
  assert.equal(g.score, T.score.per_lantern);
});

test('interact is edge-triggered: holding does not deposit again', () => {
  const g = new Game(T, { scenario: empty({ player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] }) });
  run(g, 1, { interact: true });
  g.player.carried = 1;
  assert.equal(run(g, 5).length, 0);
});

test('partial deposit and out-of-range interact', () => {
  const g = new Game(T, { scenario: empty({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] }) });
  const evs = run(g, 1, { interact: true });
  assert.deepEqual(evs[0].data, { lantern_id: 'L1', amount: 2, deposited: 2 });
  const far = new Game(T, { scenario: empty({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius + 0.1] }] }) });
  assert.equal(run(far, 1, { interact: true }).length, 0);
});

test('lighting the last lantern wins (all_lit) with time/flame bonus', () => {
  const lanterns = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  lanterns.push({ id: 'L1', pos: [0, 0, 1], deposited: T.lantern_cost - 1 });
  const g = new Game(T, { scenario: empty({ player: { carried: 1 }, lanterns, time_left_s: 100 }) });
  const evs = run(g, 1, { interact: true });
  assert.deepEqual(evs.at(-1), { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  const secs = Math.floor(100 - 1 / TICK_HZ);
  assert.equal(g.score, T.score.per_lantern + T.score.per_second_left * secs + T.score.per_flame_left * T.flames);
});

test('scenario setup gives no score for pre-lit lanterns', () => {
  const g = new Game(T, { scenario: empty({ lanterns: [{ id: 'L1', lit: true }] }) });
  assert.equal(g.score, 0);
  assert.equal(g.snapshot().lanterns[0].lit, true);
});

test('pulse stuns shades in radius, pushes them, costs pulse_cost, scores per_stun', () => {
  const g = new Game(T, {
    scenario: empty({ player: { carried: 3 }, shades: [{ id: 'A', pos: [T.pulse_radius, 0, 0] }, { id: 'B', pos: [T.pulse_radius + 0.5, 0, 0] }] }),
  });
  const evs = run(g, 1, { pulse: true });
  assert.deepEqual(evs[0].data, { stunned_ids: ['A'] });
  assert.equal(g.player.carried, 3 - T.pulse_cost);
  assert.equal(g.score, T.score.per_stun);
  near(g.shades[0].pos[0], T.pulse_radius + T.pulse_push_m);
  assert.equal(g.shades[0].state, 'stunned');
  // stunned shade stays still for pulse_stun_s, then chases again
  run(g, Math.round(T.pulse_stun_s * TICK_HZ) - 1, { pulse: false });
  assert.equal(g.shades[0].state, 'stunned');
  near(g.shades[0].pos[0], T.pulse_radius + T.pulse_push_m);
  run(g, 1);
  assert.notEqual(g.shades[0].state, 'stunned');
});

test('pulse respects cooldown and needs pulse_cost light', () => {
  const g = new Game(T, { scenario: empty({ player: { carried: 5 } }) });
  run(g, 1, { pulse: true });
  run(g, 1, { pulse: false });
  assert.equal(run(g, 1, { pulse: true }).length, 0, 'second pulse during cooldown');
  const cd = Math.round(T.pulse_cooldown_s * TICK_HZ);
  run(g, cd, { pulse: false });
  assert.equal(run(g, 1, { pulse: true })[0].name, 'pulse');
  const poor = new Game(T, { scenario: empty({ player: { carried: T.pulse_cost - 1 } }) });
  assert.equal(run(poor, 1, { pulse: true }).length, 0);
});

test('shade moves toward player at shade_speed', () => {
  const g = new Game(T, { scenario: empty({ shades: [{ pos: [20, 0, 0] }] }) });
  run(g, 60);
  near(g.shades[0].pos[0], 20 - T.shade_speed);
});

test('shade hit: lose flame, drop hit_drop_ratio of motes, invulnerable for invuln_s', () => {
  const g = new Game(T, { scenario: empty({ player: { carried: 5 }, shades: [{ pos: [T.shade_hit_radius, 0, 0] }] }) });
  const evs = run(g, 1);
  const hit = evs.find((e) => e.name === 'player_hit');
  assert.equal(hit.tick, 1);
  assert.deepEqual(hit.data, { by: 'shade', flames: T.flames - 1, dropped: Math.floor(5 * T.hit_drop_ratio) });
  const inv = Math.round(T.invuln_s * TICK_HZ);
  const more = run(g, inv);
  const hits = more.filter((e) => e.name === 'player_hit');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].tick, 1 + inv);
});

test('losing last flame ends the game (no_flames)', () => {
  const g = new Game(T, { scenario: empty({ player: { flames: 1 }, shades: [{ pos: [0, 0, 0] }] }) });
  const evs = run(g, 1);
  assert.equal(g.state, 'lost');
  assert.deepEqual(evs.at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('dawn: time runs out -> lost', () => {
  const g = new Game(T, { scenario: empty({ time_left_s: 1 }) });
  const evs = run(g, 1000);
  assert.equal(g.tick, 60);
  assert.deepEqual(evs.at(-1), { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
});

test('shades never enter safe_radius of a lit lantern', () => {
  const g = new Game(T, {
    scenario: empty({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ pos: [15, 0, 0] }] }),
  });
  for (let i = 0; i < 600; i++) {
    g.step();
    assert.ok(Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2]) > T.safe_radius);
  }
  assert.equal(g.player.flames, T.flames);
});

test('random spawns are deterministic per seed and differ between seeds', () => {
  const a = new Game(T, { seed: 7 }), b = new Game(T, { seed: 7 }), c = new Game(T, { seed: 8 });
  for (let i = 0; i < 2000; i++) { a.step(); b.step(); c.step(); }
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.notDeepEqual(a.snapshot().motes, c.snapshot().motes);
});
