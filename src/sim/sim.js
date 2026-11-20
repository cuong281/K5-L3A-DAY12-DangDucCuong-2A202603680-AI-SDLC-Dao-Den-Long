// Pure game logic for Đảo Đèn Lồng. No DOM, no rendering, no Math.random.
// Fixed 60 ticks/s. Used by both headless.js and the web renderer.
import { mulberry32 } from './rng.js';

export const TICK_HZ = 60;
export const ISLAND_RADIUS = 40; // player cannot walk past this (fall_enabled = false)
export const LANTERN_RING_RADIUS = 25;
export const JUMP_SPEED = 7; // m/s
export const GRAVITY = 20; // m/s^2
export const DEFAULT_MOTES = 30;
export const MOTE_RESPAWN_TICKS = 600; // 10 s after pickup (random_motes only)
export const INITIAL_SHADES = 2;
export const MAX_SHADES = 6;
export const SHADE_SPAWN_EVERY = 1800; // one more shade every 30 s (random_shades only)
export const SHADE_SPAWN_Y = 1;
const SAFE_EPS = 0.01; // shades are kept strictly outside safe_radius

export const round3 = (x) => {
  const r = Math.round(x * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
const hdist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export function defaultLanternPositions(n, r = LANTERN_RING_RADIUS) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    out.push([round3(r * Math.sin(a)), 0, round3(r * Math.cos(a))]);
  }
  return out;
}

export class Game {
  constructor(tuning, { seed = 0, scenario = null } = {}) {
    const T = (this.T = tuning);
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.state = 'playing';
    this.result = null;
    this.score = 0;
    this.events = [];
    this.lastEvents = [];
    this.player = { pos: [0, 0, 0], vy: 0, grounded: true, carried: 0, flames: T.flames, invulnUntil: 0 };
    this.lanterns = defaultLanternPositions(T.lantern_count_night1).map((pos, i) => ({
      id: `L${i + 1}`, pos, lit: false, deposited: 0,
    }));
    this.motes = [];
    this.moteRespawns = [];
    this.nextMoteId = 1;
    this.shades = [];
    this.nextShadeId = 1;
    this.lastPulseStep = -Infinity;
    this.input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
    this.prev = { jump: false, interact: false, pulse: false, dash: false };

    const sc = scenario || {};
    this.randomMotes = sc.random_motes !== false;
    this.randomShades = sc.random_shades !== false;
    this.timeLeft0 = sc.time_left_s ?? T.night1_duration_s;
    this.endTick = Math.round(this.timeLeft0 * TICK_HZ);

    if (sc.player) {
      if (sc.player.pos) this.player.pos = [...sc.player.pos];
      if (sc.player.carried != null) this.player.carried = sc.player.carried;
      if (sc.player.flames != null) this.player.flames = sc.player.flames;
      this.player.grounded = this.player.pos[1] <= 0;
    }
    if (sc.lanterns) {
      for (const sl of sc.lanterns) {
        const l = this.lanterns.find((x) => x.id === sl.id);
        if (!l) continue; // unknown id: ignored (only L1..L5 exist)
        if (sl.pos) l.pos = [...sl.pos];
        if (sl.deposited != null) l.deposited = sl.deposited;
        if (sl.lit != null) {
          l.lit = !!sl.lit;
          if (l.lit && sl.deposited == null) l.deposited = T.lantern_cost;
        }
      }
    }
    // Motes: explicit list replaces defaults; otherwise random spawn (if allowed).
    if (sc.motes) for (const p of sc.motes) this.addMote(p);
    else if (this.randomMotes) for (let i = 0; i < DEFAULT_MOTES; i++) this.addMote(this.randomMotePos());
    // Shades: explicit list replaces defaults.
    if (sc.shades) {
      for (const s of sc.shades) this.addShade(s.pos, s.id);
    } else if (this.randomShades) {
      for (let i = 0; i < INITIAL_SHADES; i++) this.addShade(this.randomShadePos());
    }
  }

