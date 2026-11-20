// Unit tests for the pure sim (Contract v1.1, Ticket-02 standard numbers).
// Expected values come from game.contract.json tuning or Ticket-02 constants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game, TICK_HZ, C } from '../src/sim/sim.js';
import { NIGHTS } from '../src/sim/maps.js';

const T = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url))).tuning;
const quiet = (extra = {}) => ({ random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], ...extra });
const mk = (scenario, night = 1, seed = 1) => new Game(T, { night, seed, scenario });
const run = (g, n, frame) => {
  const evs = [];
  if (frame) g.applyFrame(frame);
  for (let i = 0; i < n && g.state !== 'won' && g.state !== 'lost'; i++) evs.push(...g.step());
  return evs;
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const names = (evs) => evs.map((e) => e.name);

test('contract tuning matches Ticket-02 standard numbers', () => {
  const want = {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360, flames: 3,
    invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6,
    shade_speed: 4, shade_hit_radius: 1, fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
  };
  for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, k);
  assert.deepEqual(T.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test('standard maps: lantern counts/positions, spawn point counts', () => {
  assert.deepEqual(NIGHTS[1].lanterns[1], [23.8, 0, 7.7]);
  assert.equal(NIGHTS[1].motePoints.length, 24);
  assert.equal(NIGHTS[1].shadePoints.length, 12);
  assert.equal(NIGHTS[2].lanterns.length, 6);
  assert.equal(NIGHTS[2].motePoints.length, 24);
  assert.equal(NIGHTS[3].lanterns.length, 7);
  assert.equal(NIGHTS[3].motePoints.length, 30);
  assert.equal(NIGHTS[3].shadePoints.length, 16);
  // tier-1 mote points must be on z > 0 (angle convention x = r cos a, z = r sin a)
  for (const p of NIGHTS[3].motePoints.filter((p) => p[1] === 3)) assert.ok(p[2] > 0);
  for (const p of NIGHTS[3].motePoints) assert.equal(NIGHTS[3].ground(p[0], p[2]), p[1]);
});

test('night start: 20 random motes at distinct points, no shades before tick 300', () => {
  const g = mk(null, 1, 5);
  const s = g.snapshot();
  assert.equal(s.motes_active, 20);
  assert.equal(new Set(s.motes.map((m) => m.pos.join())).size, 20);
  assert.equal(s.shades.length, 0);
  assert.equal(s.night, 1);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
});

test('move 60 ticks = player_speed metres; yaw rotates; diagonal normalized', () => {
  let g = mk(quiet());
  run(g, 60, { move: [0, 1] });
  near(g.player.pos[2], T.player_speed);
  g = mk(quiet());
  run(g, 60, { move: [0, 1], cam_yaw_deg: 90 });
  near(g.player.pos[0], T.player_speed);
  g = mk(quiet());
  run(g, 60, { move: [1, 1] });
  near(Math.hypot(g.player.pos[0], g.player.pos[2]), T.player_speed);
});

test('jump only when grounded; returns to ground', () => {
  const g = mk(quiet());
  run(g, 1, { jump: true });
  assert.equal(g.player.grounded, false);
  near(g.player.vel[1], C.JUMP_SPEED - C.GRAVITY / TICK_HZ);
  run(g, 100, { jump: false });
  assert.equal(g.player.grounded, true);
  assert.equal(g.player.pos[1], 0);
});

test('dash: 14 m/s for 12 ticks in facing dir, cooldown 90 ticks from start', () => {
  const g = mk(quiet());
  const e1 = run(g, 12, { dash: true });
  assert.deepEqual(e1.map((e) => [e.tick, e.name]), [[1, 'dash']]);
  near(g.player.pos[2], T.dash_speed * T.dash_duration_s);
  run(g, 1, { dash: false });
  assert.equal(run(g, 1, { dash: true }).length, 0, 'still on cooldown');
  run(g, 1, { dash: false });
  // dash started at step 0 -> available again at step 90
  run(g, 90 - g.tick);
  assert.deepEqual(run(g, 1, { dash: true }).map((e) => [e.tick, e.name]), [[91, 'dash']]);
});

test('dash in the air keeps altitude', () => {
  const g = mk(quiet());
  run(g, 10, { jump: true });
  const y = g.player.pos[1];
  run(g, 5, { dash: true });
  near(g.player.pos[1], y);
});

test('pickup: XZ <= 1.0 and height diff <= 1.5; no score until deposit', () => {
  const g = mk(quiet({ motes: [[1, 0, 0], [0, 0, 1.01]] }));
  const evs = run(g, 1);
  assert.deepEqual(evs.map((e) => [e.name, e.data.carried]), [['mote_picked', 1]]);
  assert.equal(g.score, 0);
  const h = mk(quiet({ motes: [[0, 1.6, 0]] }));
  assert.equal(run(h, 1).length, 0, 'too high');
});

test('deposit: min(carried, missing), +10 per mote, lantern remembers progress', () => {
  const g = mk(quiet({ player: { carried: 6 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }));
  let evs = run(g, 1, { interact: true });
  assert.deepEqual(evs[0].data, { lantern_id: 'L1', amount: 6, deposited: 6 });
  assert.equal(g.score, 60);
  g.player.carried = 10;
  run(g, 1, { interact: false });
  evs = run(g, 1, { interact: true });
  assert.deepEqual(names(evs), ['deposit', 'lantern_lit']);
  assert.deepEqual(evs[0].data, { lantern_id: 'L1', amount: 4, deposited: 10 });
  assert.equal(g.player.carried, 6);
  assert.equal(g.score, 60 + 40 + 100);
});

test('interact picks nearest unlit lantern, tie -> smaller id', () => {
  const g = mk(quiet({ player: { carried: 1 }, lanterns: [{ id: 'L2', pos: [1, 0, 0] }, { id: 'L1', pos: [-1, 0, 0] }] }));
  assert.equal(run(g, 1, { interact: true })[0].data.lantern_id, 'L1');
});

test('pulse: needs 3, 3D radius 5 from foot+0.8, stun 120, push 4 m over 15 ticks, +5 each', () => {
  const g = mk(quiet({
    player: { carried: 3 },
    shades: [{ id: 'S1', pos: [3, 1, 0], state: 'chase' }, { id: 'S2', pos: [0, 0.8, 5.01], state: 'chase' }],
  }));
  const evs = run(g, 1, { pulse: true });
  assert.deepEqual(evs.find((e) => e.name === 'pulse').data, { stunned_ids: ['S1'] });
  assert.equal(g.player.carried, 0);
  assert.equal(g.score, T.score.per_stun);
  run(g, 14);
  near(g.shades[0].pos[0], 3 + T.pulse_push_m);
  run(g, 10);
  near(g.shades[0].pos[0], 3 + T.pulse_push_m);
  run(g, 95); // steps 25..119
  assert.equal(g.shades[0].state, 'stunned');
  run(g, 1); // step 120: stun counter reaches 0
  assert.equal(g.shades[0].state, 'chase');
  const poor = mk(quiet({ player: { carried: 2 }, shades: [{ pos: [2, 1, 0] }] }));
  assert.equal(run(poor, 1, { pulse: true }).filter((e) => e.name === 'pulse').length, 0);
});

test('pulse cooldown 3 s; re-pulse refreshes stun and scores again', () => {
  const g = mk(quiet({ player: { carried: 9 }, shades: [{ id: 'S1', pos: [2, 1, 0], state: 'stunned', state_ticks_left: 50 }] }));
  run(g, 1, { pulse: true });
  run(g, 1, { pulse: false });
  assert.equal(run(g, 1, { pulse: true }).length, 0);
  run(g, 1, { pulse: false });
  run(g, 180 - g.tick);
  const evs = run(g, 1, { pulse: true });
  assert.equal(evs[0].name, 'pulse');
  assert.equal(g.score, 2 * T.score.per_stun);
});

test('shade detects at 12 m, gives up beyond 18 m', () => {
  const g = mk(quiet({ shades: [{ id: 'S1', pos: [12.5, 1, 0] }] }));
  assert.equal(g.shades[0].state, 'wander');
  const h = mk(quiet({ shades: [{ id: 'S1', pos: [11.9, 1, 0] }] }));
  assert.equal(h.shades[0].state, 'chase');
  run(h, 60);
  near(h.shades[0].pos[0], 11.9 - T.shade_speed);
  h.player.pos = [0, 0, -30];
  run(h, 1);
  assert.equal(h.shades[0].state, 'wander');
});

test('shade hit: -1 flame, drop floor(carried/2) as dropped motes 1.5-2.5 m (ttl 480), invuln 90, recoil 2 m / 60 ticks', () => {
  const g = mk(quiet({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [1, 1, 0], state: 'chase' }, { id: 'S2', pos: [-1, 1, 0], state: 'chase' }] }));
  const evs = run(g, 1);
  const hits = evs.filter((e) => e.name === 'player_hit');
  assert.equal(hits.length, 1, 'max one flame per tick');
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  assert.equal(g.player.carried, 3);
  const dropped = g.snapshot().motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 2);
  for (const m of dropped) {
    const r = Math.hypot(m.pos[0], m.pos[2]);
    assert.ok(r >= 1.5 - 1e-3 && r <= 2.5 + 1e-3);
    assert.equal(m.ttl_s, 8);
  }
  assert.equal(g.shades[0].state, 'recoil');
  assert.equal(g.snapshot().player.invuln, true);
  run(g, 59);
  // S1 chased one step (4/60 m) in phase 8 before the hit in phase 9, then recoiled exactly 2 m
  near(g.shades[0].pos[0], 1 - T.shade_speed / 60 + 2);
  assert.equal(g.shades[0].state, 'recoil');
  run(g, 1);
  assert.equal(g.shades[0].state, 'chase');
  // S2 sits on the player but cannot hit while invulnerable (90 ticks)
  assert.equal(g.player.flames, 2);
});

test('dropped motes expire after 480 ticks', () => {
  const g = mk(quiet({ player: { carried: 4 }, shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }] }));
  run(g, 1);
  g.shades = [];
  assert.equal(g.motes.length, 2);
  run(g, 479); // dropped at step 0: present through tick 480
  assert.equal(g.motes.length, 2);
  run(g, 1);
  assert.equal(g.motes.length, 0);
});

