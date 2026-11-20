// Validation for headless inputs/scenario files (Test Contract v1.1). Returns an error string or null.
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isNat = (v) => Number.isInteger(v) && v >= 0;
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];
const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];

export function validateInputs(inp) {
  if (!isObj(inp)) return 'root must be an object';
  if (!Array.isArray(inp.frames)) return '"frames" must be an array';
  let last = -1;
  for (let i = 0; i < inp.frames.length; i++) {
    const f = inp.frames[i];
    const at = `frames[${i}]`;
    if (!isObj(f)) return `${at} must be an object`;
    if (!isNat(f.tick)) return `${at}.tick must be a non-negative integer`;
    if (f.tick <= last) return `${at}.tick must be strictly increasing`;
    last = f.tick;
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum)) return `${at}.move must be [x, z]`;
      if (f.move.some((c) => c < -1 || c > 1)) return `${at}.move components must be in [-1, 1]`;
    }
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) return `${at}.cam_yaw_deg must be a number`;
    for (const b of BUTTONS) if (f[b] !== undefined && typeof f[b] !== 'boolean') return `${at}.${b} must be boolean`;
  }
  return null;
}

export function validateScenario(sc) {
  if (!isObj(sc)) return 'root must be an object';
  if (sc.player !== undefined) {
    const p = sc.player;
    if (!isObj(p)) return 'player must be an object';
    if (p.pos !== undefined && !isVec3(p.pos)) return 'player.pos must be [x, y, z]';
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights']) {
      if (p[k] !== undefined && !isNat(p[k])) return `player.${k} must be a non-negative integer`;
    }
  }
  for (const f of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (sc[f] !== undefined && typeof sc[f] !== 'boolean') return `${f} must be boolean`;
  }
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) return 'motes must be an array';
    for (const m of sc.motes) {
      if (isVec3(m)) continue;
      if (!isObj(m) || !isVec3(m.pos)) return 'each mote must be [x, y, z] or {"pos": [x, y, z]}';
      if (m.kind !== undefined && m.kind !== 'random' && m.kind !== 'dropped') return 'mote kind must be random or dropped';
    }
  }
  const checkList = (name, arr, states, extra) => {
    if (arr === undefined) return null;
    if (!Array.isArray(arr)) return `${name} must be an array`;
    for (const e of arr) {
      if (!isObj(e) || !isVec3(e.pos)) return `each ${name} entry must be {"pos": [x, y, z]}`;
      if (e.id !== undefined && typeof e.id !== 'string') return `${name} id must be a string`;
      if (e.state !== undefined && !states.includes(e.state)) return `${name} state must be one of ${states.join(', ')}`;
      const err = extra(e);
      if (err) return err;
    }
    const ids = arr.filter((e) => e.id).map((e) => e.id);
    if (new Set(ids).size !== ids.length) return `${name} ids must be unique`;
    return null;
  };
  let err =
    checkList('shades', sc.shades, SHADE_STATES, (s) => (s.state_ticks_left !== undefined && !isNat(s.state_ticks_left) ? 'state_ticks_left must be a non-negative integer' : s.target_lantern_id !== undefined && typeof s.target_lantern_id !== 'string' ? 'target_lantern_id must be a string' : null)) ||
    checkList('drifters', sc.drifters, DRIFTER_STATES, (d) => (d.stolen !== undefined && !isNat(d.stolen) ? 'drifter stolen must be a non-negative integer' : null)) ||
    checkList('charms', sc.charms, [], (c) => (c.available !== undefined && typeof c.available !== 'boolean' ? 'charm available must be boolean' : null));
  if (err) return err;
  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) return 'lanterns must be an array';
    for (const l of sc.lanterns) {
      if (!isObj(l) || typeof l.id !== 'string') return 'each lantern needs a string id';
      if (l.pos !== undefined && !isVec3(l.pos)) return `lantern ${l.id} pos must be [x, y, z]`;
      if (l.deposited !== undefined && !isNat(l.deposited)) return `lantern ${l.id} deposited must be a non-negative integer`;
      if (l.lit !== undefined && typeof l.lit !== 'boolean') return `lantern ${l.id} lit must be boolean`;
      if (l.ever_lit !== undefined && typeof l.ever_lit !== 'boolean') return `lantern ${l.id} ever_lit must be boolean`;
      if (l.fuel !== undefined && !(isNum(l.fuel) && l.fuel >= 0 && l.fuel <= 100)) return `lantern ${l.id} fuel must be a number in [0, 100]`;
    }
  }
  if (sc.time_left_s !== undefined && !(isNum(sc.time_left_s) && sc.time_left_s >= 0)) return 'time_left_s must be a non-negative number';
  return null;
}