  // ---------- spawning helpers ----------
  addMote(pos) {
    this.motes.push({ id: `M${this.nextMoteId++}`, pos: [pos[0], 0, pos[2]] });
  }
  randomMotePos() {
    const a = this.rng() * 2 * Math.PI;
    const r = 3 + (ISLAND_RADIUS - 4) * Math.sqrt(this.rng());
    return [r * Math.sin(a), 0, r * Math.cos(a)];
  }
  addShade(pos, id) {
    if (!id) {
      do id = `S${this.nextShadeId++}`; while (this.shades.some((s) => s.id === id));
    }
    const s = { id, pos: [pos[0], pos[1] ?? SHADE_SPAWN_Y, pos[2]], state: 'chase', stunUntil: 0 };
    this.shades.push(s);
    return s;
  }
  randomShadePos() {
    let p;
    for (let tries = 0; tries < 12; tries++) {
      const a = this.rng() * 2 * Math.PI;
      const r = 30 + 8 * this.rng();
      p = [r * Math.sin(a), SHADE_SPAWN_Y, r * Math.cos(a)];
      const farFromPlayer = hdist(p, this.player.pos) >= 15;
      const outsideSafe = this.lanterns.every((l) => !l.lit || hdist(p, l.pos) > this.T.safe_radius);
      if (farFromPlayer && outsideSafe) break;
    }
    return p;
  }

  emit(name, data) {
    this.events.push({ type: 'event', tick: this.tick + 1, name, data });
  }

  // ---------- input ----------
  // frame: partial {move, cam_yaw_deg, jump, interact, pulse, dash}; absent fields keep old value.
  applyFrame(frame) {
    for (const k of ['move', 'cam_yaw_deg', 'jump', 'interact', 'pulse', 'dash']) {
      if (frame[k] !== undefined) this.input[k] = k === 'move' ? [...frame[k]] : frame[k];
    }
  }

  // ---------- one fixed step: reads current input, produces state tick+1 ----------
  step() {
    this.events = [];
    if (this.state !== 'playing') return this.events;
    const T = this.T;
    const k = this.tick;
    const inp = this.input;
    const edge = {};
    for (const b of ['jump', 'interact', 'pulse', 'dash']) {
      edge[b] = !!inp[b] && !this.prev[b];
      this.prev[b] = !!inp[b];
    }
    const P = this.player;

    // 1. movement (camera-relative, normalized if longer than 1)
    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (inp.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const v = T.player_speed / TICK_HZ;
    const oldD = Math.hypot(P.pos[0], P.pos[2]);
    let nx = P.pos[0] + wx * v;
    let nz = P.pos[2] + wz * v;
    const newD = Math.hypot(nx, nz);
    if (newD > ISLAND_RADIUS && newD > oldD) {
      const lim = Math.max(ISLAND_RADIUS, oldD);
      nx *= lim / newD; nz *= lim / newD;
    }
    P.pos[0] = nx; P.pos[2] = nz;

    // 2. jump (visual/vertical only; all distances are horizontal)
    if (edge.jump && P.grounded) { P.vy = JUMP_SPEED; P.grounded = false; }
    if (!P.grounded) {
      P.vy -= GRAVITY / TICK_HZ;
      P.pos[1] += P.vy / TICK_HZ;
      if (P.pos[1] <= 0) { P.pos[1] = 0; P.vy = 0; P.grounded = true; }
    }

    // 3. pickup motes
    for (let i = 0; i < this.motes.length && P.carried < T.carry_capacity; ) {
      if (hdist(this.motes[i].pos, P.pos) <= T.pickup_radius) {
        this.motes.splice(i, 1);
        P.carried++;
        this.score += T.score.per_mote;
        this.emit('mote_picked', { carried: P.carried });
        if (this.randomMotes) this.moteRespawns.push(k + MOTE_RESPAWN_TICKS);
      } else i++;
    }
    // mote respawn
    while (this.moteRespawns.length && this.moteRespawns[0] <= k) {
      this.moteRespawns.shift();
      this.addMote(this.randomMotePos());
    }

    // 4. interact: deposit into nearest unlit lantern in range
    if (edge.interact && P.carried > 0) {
      let best = null, bd = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = hdist(l.pos, P.pos);
        if (d <= T.interact_radius && d < bd) { best = l; bd = d; }
      }
      if (best) {
        const amount = Math.min(P.carried, T.lantern_cost - best.deposited);
        if (amount > 0) {
          P.carried -= amount;
          best.deposited += amount;
          this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        }
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          this.score += T.score.per_lantern;
          this.emit('lantern_lit', { lantern_id: best.id });
          if (this.lanterns.every((l) => l.lit)) this.end('won', 'all_lit');
        }
      }
    }

