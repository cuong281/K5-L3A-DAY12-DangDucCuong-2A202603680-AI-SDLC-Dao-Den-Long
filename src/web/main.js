// Web renderer for Đảo Đèn Lồng. All gameplay lives in src/sim/sim.js;
// this file only reads input, steps the sim at a fixed 60 Hz and draws.
// Render-only extras (sky lanterns, chimes, pulse ring) never touch the sim.
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { Game, TICK_HZ, ISLAND_RADIUS } from '../sim/sim.js';
import { mulberry32 } from '../sim/rng.js';
import { Sfx } from './sfx.js';

const T = contract.tuning;
const params = new URLSearchParams(location.search);
const DT = 1 / TICK_HZ;

// ---------- three.js setup ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const NIGHT = new THREE.Color(0x120a20), DAWNISH = new THREE.Color(0x3a2440);
scene.background = NIGHT.clone();
scene.fog = new THREE.FogExp2(0x1a0d2a, 0.022);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight(0x8a7ac0, 0x2a1830, 0.8);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8899ff, 0.25);
moon.position.set(-30, 50, -20);
scene.add(moon);

// island (top surface at y = 0)
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.55, 6, 64),
  new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 1 }),
);
island.position.y = -3;
scene.add(island);
// cloud sea
const clouds = new THREE.Mesh(new THREE.CircleGeometry(300, 48), new THREE.MeshBasicMaterial({ color: 0x2a1a40 }));
clouds.rotation.x = -Math.PI / 2;
clouds.position.y = -8;
scene.add(clouds);
// decoration (render-only RNG, separate from the sim's)
{
  const r = mulberry32(99);
  const trunk = new THREE.MeshStandardMaterial({ color: 0x3b2a20 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x1f3a2c });
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = 8 + r() * 30;
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (Math.abs(d - 25) < 4) continue; // keep lantern ring clear
    const t = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2), trunk);
    tr.position.y = 0.6;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9 + r() * 0.5, 2.2, 7), leaf);
    cone.position.y = 2.1;
    t.add(tr, cone);
    t.position.set(x, 0, z);
    scene.add(t);
  }
  const stars = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 600; i++) {
    const a = r() * Math.PI * 2, e = r() * 1.2 + 0.15, R = 200;
    pts.push(Math.cos(e) * Math.sin(a) * R, Math.sin(e) * R, Math.cos(e) * Math.cos(a) * R);
  }
  stars.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xfff2cc, size: 0.8, fog: false })));
}

// ---------- player: Mây with nón lá and a small lantern ----------
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.0, 12), new THREE.MeshStandardMaterial({ color: 0x4a7bd0 }));
  body.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf2c9a0 }));
  head.position.y = 1.25;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 24), new THREE.MeshStandardMaterial({ color: 0xe8cf8a }));
  hat.position.y = 1.62;
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff8a20, emissiveIntensity: 2 }));
  lantern.position.set(0, 1.18, 0.7);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), new THREE.MeshBasicMaterial({ color: 0x553311 }));
  string.position.set(0, 1.38, 0.7);
  const light = new THREE.PointLight(0xffa040, 2, 10, 1.5);
  light.position.copy(lantern.position);
  g.add(body, head, hat, lantern, string, light);
  g.userData = { light, lantern };
  return g;
}
const may = makeMay();
scene.add(may);

// ---------- lanterns ----------
const lanternViews = new Map();
function makeLantern(l) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2), new THREE.MeshStandardMaterial({ color: 0x5a3a28 }));
  pole.position.y = 1.6;
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x553355, emissive: 0x000000 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 10), lampMat);
  lamp.position.y = 3.6;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x8a2a1a }));
  cap.position.y = 4.25;
  const light = new THREE.PointLight(0xffaa55, 0, 26, 1.2);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.15, T.safe_radius, 48), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(pole, lamp, cap, light, ring);
  g.position.set(l.pos[0], 0, l.pos[2]);
  scene.add(g);
  return { g, lampMat, light, ring };
}

