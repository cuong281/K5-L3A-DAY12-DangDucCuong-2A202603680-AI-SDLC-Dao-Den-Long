// Validation for headless inputs/scenario files. Returns an error string or null.
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isVec3or2 = (v) => Array.isArray(v) && (v.length === 3 || v.length === 2) && v.every(isNum);

export function validateInputs(inp) {
  if (!isObj(inp)) return 'root must be an object';
  if (!Array.isArray(inp.frames)) return '"frames" must be an array';
  let last = -1;
  for (let i = 0; i < inp.frames.length; i++) {
    const f = inp.frames[i];
    const at = `frames[${i}]`;
    if (!isObj(f)) return `${at} must be an object`;
    if (!Number.isInteger(f.tick) || f.tick < 0) return `${at}.tick must be a non-negative integer`;
    if (f.tick <= last) return `${at}.tick must be strictly increasing`;
    last = f.tick;
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum)) return `${at}.move must be [x, z]`;
      if (f.move.some((c) => c < -1 || c > 1)) return `${at}.move components must be in [-1, 1]`;
    }
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) return `${at}.cam_yaw_deg must be a number`;
    for (const b of ['jump', 'interact', 'pulse', 'dash']) {
      if (f[b] !== undefined && typeof f[b] !== 'boolean') return `${at}.${b} must be boolean`;
    }
  }
  return null;
}

export function validateScenario(sc) {
  if (!isObj(sc)) return 'root must be an object';
  if (sc.player !== undefined) {
    const p = sc.player;
    if (!isObj(p)) return 'player must be an object';
    if (p.pos !== undefined && !isVec3(p.pos)) return 'player.pos must be [x, y, z]';
    if (p.carried !== undefined && !(Number.isInteger(p.carried) && p.carried >= 0)) return 'player.carried must be a non-negative integer';
    if (p.flames !== undefined && !(Number.isInteger(p.flames) && p.flames >= 0)) return 'player.flames must be a non-negative integer';
  }
  for (const f of ['random_motes', 'random_shades']) {
    if (sc[f] !== undefined && typeof sc[f] !== 'boolean') return `${f} must be boolean`;
  }
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) return 'motes must be an array';
    for (const m of sc.motes) if (!isVec3or2(m) || m.length !== 3) return 'each mote must be [x, y, z]';
  }
  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) return 'shades must be an array';
    for (const s of sc.shades) {
      if (!isObj(s) || !isVec3(s.pos)) return 'each shade must be {"pos": [x, y, z]}';
      if (s.id !== undefined && typeof s.id !== 'string') return 'shade id must be a string';
    }
    const ids = sc.shades.filter((s) => s.id).map((s) => s.id);
    if (new Set(ids).size !== ids.length) return 'shade ids must be unique';
  }
  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) return 'lanterns must be an array';
    for (const l of sc.lanterns) {
      if (!isObj(l) || typeof l.id !== 'string') return 'each lantern needs a string id';
      if (l.pos !== undefined && !isVec3(l.pos)) return `lantern ${l.id} pos must be [x, y, z]`;
      if (l.deposited !== undefined && !(Number.isInteger(l.deposited) && l.deposited >= 0)) return `lantern ${l.id} deposited must be a non-negative integer`;
      if (l.lit !== undefined && typeof l.lit !== 'boolean') return `lantern ${l.id} lit must be boolean`;
    }
  }
  if (sc.time_left_s !== undefined && !(isNum(sc.time_left_s) && sc.time_left_s >= 0)) return 'time_left_s must be a non-negative number';
  return null;
}