test('fall off island: once, ignores invuln, -1 flame, lose all motes, wait 60, respawn with invuln 90', () => {
  const g = mk(quiet({ player: { pos: [0, 0, 38.95], carried: 4, invuln_ticks: 500 } }));
  const evs = run(g, 70, { move: [0, 1] });
  const hit = evs.filter((e) => e.name === 'player_hit');
  assert.equal(hit.length, 1);
  assert.deepEqual(hit[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  assert.equal(hit[0].tick, 70);
  run(g, 59);
  assert.ok(g.player.pos[1] < -10, 'still waiting');
  run(g, 1); // step 129: wait over -> back at start (moves from next tick)
  assert.deepEqual(g.player.pos, [0, 0, 0]);
  assert.equal(g.player.invuln, 90);
  const last = mk(quiet({ player: { pos: [0, 0, 38.95], flames: 1 } }));
  const e2 = run(last, 200, { move: [0, 1] });
  assert.deepEqual(e2.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(e2.at(-1).tick, 70);
});

test('launch pads: night 2 crosses to the other island in 84 ticks; night 3 lands on tier 2', () => {
  let g = mk(quiet({ player: { pos: [20, 0, 18] } }), 2);
  run(g, 84);
  assert.equal(g.player.grounded, true);
  assert.ok(Math.hypot(g.player.pos[0] - 70, g.player.pos[2]) < 28);
  assert.equal(g.player.flames, 3);
  g = mk(quiet({ player: { pos: [0, 3, 13] } }), 3);
  run(g, 60);
  assert.equal(g.player.pos[1], 6);
  assert.equal(g.player.grounded, true);
});

test('night 3 terrain: ramp climbs to tier 1, cliffs block, tower blocks', () => {
  const a = Math.PI / 6;
  let g = mk(quiet({ player: { pos: [32 * Math.cos(a), 0, 32 * Math.sin(a)] } }), 3);
  run(g, 120, { move: [-Math.cos(a), -Math.sin(a)] });
  assert.equal(g.player.pos[1], 3);
  g = mk(quiet({ player: { pos: [0, 0, 30] } }), 3);
  run(g, 120, { move: [0, -1] });
  assert.ok(g.player.pos[2] > 24 && g.player.pos[1] === 0, 'blocked by tier-1 cliff');
  g = mk(quiet({ player: { pos: [0, 6, 6] } }), 3);
  run(g, 120, { move: [0, -1] });
  assert.ok(Math.hypot(g.player.pos[0], g.player.pos[2]) >= 2, 'blocked by tower');
});

test('safe zone: shades blocked at 6 m edge; shades inside when lit are expelled within 30 ticks without damage', () => {
  const g = mk(quiet({ player: { pos: [0, 0, 23.5], carried: 10 }, shades: [{ id: 'S1', pos: [0, 1, 22] }] }));
  const evs = run(g, 300, { interact: true });
  assert.deepEqual(names(evs).slice(0, 2), ['deposit', 'lantern_lit']);
  assert.equal(evs.filter((e) => e.name === 'player_hit').length, 0);
  assert.ok(Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 25) >= T.safe_radius - 1e-9);
  const h = mk(quiet({ player: { pos: [0, 0, 23.5], carried: 10 }, shades: [{ id: 'S1', pos: [0, 1, 22] }] }));
  run(h, 30, { interact: true });
  near(h.shades[0].pos[2], 25 - T.safe_radius);
});

test('drifter: chases when carried >= 5 within 15 m, steals min(3, carried) ignoring invuln, flees 240 ticks then removed', () => {
  const g = mk(quiet({ player: { carried: 6, invuln_ticks: 600 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }), 2);
  const evs = run(g, 400);
  const steal = evs.find((e) => e.name === 'drifter_steal');
  assert.deepEqual(steal.data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.equal(steal.tick, 76); // 10 - 1.2 = 8.8 m at 7/60 m per tick -> 76 steps
  assert.equal(g.drifters[0].state, 'removed');
  assert.equal(g.player.flames, 3, 'drifters never take flames');
});

test('pulse on drifters: chase -> flee without stealing; flee with loot -> drops it as dropped motes', () => {
  const g = mk(quiet({
    player: { carried: 6 },
    drifters: [{ id: 'D1', pos: [2, 1.5, 0], state: 'flee', stolen: 2 }, { id: 'D2', pos: [-3, 1.5, 0], state: 'chase' }],
  }), 2);
  const evs = run(g, 1, { pulse: true });
  assert.deepEqual(evs.find((e) => e.name === 'drifter_drop').data, { drifter_id: 'D1', amount: 2 });
  const s = g.snapshot();
  assert.deepEqual(s.drifters.map((d) => [d.id, d.state, d.stolen]), [['D1', 'flee', 0], ['D2', 'flee', 0]]);
  assert.equal(s.motes.filter((m) => m.kind === 'dropped').length, 2);
  run(g, 120);
  assert.equal(g.drifters[0].state, 'removed');
  assert.equal(g.player.carried, 3, 'D2 never stole');
});

test('charm: pickup sets 600 ticks, speed 7.2, dash without cooldown, respawns after 2700', () => {
  const g = mk(quiet({ player: { pos: [34, 0, 0] } }), 2);
  const evs = run(g, 1);
  assert.deepEqual(evs[0], { type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } });
  const x0 = g.player.pos[0];
  run(g, 10, { move: [1, 0] });
  near(g.player.pos[0] - x0, (10 * 7.2) / 60);
  run(g, 1, { move: [0, 0], dash: true });
  run(g, 12, { dash: false });
  const e2 = run(g, 1, { dash: true });
  assert.equal(e2[0].name, 'dash', 'no cooldown with charm');
  assert.equal(g.snapshot().charms[0].available, false);
  run(g, 2700 - g.tick + 1);
  assert.equal(g.snapshot().charms[0].available, true);
});

test('pause freezes sim: tick advances, sim_tick/time do not; paused/resumed events', () => {
  const g = mk(quiet());
  g.applyFrame({ move: [0, 1] });
  run(g, 10);
  const e1 = run(g, 1, { pause: true });
  assert.deepEqual(e1.map((e) => [e.tick, e.name]), [[11, 'paused']]);
  run(g, 20, { pause: false });
  let s = g.snapshot();
  assert.equal(s.state, 'paused');
  assert.equal(s.tick, 31);
  assert.equal(s.sim_tick, 10);
  near(s.player.pos[2], 1);
  const e2 = run(g, 1, { pause: true });
  assert.deepEqual(e2.map((e) => [e.tick, e.name]), [[32, 'resumed']]);
  s = g.snapshot();
  assert.equal(s.sim_tick, 11);
  near(s.time_left_s, 300 - 11 / 60, 1e-3);
});

test('mote spawns every 240 ticks up to free points; shades 2 at tick 300 then every 480 up to 6', () => {
  const g = mk({ random_shades: true }, 1, 3);
  const evs = run(g, 3000);
  assert.equal(g.motes.length, 24, 'night 1 has 24 points');
  const sp = evs.filter((e) => e.name === 'shade_spawned').map((e) => [e.tick, e.data.id]);
  assert.deepEqual(sp, [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4'], [1740, 'S5'], [2220, 'S6']]);
  assert.equal(g.shades.length, 6);
});

test('win even on the exact dawn tick', () => {
  const lit = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
  const g = mk(quiet({ player: { pos: [-23.8, 0, 7.7], carried: 10 }, lanterns: lit, time_left_s: 1 / 60 }));
  const evs = run(g, 5, { interact: true });
  assert.deepEqual(evs.at(-1).data, { result: 'won', reason: 'all_lit' });
  assert.equal(g.score, 100 + 100 + 0 + 50 * 3);
  // "no_flames beats all_lit" cannot be staged: lighting needs the player within 2 m of the lantern, so any
  // shade close enough to hit is inside the new 6 m zone and is expelled without damage (phase 6).
});

test('dawn ends the night', () => {
  const g = mk(quiet({ time_left_s: 1 }));
  const evs = run(g, 1000);
  assert.deepEqual(evs.at(-1), { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
});

test('night 3 wind: gust every 30 s for 5 s at 2 m/s', () => {
  const g = mk(quiet({ wind_enabled: true }), 3);
  run(g, 1799);
  assert.equal(g.wind.active, false);
  assert.notEqual(g.wind.dirDeg, null, 'direction announced 2 s early');
  const p0 = [...g.player.pos];
  run(g, 1);
  assert.equal(g.wind.active, true);
  run(g, 299);
  assert.equal(g.wind.active, true);
  run(g, 1);
  assert.equal(g.wind.active, false);
  near(Math.hypot(g.player.pos[0] - p0[0], g.player.pos[2] - p0[2]), 10, 0.05);
});

test('determinism per seed for every night, ids included', () => {
  for (const night of [1, 2, 3]) {
    const a = mk(null, night, 9), b = mk(null, night, 9);
    for (let i = 0; i < 4000; i++) { a.step(); b.step(); }
    assert.deepEqual(a.snapshot(), b.snapshot());
  }
});