// ---------- motes & shades (synced by id) ----------
const moteGeo = new THREE.SphereGeometry(0.16, 10, 8);
const moteMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc040, emissiveIntensity: 2.5 });
const moteViews = new Map();
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
const shadeViews = new Map();
function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a0828, emissive: 0x30104a, transparent: true, opacity: 0.92 });
  const blob = new THREE.Mesh(shadeGeo, mat);
  blob.scale.set(1, 1.25, 1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc070ff });
  for (const x of [-0.25, 0.25]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
    eye.position.set(x, 0.3, 0.68);
    g.add(eye);
  }
  g.add(blob);
  scene.add(g);
  return { g, mat };
}
function syncById(views, items, make) {
  const seen = new Set();
  for (const it of items) {
    seen.add(it.id);
    if (!views.has(it.id)) views.set(it.id, make(it));
  }
  for (const [id, v] of views) {
    if (!seen.has(id)) {
      scene.remove(v.g ?? v);
      views.delete(id);
    }
  }
}

// ---------- render-only effects (creative) ----------
const effects = [];
function pulseRing(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.9, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos[0], 0.1, pos[2]);
  scene.add(m);
  effects.push({ m, t: 0, dur: 0.45, kind: 'ring' });
}
function skyLanterns(pos) {
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8a30, emissiveIntensity: 1.6 }));
    m.position.set(pos[0] + (Math.random() - 0.5) * 3, 3, pos[2] + (Math.random() - 0.5) * 3);
    scene.add(m);
    effects.push({ m, t: 0, dur: 9, kind: 'sky', vx: (Math.random() - 0.5) * 0.6, vy: 1.4 + Math.random() * 0.8 });
  }
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const k = e.t / e.dur;
    if (e.kind === 'ring') {
      const s = 1 + k * T.pulse_radius;
      e.m.scale.set(s, s, s);
      e.m.material.opacity = 0.9 * (1 - k);
    } else {
      e.m.position.y += e.vy * dt;
      e.m.position.x += e.vx * dt;
      e.m.material.emissiveIntensity = 1.6 * (1 - k * 0.7);
    }
    if (k >= 1) {
      scene.remove(e.m);
      effects.splice(i, 1);
    }
  }
}

