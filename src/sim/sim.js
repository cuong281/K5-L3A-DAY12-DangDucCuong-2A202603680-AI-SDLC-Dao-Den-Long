// Pure game logic for Đảo Đèn Lồng (Test Contract v1.1). No DOM, no Math.random, no Date.
// Fixed 60 ticks/s. Shared by headless.js and the web renderer.
// Tick order follows Ticket-02 "Thứ tự xử lý trong một tick" exactly (phases 1..12 below).
import { mulberry32 } from './rng.js';
import { NIGHTS } from './maps.js';

export const TICK_HZ = 60;
// Standard constants from Ticket-02 that are not tuning keys
export const C = {
  JUMP_SPEED: 7, GRAVITY: 20, STEP_UP: 0.4,
  PICKUP_DY: 1.5, HIT_DY: 1.5,
  MOTE_START: 20, MOTE_CAP: 30, MOTE_EVERY: 240, DROP_TTL: 480, DROP_RMIN: 1.5, DROP_RMAX: 2.5,
  CHARM_TICKS: 600, CHARM_RESPAWN: 2700, CHARM_SPEED: 7.2,
  PULSE_UP: 0.8, STUN_TICKS: 120, PUSH_TICKS: 15,
  DETECT: 12, LOSE: 18, WANDER_SPEED: 1.5, WANDER_R: 5,
  RECOIL_M: 2, RECOIL_TICKS: 60, SPAWNING_TICKS: 60, SHADE_FIRST: 300, SHADE_MIN_DIST: 15, SHADE_Y: 1,
  EXPEL_TICKS: 30,
  FALL_Y: -10, RESPAWN_WAIT: 60,
  DRIFTER_SPEED: 7, DRIFTER_IDLE_SPEED: 2, DRIFTER_MAX: 2, DRIFTER_EVERY: 1200, DRIFTER_CHASE_CARRY: 5,
  DRIFTER_CHASE_DIST: 15, DRIFTER_TOUCH: 1.2, DRIFTER_STEAL: 3, DRIFTER_FLEE: 240, DRIFTER_DROP_FLEE: 120, DRIFTER_Y: 1.5,
  WIND_EVERY: 1800, WIND_TICKS: 300, WIND_WARN: 120, WIND_SPEED: 2,
};