    if (this.state === 'playing') {
      // 5. pulse
      const cd = Math.round(T.pulse_cooldown_s * TICK_HZ);
      if (edge.pulse && k - this.lastPulseStep >= cd && P.carried >= T.pulse_cost) {
        this.lastPulseStep = k;
        P.carried -= T.pulse_cost;
        const stunned = [];
        for (const s of this.shades) {
          const d = hdist(s.pos, P.pos);
          if (d > T.pulse_radius) continue;
          s.state = 'stunned';
          s.stunUntil = k + Math.round(T.pulse_stun_s * TICK_HZ);
          let dx = s.pos[0] - P.pos[0], dz = s.pos[2] - P.pos[2];
          if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
          s.pos[0] += dx * T.pulse_push_m;
          s.pos[2] += dz * T.pulse_push_m;
          this.keepOutOfSafe(s);
          stunned.push(s.id);
          this.score += T.score.per_stun;
        }
        this.emit('pulse', { stunned_ids: stunned });
      }

      // 6. shades
      const sv = T.shade_speed / TICK_HZ;
      for (const s of this.shades) {
        if (s.state === 'stunned') {
          if (k < s.stunUntil) continue;
          s.state = 'chase';
        }
        const dx = P.pos[0] - s.pos[0], dz = P.pos[2] - s.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= sv) { s.pos[0] = P.pos[0]; s.pos[2] = P.pos[2]; }
        else { s.pos[0] += (dx / d) * sv; s.pos[2] += (dz / d) * sv; }
        this.keepOutOfSafe(s);
      }
      if (this.randomShades && (k + 1) % SHADE_SPAWN_EVERY === 0 && this.shades.length < MAX_SHADES) {
        const s = this.addShade(this.randomShadePos());
        this.emit('shade_spawned', { id: s.id });
      }

      // 7. hits
      if (k >= P.invulnUntil) {
        const hitter = this.shades.find((s) => s.state !== 'stunned' && hdist(s.pos, P.pos) <= T.shade_hit_radius);
        if (hitter) {
          P.flames -= 1;
          const dropped = Math.floor(P.carried * T.hit_drop_ratio);
          P.carried -= dropped;
          P.invulnUntil = k + Math.round(T.invuln_s * TICK_HZ);
          this.emit('player_hit', { by: 'shade', flames: P.flames, dropped });
          if (P.flames <= 0) this.end('lost', 'no_flames');
        }
      }
    }

    // time advances; events above were stamped with tick k+1
    if (this.state === 'playing' && k + 1 >= this.endTick) this.end('lost', 'dawn');
    if (this.state === 'won') {
      const secondsLeft = Math.floor(this.timeLeft0 - (k + 1) / TICK_HZ);
      this.score += T.score.per_second_left * Math.max(0, secondsLeft) + T.score.per_flame_left * P.flames;
    }
    if (this.state !== 'playing') this.emit('game_over', { result: this.state, reason: this.result });
    this.tick = k + 1;
    this.lastEvents = this.events;
    return this.events;
  }

  end(state, reason) {
    this.state = state;
    this.result = reason;
  }

  keepOutOfSafe(s) {
    const r = this.T.safe_radius;
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      let dx = s.pos[0] - l.pos[0], dz = s.pos[2] - l.pos[2];
      const d = Math.hypot(dx, dz);
      if (d <= r) {
        if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
        s.pos[0] = l.pos[0] + dx * (r + SAFE_EPS);
        s.pos[2] = l.pos[2] + dz * (r + SAFE_EPS);
      }
    }
  }

  timeLeft() {
    return this.timeLeft0 - this.tick / TICK_HZ;
  }
  pulseReadyIn() {
    const cd = Math.round(this.T.pulse_cooldown_s * TICK_HZ);
    return Math.max(0, (this.lastPulseStep + cd - this.tick) / TICK_HZ);
  }

  snapshot() {
    const P = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: round3(this.timeLeft()),
      score: this.score,
      player: { pos: P.pos.map(round3), flames: P.flames, carried: P.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(round3), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(round3), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(round3) })),
    };
  }
}