// ---------- input ----------
const keys = new Set();
let camYaw = 0;
let dragging = false, lastX = 0;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  if (mode === 'menu' && (e.code === 'Enter' || e.code === 'Space')) startGame();
  else if (mode === 'over' && e.code === 'KeyR') startGame();
  sfx.unlock();
});
addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.3;
  lastX = e.clientX;
});
function readFrame() {
  // screen-right is -X when the camera looks along +Z, hence the sign on x
  let x = 0, z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA')) x += 1;
  if (keys.has('KeyD')) x -= 1;
  if (keys.has('ArrowLeft') || keys.has('KeyQ')) camYaw += 120 * DT;
  if (keys.has('ArrowRight') || keys.has('KeyC')) camYaw -= 120 * DT;
  return { move: [x, z], cam_yaw_deg: camYaw, jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyF') };
}

// ---------- game state / UI ----------
const sfx = new Sfx();
const hud = document.getElementById('hud');
const hint = document.getElementById('hint');
const overlay = document.getElementById('overlay');
const card = document.getElementById('card');
let game, mode = 'menu', acc = 0, facing = 0, hitFlash = 0;

function startGame() {
  for (const v of lanternViews.values()) scene.remove(v.g);
  lanternViews.clear();
  for (const v of [...moteViews.values()]) scene.remove(v);
  moteViews.clear();
  for (const v of [...shadeViews.values()]) scene.remove(v.g);
  shadeViews.clear();
  // ?lit=N pre-lights N lanterns via a scenario (used for proof screenshots)
  const litN = parseInt(params.get('lit') || '0', 10);
  const scenario = litN > 0 ? { lanterns: game.lanterns.slice(0, litN).map((l) => ({ id: l.id, lit: true })) } : null;
  game = new Game(T, { seed: parseInt(params.get('seed') || String(Date.now() & 0x7fffffff), 10), scenario });
  for (const l of game.lanterns) lanternViews.set(l.id, makeLantern(l));
  camYaw = 0;
  acc = 0;
  mode = 'playing';
  overlay.style.display = 'none';
}

function showMenu() {
  card.innerHTML = `<h1>Đảo Đèn Lồng</h1><p><i>Đêm 1 — Đảo Bến</i></p>
  <p>Sương đen đã nuốt hết ánh sáng của đảo. Hãy giúp <b>Mây</b> gom đom đóm và thắp lại
  <b>${T.lantern_count_night1} Đèn Lồng Lớn</b> trước khi trời sáng. Tránh xa <b>Bóng Mực</b> tím đen!</p>
  <p><kbd>W A S D</kbd> đi · <kbd>Space</kbd> nhảy · kéo chuột hoặc <kbd>Q</kbd>/<kbd>C</kbd> xoay camera<br>
  <kbd>E</kbd> nạp đèn · <kbd>F</kbd> tỏa sáng (tốn ${T.pulse_cost} đom đóm)</p>
  <p><b>Nhấn Enter để bắt đầu</b></p>`;
  overlay.style.display = 'flex';
}
function showOver() {
  const won = game.state === 'won';
  const why = { all_lit: 'Mọi đèn đã sáng trở lại!', dawn: 'Trời đã sáng mà đảo vẫn chưa được thắp hết.', no_flames: 'Ngọn lửa của Mây đã tắt.' }[game.result];
  card.innerHTML = `<h1>${won ? 'Chiến thắng!' : 'Thua rồi…'}</h1><p>${why}</p>
  <p>Điểm: <b>${game.score}</b> · Đèn: ${game.lanterns.filter((l) => l.lit).length}/${game.lanterns.length}</p>
  <p><b>Nhấn R để chơi lại</b></p>`;
  overlay.style.display = 'flex';
  mode = 'over';
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.name) {
      case 'mote_picked': sfx.pick(e.data.carried); break;
      case 'deposit': sfx.deposit(); break;
      case 'lantern_lit': {
        const l = game.lanterns.find((x) => x.id === e.data.lantern_id);
        skyLanterns(l.pos);
        sfx.lit();
        break;
      }
      case 'pulse': pulseRing(game.player.pos); sfx.pulse(); break;
      case 'player_hit': hitFlash = 0.4; sfx.hit(); break;
      case 'game_over': e.data.result === 'won' ? sfx.win() : sfx.lose(); break;
    }
  }
}

function updateHud() {
  const P = game.player;
  const lit = game.lanterns.filter((l) => l.lit).length;
  const t = Math.max(0, game.timeLeft());
  const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(Math.floor(t % 60)).padStart(2, '0');
  const cd = game.pulseReadyIn();
  hud.innerHTML = `Lửa: <b>${'●'.repeat(Math.max(0, P.flames))}${'○'.repeat(Math.max(0, T.flames - P.flames))}</b><br>
  Đom đóm: <b>${P.carried}/${T.carry_capacity}</b><br>
  Đèn đã thắp: <b>${lit}/${game.lanterns.length}</b><br>
  Trời sáng sau: <b>${mm}:${ss}</b><br>
  Điểm: <b>${game.score}</b><br>
  Tỏa sáng: ${cd > 0 ? `chờ ${cd.toFixed(1)}s` : P.carried >= T.pulse_cost ? '<b>sẵn sàng (F)</b>' : 'cần đom đóm'}`;
  // context hint near a lantern
  let near = null;
  for (const l of game.lanterns) {
    if (!l.lit && Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]) <= T.interact_radius) near = l;
  }
  if (near) {
    hint.style.display = 'block';
    hint.textContent = P.carried > 0 ? `Nhấn E để nạp đèn ${near.id} (${near.deposited}/${T.lantern_cost})` : `Đèn ${near.id} cần ${T.lantern_cost - near.deposited} đom đóm nữa`;
  } else hint.style.display = 'none';
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  const time = now / 1000;

  if (mode === 'playing') {
    acc += dt;
    while (acc >= DT && game.state === 'playing') {
      game.applyFrame(readFrame());
      handleEvents(game.step());
      acc -= DT;
    }
    if (game.state !== 'playing') showOver();
  }
  if (game) draw(dt, time);
  updateEffects(dt);
  renderer.render(scene, camera);
}