export const round3 = (x) => {
  const r = Math.round(x * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
const hd = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idNum = (id) => {
  const m = /(\d+)$/.exec(id);
  return m ? parseInt(m[1], 10) : Infinity;
};
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const sec = (ticks) => round3(ticks / TICK_HZ);

export class Game {
  constructor(tuning, { seed = 0, night = 1, scenario = null } = {}) {
    const T = (this.T = tuning);
    this.night = night;
    this.map = NIGHTS[night];
    if (!this.map) throw new Error(`unknown night ${night}`);
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing';
    this.result = null;
    this.score = 0;
    this.events = [];
    this.newlyLit = [];
    this.shadeSpeed = this.map.shadeSpeed ?? T.shade_speed;
    this.ticks = {
      dashDur: Math.round(T.dash_duration_s * TICK_HZ),
      dashCd: Math.round(T.dash_cooldown_s * TICK_HZ),
      pulseCd: Math.round(T.pulse_cooldown_s * TICK_HZ),
      invuln: Math.round(T.invuln_s * TICK_HZ),
      stun: Math.round(T.pulse_stun_s * TICK_HZ),
    };
    const start = [...this.map.start];
    this.player = {
      pos: start, vel: [0, 0, 0], grounded: true, facing: [0, 1], carried: 0, flames: T.flames,
      invuln: 0, dashCd: 0, pulseCd: 0, charm: 0, dashLeft: 0, dashDir: [0, 1], launched: null, respawn: 0,
    };
    this.lanterns = this.map.lanterns.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0 }));
    this.motes = [];
    this.shades = [];
    this.drifters = [];
    this.charms = this.map.charms.map((pos, i) => ({ id: `C${i + 1}`, pos: [...pos], available: true, respawn: 0 }));
    this.nextId = { M: 1, S: 1, D: 1 };
    this.wind = { active: false, dirDeg: null, left: 0 };
    this.input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
    this.prev = { jump: false, interact: false, pulse: false, dash: false, pause: false };

    const sc = scenario || {};
    this.randomMotes = sc.random_motes !== false;
    this.randomShades = sc.random_shades !== false;
    this.randomDrifters = this.map.drifters && sc.random_drifters !== false;
    this.windEnabled = sc.wind_enabled ?? this.map.wind;
    const dur = T[this.map.durationKey];
    this.timeLeft0 = sc.time_left_s ?? dur;
    this.endSim = Math.round(this.timeLeft0 * TICK_HZ);

    const P = this.player;
    if (sc.player) {
      const sp = sc.player;
      if (sp.pos) P.pos = [...sp.pos];
      if (sp.carried != null) P.carried = sp.carried;
      if (sp.flames != null) P.flames = sp.flames;
      if (sp.invuln_ticks != null) P.invuln = sp.invuln_ticks;
      if (sp.dash_cd_ticks != null) P.dashCd = sp.dash_cd_ticks;
      if (sp.pulse_cd_ticks != null) P.pulseCd = sp.pulse_cd_ticks;
      if (sp.charm_ticks != null) P.charm = sp.charm_ticks;
      const h = this.ground(P.pos[0], P.pos[2]);
      P.grounded = h != null && Math.abs(P.pos[1] - h) < 1e-6;
    }
    for (const sl of sc.lanterns || []) {
      const l = this.lanterns.find((x) => x.id === sl.id);
      if (!l) continue;
      if (sl.pos) l.pos = [...sl.pos];
      if (sl.deposited != null) l.deposited = sl.deposited;
      if (sl.lit != null) {
        l.lit = !!sl.lit;
        if (l.lit && sl.deposited == null) l.deposited = T.lantern_cost;
      }
    }
    if (sc.motes) {
      for (const m of sc.motes) {
        if (Array.isArray(m)) this.addMote(m, 'random');
        else this.addMote(m.pos, m.kind || 'random', m.ttl_ticks ?? (m.ttl_s != null ? Math.round(m.ttl_s * TICK_HZ) : undefined), m.id);
      }
    } else if (this.randomMotes) {
      const pts = this.shuffle(this.map.motePoints.map((_, i) => i)).slice(0, C.MOTE_START);
      for (const i of pts) this.addMote(this.map.motePoints[i], 'random', null, null, i);
    }
    for (const s of sc.shades || []) {
      this.addShade(s.pos, s.id, s.state, s.state_ticks_left);
    }
    for (const d of sc.drifters || []) this.addDrifter(d.pos, d.id, d.state, d.stolen);
    if (sc.charms) {
      this.charms = sc.charms.map((c, i) => ({
        id: c.id || `C${i + 1}`,
        pos: [...c.pos],
        available: c.available !== false,
        respawn: c.available === false ? (c.respawn_ticks ?? (c.respawn_s != null ? Math.round(c.respawn_s * TICK_HZ) : C.CHARM_RESPAWN)) : 0,
      }));
    }
  }

  // ---------- helpers ----------
  ground(x, z) {
    return this.map.ground(x, z);
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  pick(arr) {
    return arr[Math.floor(this.rng() * arr.length)];
  }
  newId(prefix, list) {
    let id;
    do id = `${prefix}${this.nextId[prefix]++}`; while (list.some((e) => e.id === id));
    return id;
  }
  addMote(pos, kind = 'random', ttl, id, point = null) {
    const m = { id: id || this.newId('M', this.motes), pos: [pos[0], pos[1] ?? 0, pos[2]], kind, ttl: kind === 'dropped' ? (ttl ?? C.DROP_TTL) : null, point };
    this.motes.push(m);
    return m;
  }
  addShade(pos, id, state, ticksLeft) {
    const h = this.ground(pos[0], pos[2]) ?? 0;
    const y = pos[1] ?? C.SHADE_Y;
    const s = {
      id: id || this.newId('S', this.shades), pos: [pos[0], y, pos[2]], yOff: y - h, home: [pos[0], pos[2]], target: null,
      state: state || null, ticks: 0, pushLeft: 0, pushDir: [1, 0], recoilLeft: 0, recoilDir: [1, 0], expel: null,
    };
    if (!s.state) s.state = this.awareState(s, 'wander');
    if (s.state === 'stunned') s.ticks = ticksLeft ?? this.ticks.stun;
    if (s.state === 'spawning') s.ticks = ticksLeft ?? C.SPAWNING_TICKS;
    if (s.state === 'recoil') { s.ticks = ticksLeft ?? C.RECOIL_TICKS; s.recoilLeft = C.RECOIL_M * (s.ticks / C.RECOIL_TICKS); s.recoilDir = this.awayDir(s.pos); }
    this.shades.push(s);
    return s;
  }
  addDrifter(pos, id, state = 'idle', stolen = 0) {
    const h = this.ground(pos[0], pos[2]) ?? 0;
    const d = {
      id: id || this.newId('D', this.drifters), pos: [pos[0], pos[1] ?? h + C.DRIFTER_Y, pos[2]], home: [pos[0], pos[2]], target: null,
      state, stolen, hasStolen: stolen > 0 || state === 'flee', ticks: state === 'flee' ? C.DRIFTER_FLEE : 0,
    };
    this.drifters.push(d);
    return d;
  }
  awayDir(pos) {
    const P = this.player.pos;
    let dx = pos[0] - P[0], dz = pos[2] - P[2];
    const d = Math.hypot(dx, dz);
    return d < 1e-9 ? [1, 0] : [dx / d, dz / d];
  }
  awareState(s, fallback) {
    const d = hd(s.pos, this.player.pos);
    if (d <= C.DETECT) return 'chase';
    if (d > C.LOSE) return 'wander';
    return fallback;
  }
  emit(name, data) {
    this.events.push({ type: 'event', tick: this.tick + 1, name, data });
  }
  inSafeZone(x, z) {
    return this.lanterns.some((l) => l.lit && Math.hypot(x - l.pos[0], z - l.pos[2]) < this.T.safe_radius);
  }
  // keep a shade on/outside the 6 m edge of every lit lantern; returns true if it was blocked
  blockSafe(s) {
    const r = this.T.safe_radius;
    let blocked = false;
    for (const l of this.lanterns) {
      if (!l.lit || (s.expel && s.expel.id === l.id)) continue;
      let dx = s.pos[0] - l.pos[0], dz = s.pos[2] - l.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
        s.pos[0] = l.pos[0] + dx * r;
        s.pos[2] = l.pos[2] + dz * r;
        blocked = true;
      }
    }
    return blocked;
  }
  towerBlocks(x, z, y) {
    const t = this.map.tower;
    return t && Math.hypot(x - t.x, z - t.z) < t.r && y < t.top;
  }
  shadeY(s) {
    s.pos[1] = (this.ground(s.pos[0], s.pos[2]) ?? 0) + s.yOff;
  }
  moveToward(e, tx, tz, step) {
    const dx = tx - e.pos[0], dz = tz - e.pos[2];
    const d = Math.hypot(dx, dz);
    if (d <= step) { e.pos[0] = tx; e.pos[2] = tz; return true; }
    e.pos[0] += (dx / d) * step;
    e.pos[2] += (dz / d) * step;
    return false;
  }
  wanderStep(e, speed) {
    if (!e.target) {
      const a = this.rng() * 2 * Math.PI, r = this.rng() * C.WANDER_R;
      e.target = [e.home[0] + r * Math.cos(a), e.home[1] + r * Math.sin(a)];
    }
    if (this.moveToward(e, e.target[0], e.target[1], speed / TICK_HZ)) e.target = null;
  }

  // ---------- input ----------
  applyFrame(frame) {
    for (const k of ['move', 'cam_yaw_deg', 'jump', 'interact', 'pulse', 'dash', 'pause']) {
      if (frame[k] !== undefined) this.input[k] = k === 'move' ? [...frame[k]] : frame[k];
    }
  }

  // ---------- one fixed step ----------
  step() {
    this.events = [];
    if (this.state === 'won' || this.state === 'lost') return this.events;
    const T = this.T, P = this.player, inp = this.input;

    // 1. input (pause first)
    const edge = {};
    for (const b of ['jump', 'interact', 'pulse', 'dash', 'pause']) {
      edge[b] = !!inp[b] && !this.prev[b];
      this.prev[b] = !!inp[b];
    }
    if (edge.pause) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.emit('paused', {});
        this.tick++;
        return this.events;
      }
      this.state = 'playing';
      this.emit('resumed', {});
    } else if (this.state === 'paused') {
      this.tick++;
      return this.events;
    }

    // 2. counters
    this.simTick++;
    const ns = this.simTick;
    for (const k of ['invuln', 'dashCd', 'pulseCd', 'charm']) if (P[k] > 0) P[k]--;
    for (const s of this.shades) {
      if ((s.state === 'stunned' || s.state === 'spawning' || s.state === 'recoil') && s.ticks > 0) {
        s.ticks--;
        if (s.ticks === 0) {
          s.state = hd(s.pos, P.pos) <= C.DETECT ? 'chase' : 'wander';
          s.pushLeft = 0;
          s.recoilLeft = 0;
        }
      }
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.kind === 'dropped' && --m.ttl <= 0) this.motes.splice(i, 1);
    }
    for (const c of this.charms) if (!c.available && --c.respawn <= 0) { c.available = true; c.respawn = 0; }
    for (const d of this.drifters) if (d.state === 'flee' && --d.ticks <= 0) { d.state = 'removed'; d.stolen = 0; }
    if (this.windEnabled) {
      if (this.wind.active && --this.wind.left <= 0) this.wind.active = false;
      if (ns % C.WIND_EVERY === C.WIND_EVERY - C.WIND_WARN) this.wind.dirDeg = Math.floor(this.rng() * 360);
      if (ns % C.WIND_EVERY === 0) {
        if (this.wind.dirDeg == null) this.wind.dirDeg = Math.floor(this.rng() * 360);
        this.wind.active = true;
        this.wind.left = C.WIND_TICKS;
      }
    }
    let respawning = P.respawn > 0;
    if (respawning) {
      P.respawn--;
      if (P.respawn === 0) {
        P.pos = [...this.map.start];
        P.vel = [0, 0, 0];
        P.grounded = true;
        P.launched = null;
        P.dashLeft = 0;
        P.facing = [0, 1];
        P.invuln = this.ticks.invuln;
      }
    }

    // 3. move Mây
    if (!respawning) this.movePlayer(edge);
    respawning = P.respawn > 0;

    // 4. pickup motes and charms
    if (!respawning) {
      for (let i = 0; i < this.motes.length && P.carried < T.carry_capacity; ) {
        const m = this.motes[i];
        if (hd(m.pos, P.pos) <= T.pickup_radius && Math.abs(P.pos[1] - m.pos[1]) <= C.PICKUP_DY) {
          this.motes.splice(i, 1);
          P.carried++;
          this.emit('mote_picked', { carried: P.carried });
        } else i++;
      }
      for (const c of this.charms) {
        if (c.available && hd(c.pos, P.pos) <= T.pickup_radius && Math.abs(P.pos[1] - c.pos[1]) <= C.PICKUP_DY) {
          c.available = false;
          c.respawn = C.CHARM_RESPAWN;
          P.charm = C.CHARM_TICKS;
          this.emit('charm_picked', { charm_id: c.id, charm_ticks: P.charm });
        }
      }
    }

    // 5. interact with lanterns
    this.newlyLit = [];
    if (edge.interact && !respawning && P.carried > 0) {
      let best = null, bd = Infinity;
      for (const l of [...this.lanterns].sort(byId)) {
        if (l.lit) continue;
        const d = hd(l.pos, P.pos);
        if (d <= T.interact_radius && d < bd) { best = l; bd = d; }
      }
      if (best) {
        const amount = Math.min(P.carried, T.lantern_cost - best.deposited);
        if (amount > 0) {
          P.carried -= amount;
          best.deposited += amount;
          this.score += amount * T.score.per_mote;
          this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        }
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          this.score += T.score.per_lantern;
          this.emit('lantern_lit', { lantern_id: best.id });
          this.newlyLit.push(best);
        }
      }
    }

    // 6. safe zones: shades inside a just-lit lantern are expelled to the edge within 30 ticks
    const R = T.safe_radius;
    for (const l of this.newlyLit) {
      for (const s of this.shades) {
        if (hd(s.pos, l.pos) < R) s.expel = { id: l.id, pos: l.pos, ticks: C.EXPEL_TICKS };
      }
    }
    for (const s of this.shades) {
      if (!s.expel) continue;
      const e = s.expel;
      let dx = s.pos[0] - e.pos[0], dz = s.pos[2] - e.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      const nd = d + (R - d) / e.ticks;
      s.pos[0] = e.pos[0] + dx * nd;
      s.pos[2] = e.pos[2] + dz * nd;
      this.shadeY(s);
      if (--e.ticks <= 0 || nd >= R) s.expel = null;
    }

    // 7. pulse
    if (edge.pulse && !respawning && P.pulseCd === 0 && P.carried >= T.pulse_cost) {
      P.carried -= T.pulse_cost;
      P.pulseCd = this.ticks.pulseCd;
      const center = [P.pos[0], P.pos[1] + C.PULSE_UP, P.pos[2]];
      const stunned = [];
      for (const s of [...this.shades].sort(byId)) {
        if (d3(center, s.pos) > T.pulse_radius) continue;
        s.state = 'stunned';
        s.ticks = this.ticks.stun;
        s.pushLeft = C.PUSH_TICKS;
        s.pushDir = this.awayDir(s.pos);
        s.recoilLeft = 0;
        this.score += T.score.per_stun;
        stunned.push(s.id);
      }
      for (const d of [...this.drifters].sort(byId)) {
        if (d.state === 'removed' || d3(center, d.pos) > T.pulse_radius) continue;
        if (d.state === 'chase') {
          d.state = 'flee';
          d.ticks = C.DRIFTER_FLEE;
          d.hasStolen = true;
        } else if (d.state === 'flee' && d.stolen > 0) {
          const amount = d.stolen;
          for (let i = 0; i < amount; i++) this.addMote([d.pos[0], this.ground(d.pos[0], d.pos[2]) ?? 0, d.pos[2]], 'dropped');
          d.stolen = 0;
          d.ticks = C.DRIFTER_DROP_FLEE;
          this.emit('drifter_drop', { drifter_id: d.id, amount });
        }
      }
      this.emit('pulse', { stunned_ids: stunned });
    }

    // 8. move shades and drifters
    const sv = this.shadeSpeed / TICK_HZ;
    for (const s of this.shades) {
      if (s.expel) continue;
      if (s.state === 'stunned') {
        if (s.pushLeft > 0) {
          s.pushLeft--;
          const step = T.pulse_push_m / C.PUSH_TICKS;
          const nx = s.pos[0] + s.pushDir[0] * step, nz = s.pos[2] + s.pushDir[1] * step;
          if (this.towerBlocks(nx, nz, s.pos[1])) s.pushLeft = 0;
          else {
            s.pos[0] = nx; s.pos[2] = nz;
            if (this.blockSafe(s)) s.pushLeft = 0;
          }
        }
      } else if (s.state === 'recoil') {
        if (s.ticks > 0 && s.recoilLeft > 0) {
          const step = s.recoilLeft / s.ticks;
          s.pos[0] += s.recoilDir[0] * step;
          s.pos[2] += s.recoilDir[1] * step;
          s.recoilLeft -= step;
          this.blockSafe(s);
        }
      } else if (s.state === 'wander' || s.state === 'chase') {
        const d = hd(s.pos, P.pos);
        if (s.state === 'wander' && d <= C.DETECT) s.state = 'chase';
        else if (s.state === 'chase' && d > C.LOSE) { s.state = 'wander'; s.home = [s.pos[0], s.pos[2]]; s.target = null; }
        if (s.state === 'chase') this.moveToward(s, P.pos[0], P.pos[2], sv);
        else this.wanderStep(s, C.WANDER_SPEED);
        this.blockSafe(s);
      }
      this.shadeY(s);
    }
    for (const d of this.drifters) {
      if (d.state === 'removed') continue;
      if (d.state === 'idle' || d.state === 'chase') {
        const want = P.carried >= C.DRIFTER_CHASE_CARRY && hd(d.pos, P.pos) <= C.DRIFTER_CHASE_DIST && !respawning;
        if (d.state === 'idle' && want) d.state = 'chase';
        else if (d.state === 'chase' && !want) { d.state = 'idle'; d.home = [d.pos[0], d.pos[2]]; d.target = null; }
      }
      if (d.state === 'chase') this.moveToward(d, P.pos[0], P.pos[2], C.DRIFTER_SPEED / TICK_HZ);
      else if (d.state === 'idle') this.wanderStep(d, C.DRIFTER_IDLE_SPEED);
      else if (d.state === 'flee') {
        const [ax, az] = this.awayDir(d.pos);
        d.pos[0] += (ax * C.DRIFTER_SPEED) / TICK_HZ;
        d.pos[2] += (az * C.DRIFTER_SPEED) / TICK_HZ;
      }
      d.pos[1] = (this.ground(d.pos[0], d.pos[2]) ?? 0) + C.DRIFTER_Y;
    }

    // 9. contact: drifters steal first, then shades hit (ascending id), max one flame per tick
    if (!respawning) {
      for (const d of [...this.drifters].sort(byId)) {
        if ((d.state !== 'idle' && d.state !== 'chase') || d.hasStolen || P.carried <= 0) continue;
        if (hd(d.pos, P.pos) > C.DRIFTER_TOUCH) continue;
        const amount = Math.min(C.DRIFTER_STEAL, P.carried);
        P.carried -= amount;
        d.stolen = amount;
        d.hasStolen = true;
        d.state = 'flee';
        d.ticks = C.DRIFTER_FLEE;
        this.emit('drifter_steal', { drifter_id: d.id, amount, carried: P.carried });
      }
      if (P.invuln === 0) {
        for (const s of [...this.shades].sort(byId)) {
          if ((s.state !== 'wander' && s.state !== 'chase') || s.expel) continue;
          if (hd(s.pos, P.pos) > T.shade_hit_radius || Math.abs(P.pos[1] - s.pos[1]) > C.HIT_DY) continue;
          P.flames -= 1;
          const dropped = Math.floor(P.carried * T.hit_drop_ratio);
          P.carried -= dropped;
          for (let i = 0; i < dropped; i++) {
            const a = this.rng() * 2 * Math.PI, r = C.DROP_RMIN + this.rng() * (C.DROP_RMAX - C.DROP_RMIN);
            const x = P.pos[0] + r * Math.cos(a), z = P.pos[2] + r * Math.sin(a);
            this.addMote([x, this.ground(x, z) ?? P.pos[1], z], 'dropped');
          }
          P.invuln = this.ticks.invuln;
          s.state = 'recoil';
          s.ticks = C.RECOIL_TICKS;
          s.recoilLeft = C.RECOIL_M;
          s.recoilDir = this.awayDir(s.pos);
          this.emit('player_hit', { by: 'shade', flames: P.flames, dropped });
          break;
        }
      }
    }

    // 10. scheduled spawns (new entities act from next tick)
    if (this.randomMotes && ns % C.MOTE_EVERY === 0) {
      const randomCount = this.motes.filter((m) => m.kind === 'random').length;
      if (randomCount < C.MOTE_CAP) {
        const taken = new Set(this.motes.filter((m) => m.kind === 'random' && m.point != null).map((m) => m.point));
        const free = this.map.motePoints.map((_, i) => i).filter((i) => !taken.has(i));
        if (free.length) {
          const i = this.pick(free);
          this.addMote(this.map.motePoints[i], 'random', null, null, i);
        }
      }
    }
    if (this.randomShades) {
      let n = 0;
      if (ns === C.SHADE_FIRST) n = 2;
      else if (ns > C.SHADE_FIRST && (ns - C.SHADE_FIRST) % this.map.shadeEvery === 0) n = 1;
      for (let i = 0; i < n && this.shades.length < this.map.shadeMax; i++) {
        const pts = this.map.shadePoints.filter((p) => hd(p, P.pos) >= C.SHADE_MIN_DIST && !this.inSafeZone(p[0], p[2]));
        if (!pts.length) break;
        const p = this.pick(pts);
        const s = this.addShade([p[0], (this.ground(p[0], p[2]) ?? 0) + C.SHADE_Y, p[2]], null, 'spawning');
        this.emit('shade_spawned', { id: s.id });
      }
    }
    if (this.randomDrifters && ns % C.DRIFTER_EVERY === 0) {
      if (this.drifters.filter((d) => d.state !== 'removed').length < C.DRIFTER_MAX) {
        const p = this.pick(this.map.shadePoints);
        this.addDrifter([p[0], (this.ground(p[0], p[2]) ?? 0) + C.DRIFTER_Y, p[2]]);
      }
    }

    // 11. win / lose
    if (P.flames <= 0) this.end('lost', 'no_flames');
    else if (this.lanterns.every((l) => l.lit)) {
      this.end('won', 'all_lit');
      const secondsLeft = Math.max(0, Math.floor((this.endSim - ns) / TICK_HZ));
      this.score += T.score.per_second_left * secondsLeft + T.score.per_flame_left * P.flames;
    } else if (ns >= this.endSim) this.end('lost', 'dawn');
    if (this.state === 'won' || this.state === 'lost') this.emit('game_over', { result: this.state, reason: this.result });

    this.tick++;
    return this.events;
  }

  movePlayer(edge) {
    const T = this.T, P = this.player, inp = this.input;
    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (inp.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-9) P.facing = [wx / wl, wz / wl];

    // dash
    if (edge.dash && P.dashLeft === 0 && (P.dashCd === 0 || P.charm > 0)) {
      P.dashLeft = this.ticks.dashDur;
      P.dashDir = wl > 1e-9 ? [wx / wl, wz / wl] : [...P.facing];
      P.dashCd = this.ticks.dashCd;
      this.emit('dash', {});
    }
    const dashing = P.dashLeft > 0;
    // jump (only when grounded)
    if (edge.jump && P.grounded && !dashing) {
      P.vel[1] = C.JUMP_SPEED;
      P.grounded = false;
    }
    let vx, vz;
    if (dashing) {
      vx = P.dashDir[0] * T.dash_speed;
      vz = P.dashDir[1] * T.dash_speed;
      P.dashLeft--;
    } else if (P.launched) {
      [vx, vz] = P.launched;
    } else {
      const sp = P.charm > 0 ? C.CHARM_SPEED : T.player_speed;
      vx = wx * sp;
      vz = wz * sp;
    }
    if (this.wind.active) {
      const a = (this.wind.dirDeg * Math.PI) / 180;
      vx += Math.cos(a) * C.WIND_SPEED;
      vz += Math.sin(a) * C.WIND_SPEED;
    }
    // horizontal move with terrain walls (slide along axes)
    const ox = P.pos[0], oz = P.pos[2];
    const nx = ox + vx / TICK_HZ, nz = oz + vz / TICK_HZ;
    const blocked = (x, z) => {
      const h = this.ground(x, z);
      return (h != null && h > P.pos[1] + C.STEP_UP) || this.towerBlocks(x, z, P.pos[1]);
    };
    if (!blocked(nx, nz)) { P.pos[0] = nx; P.pos[2] = nz; }
    else if (!blocked(nx, oz)) P.pos[0] = nx;
    else if (!blocked(ox, nz)) P.pos[2] = nz;

    // vertical
    let vy = P.vel[1];
    if (dashing) vy = 0; // dash keeps altitude
    if (P.grounded && !dashing) {
      const h = this.ground(P.pos[0], P.pos[2]);
      if (h == null || h < P.pos[1] - C.STEP_UP) { P.grounded = false; vy = 0; }
      else { P.pos[1] = h; vy = 0; }
    }
    if (!P.grounded && !dashing) {
      const prevY = P.pos[1];
      vy -= C.GRAVITY / TICK_HZ;
      P.pos[1] += vy / TICK_HZ;
      const h = this.ground(P.pos[0], P.pos[2]);
      if (h != null && vy <= 0 && P.pos[1] <= h && prevY >= h - C.STEP_UP) {
        P.pos[1] = h;
        vy = 0;
        P.grounded = true;
        P.launched = null;
      }
    }
    // launch pads
    if (P.grounded) {
      for (const pad of this.map.pads) {
        if (hd(pad.pos, P.pos) <= 1 && Math.abs(P.pos[1] - pad.pos[1]) <= 0.1) {
          let dx, dz;
          if (pad.toward) { dx = pad.toward[0] - P.pos[0]; dz = pad.toward[1] - P.pos[2]; }
          else [dx, dz] = pad.dir;
          const dl = Math.hypot(dx, dz);
          P.launched = [(dx / dl) * pad.vh, (dz / dl) * pad.vh];
          vy = pad.vy;
          P.grounded = false;
          break;
        }
      }
    }
    P.vel = [(P.pos[0] - ox) * TICK_HZ, vy, (P.pos[2] - oz) * TICK_HZ];
    // fall off the island
    if (P.pos[1] < C.FALL_Y) {
      P.flames -= 1;
      const lost = P.carried;
      P.carried = 0;
      P.respawn = C.RESPAWN_WAIT;
      P.vel = [0, 0, 0];
      P.launched = null;
      P.dashLeft = 0;
      this.emit('player_hit', { by: 'fall', flames: P.flames, dropped: 0, lost });
    }
  }

  end(state, reason) {
    this.state = state;
    this.result = reason;
  }

  timeLeft() {
    return this.timeLeft0 - this.simTick / TICK_HZ;
  }

  snapshot() {
    const P = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: round3(Math.max(0, this.timeLeft())),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: this.wind.dirDeg },
      player: {
        pos: P.pos.map(round3), vel: P.vel.map(round3), grounded: P.grounded, flames: P.flames, carried: P.carried,
        invuln: P.invuln > 0, invuln_s: sec(P.invuln), dash_cd_s: sec(P.dashCd), pulse_cd_s: sec(P.pulseCd), charm_s: sec(P.charm),
      },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(round3), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(round3), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(round3), kind: m.kind, ttl_s: m.ttl == null ? null : sec(m.ttl) })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: d.pos.map(round3), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, pos: c.pos.map(round3), available: c.available, respawn_s: sec(c.respawn) })),
    };
  }
}
