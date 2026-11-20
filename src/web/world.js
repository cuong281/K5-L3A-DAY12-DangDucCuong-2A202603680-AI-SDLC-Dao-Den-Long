// Builds the static 3D terrain for a night from the standard map (src/sim/maps.js). Render only.
import * as THREE from 'three';
import { mulberry32 } from '../sim/rng.js';

export const PAL = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lit: 0xffb347, core: 0xffe9b0, off: 0x5b5f6e, moteCore: 0xfff6c2, moteGlow: 0xffe58a,
  shade: 0x120a1a, shadeEdge: 0x7a3cff, shadeStun: 0x3a3450, shirt: 0xe8e2d0, scarf: 0xc8102e,
  gold: 0xf2c14e, drifter: 0x8fa3b8, danger: 0xff5a5f, text: 0xf5f1e6,
};

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function islandDisc(r, x = 0, z = 0) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 64), mat(PAL.grass));
  top.position.y = -0.3;
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.01, r * 0.85, 1.4, 64), mat(PAL.sand));
  beach.position.y = -1.3;
  const rock = new THREE.Mesh(new THREE.ConeGeometry(r * 0.85, r * 0.5, 32), mat(0x3a3550));
  rock.rotation.x = Math.PI;
  rock.position.y = -2 - r * 0.25;
  g.add(top, beach, rock);
  g.position.set(x, 0, z);
  return g;
}

function trees(group, n, seed, ok) {
  const r = mulberry32(seed);
  const trunkM = mat(PAL.wood), leafM = mat(0x24473d);
  for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
    const x = (r() * 2 - 1) * 45, z = (r() * 2 - 1) * 45;
    const y = ok(x, z);
    if (y == null) continue;
    i++;
    const t = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6), trunkM);
    tr.position.y = 0.6;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9 + r() * 0.5, 2.2, 7), leafM);
    cone.position.y = 2.1;
    t.add(tr, cone);
    t.position.set(x, y, z);
    group.add(t);
  }
}

function pad(p) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.16, 24), mat(PAL.wood));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 8, 24), new THREE.MeshBasicMaterial({ color: PAL.gold }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  g.add(base, ring);
  g.position.set(p[0], p[1] + 0.02, p[2]);
  return g;
}

export function buildWorld(night, map, lanterns) {
  const g = new THREE.Group();
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshBasicMaterial({ color: PAL.sea }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -12;
  g.add(sea);
  // keep decoration away from gameplay spots
  const clear = (x, z) =>
    lanterns.some((l) => Math.hypot(x - l[0], z - l[2]) < 7) ||
    map.motePoints.some((p) => Math.hypot(x - p[0], z - p[2]) < 2.5) ||
    map.pads.some((p) => Math.hypot(x - p.pos[0], z - p.pos[2]) < 3) ||
    Math.hypot(x - map.start[0], z - map.start[2]) < 5;
  const treeOk = (x, z) => {
    const h = map.ground(x, z);
    if (h == null || clear(x, z)) return null;
    if (map.ground(x + 1.5, z) !== h || map.ground(x - 1.5, z) !== h || map.ground(x, z + 1.5) !== h || map.ground(x, z - 1.5) !== h) return null;
    return h;
  };
  if (night === 1) {
    g.add(islandDisc(40));
    trees(g, 30, 11, treeOk);
  } else if (night === 2) {
    g.add(islandDisc(28, 0, 0), islandDisc(28, 70, 0));
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(PAL.wood));
    bridge.position.set(35, -0.15, 0);
    g.add(bridge);
    const plankM = mat(0x5a3d26);
    for (let x = 26.5; x < 44; x += 1.2) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 4), plankM);
      p.position.set(x, 0.01, 0);
      g.add(p);
    }
    trees(g, 26, 22, treeOk);
  } else {
    g.add(islandDisc(45));
    // tier 1: half annulus r 12..24, z > 0, height 3
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false);
    sh.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 32 }), mat(0x3b6b5c));
    t1.rotation.x = -Math.PI / 2; // shape y<0 -> world z>0, depth -> world y
    g.add(t1);
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), mat(0x467a69));
    t2.position.y = 3;
    g.add(t2);
    // ramps at 30° and 150°: r 30 (y 0) -> r 24 (y 3)
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180;
      const len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, len), mat(PAL.sand));
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      ramp.rotation.x = Math.atan2(3, 6);
      ramp.position.set(27 * Math.cos(a), 1.35, 27 * Math.sin(a));
      g.add(ramp);
    }
    // bell tower on tier 2
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), mat(0x8a6a4a));
    tower.position.y = 10;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.2, 24), mat(0x8a2a1a));
    roof.position.y = 15.1;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), mat(PAL.gold, { emissive: 0x3a2a00 }));
    bell.position.y = 13;
    g.add(tower, roof, bell);
    trees(g, 30, 33, treeOk);
  }
  for (const p of map.pads) g.add(pad(p.pos));
  return g;
}