function draw(dt, time) {
  const P = game.player;
  // player
  const prev = may.position.clone();
  may.position.set(P.pos[0], P.pos[1], P.pos[2]);
  const dx = may.position.x - prev.x, dz = may.position.z - prev.z;
  if (dx * dx + dz * dz > 1e-6) facing = Math.atan2(dx, dz);
  may.rotation.y += ((facing - may.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 12);
  may.userData.light.intensity = 1.2 + P.carried * 0.25 + Math.sin(time * 6) * 0.1;
  may.visible = !(hitFlash > 0 && Math.floor(time * 20) % 2 === 0);
  hitFlash = Math.max(0, hitFlash - dt);

  // lanterns + island brightening
  let lit = 0;
  for (const l of game.lanterns) {
    const v = lanternViews.get(l.id);
    v.g.position.set(l.pos[0], 0, l.pos[2]);
    const fill = l.lit ? 1 : l.deposited / T.lantern_cost;
    v.lampMat.emissive.setRGB(1 * fill, 0.55 * fill, 0.15 * fill);
    v.lampMat.emissiveIntensity = l.lit ? 2.2 : 0.8;
    v.light.intensity = l.lit ? 30 + Math.sin(time * 3 + l.pos[0]) * 2 : fill * 4;
    v.ring.material.opacity = l.lit ? 0.35 : 0;
    if (l.lit) lit++;
  }
  const k = lit / game.lanterns.length;
  hemi.intensity = 0.8 + k * 1.0;
  scene.background.copy(NIGHT).lerp(DAWNISH, k);
  scene.fog.density = 0.022 - k * 0.012;

  // motes
  syncById(moteViews, game.motes, (m) => {
    const mesh = new THREE.Mesh(moteGeo, moteMat);
    scene.add(mesh);
    return mesh;
  });
  for (const m of game.motes) {
    const mesh = moteViews.get(m.id);
    const ph = parseInt(m.id.slice(1), 10);
    mesh.position.set(m.pos[0], 0.8 + Math.sin(time * 2 + ph) * 0.25, m.pos[2]);
  }
  // shades
  syncById(shadeViews, game.shades, makeShade);
  for (const s of game.shades) {
    const v = shadeViews.get(s.id);
    v.g.position.set(s.pos[0], s.pos[1] + Math.sin(time * 3 + s.id.length) * 0.1, s.pos[2]);
    v.g.lookAt(P.pos[0], v.g.position.y, P.pos[2]);
    const stunned = s.state === 'stunned';
    v.mat.opacity = stunned ? 0.4 : 0.92;
    v.g.scale.setScalar(stunned ? 0.75 : 1);
  }

  // camera behind the player along cam yaw (forward = (sinθ, cosθ))
  const th = (camYaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  const target = new THREE.Vector3(P.pos[0], P.pos[1] + 1.4, P.pos[2]);
  const want = new THREE.Vector3(P.pos[0] - fx * 8, P.pos[1] + 5, P.pos[2] - fz * 8);
  camera.position.lerp(want, Math.min(1, dt * 8));
  camera.lookAt(target);

  if (mode === 'playing') updateHud();
}

showMenu();
// idle camera for the menu
game = new Game(T, { seed: 1 });
for (const l of game.lanterns) lanternViews.set(l.id, makeLantern(l));
camera.position.set(0, 12, -22);
if (params.has('autostart')) startGame();
requestAnimationFrame(frame);
