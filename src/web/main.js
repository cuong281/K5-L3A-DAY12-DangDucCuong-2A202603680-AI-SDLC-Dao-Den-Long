// Web client for Đảo Đèn Lồng. All rules live in src/sim/sim.js; this file reads input,
// steps the sim at a fixed 60 Hz, and draws. Render-only extras never touch the sim.
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { Game, TICK_HZ, C } from '../sim/sim.js';
import { NIGHTS } from '../sim/maps.js';
import { Sfx } from './sfx.js';
import { buildWorld, PAL } from './world.js';
import { makeBenchGame, benchCamera, BENCH } from '../sim/benchScene.js';
import { validName, makeEntry, addEntry, exportLeaderboard } from '../leaderboard.js';

const T = contract.tuning;
const DT = 1 / TICK_HZ;
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ---------- settings (persisted) ----------
// remappable actions (Ticket-04 §4)
const ACTIONS = { forward: 'Đi tới', back: 'Đi lùi', left: 'Sang trái', right: 'Sang phải', jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác', pulse: 'Tỏa sáng', pause: 'Tạm dừng' };
const DEFAULT_KEYS = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'Escape' };
const settings = { volume: 0.7, sens: 1, colorblind: false, reduceMotion: false, bigText: false, keys: { ...DEFAULT_KEYS } };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch {}
settings.keys = { ...DEFAULT_KEYS, ...(settings.keys || {}) };
const keyName = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift trái').replace('ShiftRight', 'Shift phải').replace('Space', 'Space');
const duplicateKeys = () => {
  const by = {};
  for (const [a, c] of Object.entries(settings.keys)) (by[c] ||= []).push(ACTIONS[a]);
  return Object.entries(by).filter(([, v]) => v.length > 1);
};
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch {} };
const sfx = new Sfx(settings.volume);
// colour-blind palette (Ticket-03 §6): shade edge/eyes #7A3CFF -> #00B3FF, UI danger #FF5A5F -> #FFFFFF + ⚠
const CB_EDGE = 0x00b3ff;
function applyPalette() {
  document.body.classList.toggle('cb', !!settings.colorblind);
  document.documentElement.classList.toggle('big', !!settings.bigText);
  shadeEdgeMat.color.set(settings.colorblind ? CB_EDGE : PAL.shadeEdge);
  eyeMat.color.set(settings.colorblind ? CB_EDGE : PAL.shadeEdge);
}

// ---------- three.js ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.FogExp2(PAL.fog, 0.018);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
// ambient = 0.15 + 0.55 x (lit / total)  (Ticket-02)
const ambient = new THREE.AmbientLight(0xb8c0ff, 0.15);
const moon = new THREE.DirectionalLight(0x9aa8ff, 0.35);
moon.position.set(-30, 60, -20);
scene.add(ambient, moon);
{
  const pts = [];
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.12, R = 300;
    pts.push(Math.cos(e) * Math.sin(a) * R, Math.sin(e) * R, Math.cos(e) * Math.cos(a) * R);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff2cc, size: 1, fog: false })));
}

// ---------- Mây ----------
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.0, 12), new THREE.MeshLambertMaterial({ color: PAL.shirt }));
  body.position.y = 0.5;
  const scarfM = new THREE.MeshLambertMaterial({ color: PAL.scarf });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 8, 16), scarfM);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.02;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.04), scarfM);
  tail.position.set(0.12, 0.85, -0.28);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshLambertMaterial({ color: 0xf2c9a0 }));
  head.position.y = 1.28;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 24), new THREE.MeshLambertMaterial({ color: PAL.sand }));
  hat.position.y = 1.65;
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: PAL.lit }));
  lantern.position.set(0, 1.2, 0.72);
  const light = new THREE.PointLight(PAL.lit, 2, 10, 1.5);
  light.position.copy(lantern.position);
  g.add(body, scarf, tail, head, hat, lantern, light);
  g.userData = { light };
  return g;
}
const may = makeMay();
scene.add(may);

// ---------- dynamic entity views ----------
const moteGeo = new THREE.SphereGeometry(0.14, 10, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: PAL.moteCore });
const glowMat = new THREE.MeshBasicMaterial({ color: PAL.moteGlow, transparent: true, opacity: 0.35, depthWrite: false });
const glowGeo = new THREE.SphereGeometry(0.32, 10, 8);
const dropMat = new THREE.MeshBasicMaterial({ color: PAL.moteGlow });
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
const shadeEdgeMat = new THREE.MeshBasicMaterial({ color: PAL.shadeEdge, side: THREE.BackSide });
const eyeMat = new THREE.MeshBasicMaterial({ color: PAL.shadeEdge });
const eyeGeo = new THREE.SphereGeometry(0.09, 8, 6);

let views = { motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map(), lanterns: new Map() };
let world = null;

function makeMote(m) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(moteGeo, m.kind === 'dropped' ? dropMat : moteMat), new THREE.Mesh(glowGeo, glowMat));
  return g;
}
function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shadeGeo, new THREE.MeshBasicMaterial({ color: PAL.shade }));
  body.scale.set(1, 1.25, 1);
  const edge = new THREE.Mesh(shadeGeo, shadeEdgeMat);
  edge.scale.set(1.1, 1.36, 1.1);
  for (const x of [-0.25, 0.25]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, 0.3, 0.7);
    g.add(eye);
  }
  g.add(body, edge);
  g.userData = { body };
  return g;
}
function makeDrifter() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: PAL.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), m);
    seg.position.z = -i * 0.55;
    g.add(seg);
  }
  return g;
}
function makeCharm() {
  const g = new THREE.Group();
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.05), new THREE.MeshBasicMaterial({ color: PAL.gold }));
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.78, 0.07), new THREE.MeshBasicMaterial({ color: PAL.scarf }));
  g.add(border, paper);
  return g;
}
function makeLantern(l) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), new THREE.MeshLambertMaterial({ color: PAL.wood }));
  pole.position.y = 1.6;
  const lampMat = new THREE.MeshBasicMaterial({ color: PAL.off });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 10), lampMat);
  lamp.position.y = 3.6;
  const coreMat = new THREE.MeshBasicMaterial({ color: PAL.core, transparent: true, opacity: 0 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), coreMat);
  core.position.y = 3.6;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.4, 10), new THREE.MeshLambertMaterial({ color: 0x8a2a1a }));
  cap.position.y = 4.25;
  const light = new THREE.PointLight(PAL.lit, 0, 24, 1.3);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.15, T.safe_radius, 48), new THREE.MeshBasicMaterial({ color: PAL.lit, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  // torn paper patch, shown when the lantern is out (distinguishable without colour)
  const tear = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.04), new THREE.MeshBasicMaterial({ color: 0x15182a }));
  tear.position.set(0.2, 3.55, 0.47);
  tear.rotation.z = 0.5;
  const lampGroup = new THREE.Group();
  lampGroup.add(lamp, core, tear);
  // fuel bar (billboard above the lantern)
  const bar = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), new THREE.MeshBasicMaterial({ color: 0x0e1430 }));
  const fillMat = new THREE.MeshBasicMaterial({ color: PAL.lit });
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.12), fillMat);
  fill.position.z = 0.01;
  bar.add(bg, fill);
  bar.position.y = 5;
  g.add(pole, lampGroup, cap, light, ring, bar);
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);
  scene.add(g);
  return { g, lampMat, coreMat, light, ring, lampGroup, tear, bar, fill, fillMat };
}
function sync(map, items, make) {
  const seen = new Set();
  for (const it of items) {
    seen.add(it.id);
    if (!map.has(it.id)) {
      const v = make(it);
      scene.add(v);
      map.set(it.id, v);
    }
  }
  for (const [id, v] of map) if (!seen.has(id)) { scene.remove(v); map.delete(id); }
}
function clearViews() {
  for (const k of ['motes', 'shades', 'drifters', 'charms']) for (const v of views[k].values()) scene.remove(v);
  for (const v of views.lanterns.values()) scene.remove(v.g);
  views = { motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map(), lanterns: new Map() };
}

// ---------- render-only effects (creative) ----------
const effects = [];
function addEffect(m, dur, update) { scene.add(m); effects.push({ m, t: 0, dur, update }); }
function pulseRing(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.9, 48), new THREE.MeshBasicMaterial({ color: PAL.core, transparent: true, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos[0], pos[1] + 0.1, pos[2]);
  addEffect(m, 0.45, (e, k) => { const s = 1 + k * T.pulse_radius; e.m.scale.set(s, s, s); e.m.material.opacity = 0.9 * (1 - k); });
}
function skyLanterns(pos) {
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.4, 8), new THREE.MeshBasicMaterial({ color: PAL.lit, transparent: true }));
    m.position.set(pos[0] + (Math.random() - 0.5) * 3, pos[1] + 3, pos[2] + (Math.random() - 0.5) * 3);
    const vx = (Math.random() - 0.5) * 0.6, vy = 1.4 + Math.random() * 0.8;
    addEffect(m, 9, (e, k, dt) => { e.m.position.y += vy * dt; e.m.position.x += vx * dt; e.m.material.opacity = 1 - k; });
  }
}
const leafMat = new THREE.MeshBasicMaterial({ color: 0x9fcf8a, side: THREE.DoubleSide });
const leafGeo = new THREE.PlaneGeometry(0.25, 0.12);
function windLeaf(dirDeg) {
  const P = game.player.pos;
  const a = (dirDeg * Math.PI) / 180;
  const m = new THREE.Mesh(leafGeo, leafMat);
  const back = 12 + Math.random() * 6, side = (Math.random() - 0.5) * 16;
  m.position.set(P[0] - Math.cos(a) * back - Math.sin(a) * side, P[1] + 0.5 + Math.random() * 3, P[2] - Math.sin(a) * back + Math.cos(a) * side);
  addEffect(m, 2.5, (e, k, dt) => { e.m.position.x += Math.cos(a) * 10 * dt; e.m.position.z += Math.sin(a) * 10 * dt; e.m.rotation.x += 8 * dt; e.m.rotation.y += 5 * dt; });
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const k = Math.min(1, e.t / e.dur);
    e.update(e, k, dt);
    if (k >= 1) { scene.remove(e.m); effects.splice(i, 1); }
  }
}

// ---------- input ----------
const keys = new Set();
let camYaw = 0, dragging = false, lastX = 0;
let capturing = null; // action waiting for a new key in the rebinding screen
addEventListener('keydown', (e) => {
  sfx.unlock();
  if (capturing) {
    e.preventDefault();
    settings.keys[capturing] = e.code;
    capturing = null;
    saveSettings();
    showKeys();
    return;
  }
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') { if (e.code === 'Enter') e.target.dispatchEvent(new Event('submit-name')); return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && mode === 'playing') e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  onKey(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; sfx.unlock(); });
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (!dragging || mode !== 'playing') return;
  camYaw -= (e.clientX - lastX) * 0.3 * settings.sens;
  lastX = e.clientX;
});
function readFrame() {
  let x = 0, z = 0;
  const K = settings.keys, on = (a) => keys.has(K[a]);
  if (on('forward') || keys.has('ArrowUp')) z += 1;
  if (on('back') || keys.has('ArrowDown')) z -= 1;
  if (on('left')) x += 1; // screen-right is -X when looking along +Z
  if (on('right')) x -= 1;
  if (keys.has('ArrowLeft') || keys.has('KeyQ')) camYaw += 120 * DT * settings.sens;
  if (keys.has('ArrowRight') || keys.has('KeyC')) camYaw -= 120 * DT * settings.sens;
  return {
    move: [x, z], cam_yaw_deg: camYaw, jump: on('jump'), interact: on('interact'), pulse: on('pulse'), dash: on('dash'),
  };
}

// ---------- game flow: menu -> intro -> play -> result -> next night ----------
const INTRO = {
  1: 'Ông Đăng: "Mây ơi, sương đen đã nuốt hết đèn của Đảo Bến. Đèn giờ cạn dầu nhanh lắm, cháu phải giữ cho chúng sáng tới khi trời rạng."',
  2: 'Ông Đăng: "Đảo Cau có hai hòn nối bằng cây cầu tre. Bục nhảy sẽ đưa cháu sang nhanh. Coi chừng Gió Lạc, chúng thích cướp đom đóm lắm."',
  3: 'Ông Đăng: "Đảo Chuông cao ba tầng, gió mạnh thổi từng cơn. Nghe lá bay là biết gió sắp tới. Thắp bảy ngọn đèn là bình minh về."',
};
let game = null, mode = 'menu', night = 1, acc = 0, wonScores = {}, lastCount = 0, windWarned = false, menuReturn = 'menu';
let fpsFrames = 0, fpsTime = 0, runSeed = Date.now() & 0x7fffff, shake = 0, lowWarned = new Set(), tenWarned = false, shadeAlert = null;
const benchMode = params.has('benchscene');
const bench = benchMode ? { duration: parseFloat(params.get('duration') || '30'), seed: parseInt(params.get('seed') || '42', 10), t0: null, last: null, dts: [] } : null;
const totalScore = () => Object.values(wonScores).reduce((a, b) => a + b, 0);

function loadNight(n, scenario = null) {
  night = n;
  if (world) scene.remove(world);
  clearViews();
  const seed = params.has('seed') ? parseInt(params.get('seed'), 10) : runSeed + n - 1;
  game = new Game(T, { seed, night: n, scenario });
  world = buildWorld(n, NIGHTS[n], game.lanterns.map((l) => l.pos));
  scene.add(world);
  for (const l of game.lanterns) views.lanterns.set(l.id, makeLantern(l));
  camYaw = 0;
  camera.position.set(game.player.pos[0], game.player.pos[1] + 5, game.player.pos[2] - 8);
  acc = 0;
  lastCount = -1;
  windWarned = false;
  lowWarned = new Set();
  tenWarned = false;
  shadeAlert = null;
}
function newRun() { wonScores = {}; runSeed = (Date.now() & 0x7fffff); showIntro(1); }

function show(html) {
  $('card').innerHTML = html;
  $('overlay').style.display = 'flex';
  const b = $('card').querySelector('button');
  if (b) b.focus();
}
const hide = () => { $('overlay').style.display = 'none'; };
function bind(id, fn) { const el = $(id); if (el) el.onclick = () => { sfx.unlock(); fn(); }; }

function showMenu() {
  mode = 'menu';
  sfx.stopMusic();
  show(`<h1>Đảo Đèn Lồng</h1><p>Sương đen đã nuốt hết ánh sáng. Giúp <b>Mây</b> gom đom đóm, thắp lại Đèn Lồng Lớn qua ba đêm.</p>
  <button id="b-start">Bắt đầu (Đêm 1)</button><button id="b-board">Bảng xếp hạng</button><button id="b-settings">Cài đặt</button>
  <p class="small">${['forward', 'left', 'back', 'right'].map((a) => `<kbd>${keyName(settings.keys[a])}</kbd>`).join('')} đi · <kbd>${keyName(settings.keys.jump)}</kbd> nhảy · <kbd>${keyName(settings.keys.dash)}</kbd> lướt · <kbd>${keyName(settings.keys.interact)}</kbd> nạp đèn · <kbd>${keyName(settings.keys.pulse)}</kbd> tỏa sáng · kéo chuột / <kbd>Q</kbd> <kbd>C</kbd> xoay camera · <kbd>${keyName(settings.keys.pause)}</kbd> tạm dừng</p>`);
  bind('b-start', newRun);
  bind('b-board', () => showBoard());
  bind('b-settings', () => showSettings('menu'));
}
function showIntro(n) {
  loadNight(n);
  mode = 'intro';
  show(`<h2>Đêm ${n}</h2><h1>${NIGHTS[n].name}</h1><p class="quote">${INTRO[n]}</p>
  <p>${game.lanterns.length} đèn · giữ ít nhất <b>${game.winNeed()}</b> đèn sáng tới bình minh (${Math.round(game.timeLeft0 / 60 * 10) / 10} phút). Đèn cạn dầu sẽ tắt: nhấn <kbd>E</kbd> ở đèn đang sáng để châm dầu.</p><button id="b-go">Vào đêm (Enter)</button>`);
  bind('b-go', startPlay);
}
function startPlay() { mode = 'playing'; hide(); sfx.startMusic(); }
function showResult() {
  mode = 'result';
  sfx.stopMusic();
  const won = game.state === 'won';
  if (won) wonScores[night] = game.score;
  const why = { dawn_survived: `Bình minh lên, ${game.lanterns.filter((l) => l.lit).length}/${game.lanterns.length} đèn vẫn sáng!`, dawn: `Bình minh lên nhưng chưa đủ ${game.winNeed()} đèn sáng.`, no_flames: 'Ngọn lửa của Mây đã tắt.' }[game.result];
  if (won && night === 3) {
    show(`<h1>Bình Minh</h1><p>Ba hòn đảo đã sáng rực. Mặt trời lên trên biển mây.</p>
    <p>Tổng điểm: <b style="color:#F2C14E;font-size:24px">${totalScore()}</b></p>
    <p>Đêm 1: ${wonScores[1] ?? 0} · Đêm 2: ${wonScores[2] ?? 0} · Đêm 3: ${wonScores[3]}</p>${nameForm()}<button id="b-menu">Về menu</button>`);
    bindNameForm();
    bind('b-menu', showMenu);
    return;
  }
  show(`<h2>Đêm ${night}: ${NIGHTS[night].name}</h2><h1>${won ? 'Thắp sáng!' : 'Thua rồi…'}</h1><p>${why}</p>
  <p>Điểm đêm này: <b>${game.score}</b>${won ? '' : ' (chỉ đêm thắng mới được cộng)'} · Tổng: <b>${totalScore()}</b></p>
  ${won ? '<button id="b-next">Đêm kế tiếp (Enter)</button>' : nameForm() + '<button id="b-retry">Chơi lại đêm này (R)</button>'}<button id="b-menu">Về menu</button>`);
  if (!won) bindNameForm();
  bind('b-next', () => showIntro(night + 1));
  bind('b-retry', () => showIntro(night));
  bind('b-menu', showMenu);
}
function showPause() {
  mode = 'paused';
  show(`<h1>Tạm dừng</h1><button id="b-resume">Tiếp tục</button><button id="b-restart">Chơi lại Đêm</button>
  <button id="b-settings">Cài đặt</button><button id="b-menu">Về menu</button>`);
  bind('b-resume', resume);
  bind('b-restart', () => showIntro(night));
  bind('b-settings', () => showSettings('paused'));
  bind('b-menu', showMenu);
}
function resume() { mode = 'playing'; hide(); keys.clear(); last = performance.now(); }
// ---------- leaderboard (Ticket-04 §3): stored on disk by play.js (/api/leaderboard); localStorage fallback ----------
async function loadBoard() {
  try { const r = await fetch('/api/leaderboard'); if (r.ok) return (await r.json()).entries; } catch {}
  try { return exportLeaderboard(JSON.parse(localStorage.getItem('ddl-leaderboard') || '[]')).entries; } catch { return []; }
}
async function saveEntry(entry) {
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
    if (r.ok) return (await r.json()).entries;
  } catch {}
  let list = [];
  try { list = JSON.parse(localStorage.getItem('ddl-leaderboard') || '[]'); } catch {}
  list = addEntry(list, entry);
  try { localStorage.setItem('ddl-leaderboard', JSON.stringify(list)); } catch {}
  return list;
}
function nameForm() {
  return `<p>Lưu điểm vào bảng xếp hạng: <b>${totalScore()}</b> điểm, ${Object.keys(wonScores).length} đêm thắng</p>
  <input id="i-name" type="text" maxlength="12" placeholder="Tên (3–12 ký tự)" autocomplete="off"><button id="b-save">Lưu điểm</button><p id="name-err" class="err"></p>`;
}
function bindNameForm() {
  const inp = $('i-name');
  if (!inp) return;
  setTimeout(() => inp.focus(), 50);
  const submit = async () => {
    const name = inp.value.trim();
    if (!validName(name)) { $('name-err').textContent = '⚠ Tên cần 3–12 ký tự: chữ (có thể có dấu), số hoặc _'; return; }
    const entry = makeEntry({ name, score: totalScore(), nights_won: Object.keys(wonScores).length, seed: runSeed });
    showBoard(await saveEntry(entry), entry);
  };
  inp.addEventListener('submit-name', submit);
  bind('b-save', submit);
}
async function showBoard(entries, mine) {
  mode = 'board';
  const list = entries || (await loadBoard());
  const rows = list.map((e, i) => `<tr${mine && e.achieved_at === mine.achieved_at && e.name === mine.name ? ' class="me"' : ''}><td>${i + 1}</td><td>${e.name.replace(/</g, '&lt;')}</td><td>${e.score}</td><td>${e.nights_won}</td><td>${e.achieved_at.slice(0, 16).replace('T', ' ')}</td></tr>`).join('');
  show(`<h1>Bảng xếp hạng</h1><table class="board"><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Lúc</th></tr>${rows || '<tr><td colspan="5">Chưa có ai.</td></tr>'}</table><button id="b-menu">Về menu</button>`);
  bind('b-menu', showMenu);
}
function showKeys() {
  mode = 'settings';
  const dups = duplicateKeys();
  show(`<h1>Đổi phím</h1><table class="board">${Object.entries(ACTIONS).map(([a, label]) => `<tr><td>${label}</td><td><button class="kb" id="k-${a}">${capturing === a ? 'Nhấn phím…' : keyName(settings.keys[a])}</button></td></tr>`).join('')}</table>
  <p class="err">${dups.map(([c, v]) => `⚠ Trùng phím ${keyName(c)}: ${v.join(', ')}`).join('<br>')}</p>
  <button id="b-default">Khôi phục mặc định</button><button id="b-back">Quay lại</button>`);
  for (const a of Object.keys(ACTIONS)) bind(`k-${a}`, () => { capturing = a; showKeys(); });
  bind('b-default', () => { settings.keys = { ...DEFAULT_KEYS }; saveSettings(); showKeys(); });
  bind('b-back', () => showSettings(menuReturn));
}
function showSettings(from) {
  menuReturn = from;
  mode = 'settings';
  show(`<h1>Cài đặt</h1>
  <label>Âm lượng: <span id="v-vol">${Math.round(settings.volume * 100)}</span>%</label><input id="s-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}">
  <label>Độ nhạy chuột: <span id="v-sens">${settings.sens.toFixed(2)}</span></label><input id="s-sens" type="range" min="0.2" max="3" step="0.05" value="${settings.sens}">
  <label><input id="s-cb" type="checkbox" ${settings.colorblind ? 'checked' : ''}> Bảng màu dễ phân biệt (mù màu)</label>
  <label><input id="s-rm" type="checkbox" ${settings.reduceMotion ? 'checked' : ''}> Giảm chuyển động (tắt rung camera, chớp màn hình)</label>
  <label><input id="s-big" type="checkbox" ${settings.bigText ? 'checked' : ''}> Chữ lớn (×1.25)</label>
  <button id="b-keys">Đổi phím…</button><button id="b-back">Quay lại</button>`);
  $('s-rm').onchange = (e) => { settings.reduceMotion = e.target.checked; saveSettings(); };
  $('s-big').onchange = (e) => { settings.bigText = e.target.checked; applyPalette(); saveSettings(); };
  bind('b-keys', showKeys);
  $('s-cb').onchange = (e) => { settings.colorblind = e.target.checked; applyPalette(); saveSettings(); };
  $('s-vol').oninput = (e) => { settings.volume = +e.target.value; $('v-vol').textContent = Math.round(settings.volume * 100); sfx.setVolume(settings.volume); saveSettings(); };
  $('s-sens').oninput = (e) => { settings.sens = +e.target.value; $('v-sens').textContent = settings.sens.toFixed(2); saveSettings(); };
  bind('b-back', () => (menuReturn === 'paused' ? showPause() : showMenu()));
}

function onKey(code) {
  if (mode === 'playing' && code === settings.keys.pause) return showPause();
  if (mode === 'paused' && code === settings.keys.pause) return resume();
  if (mode === 'intro' && (code === 'Enter' || code === 'Space')) return startPlay();
  if (mode === 'result' && code === 'Enter' && game.state === 'won' && night < 3) return showIntro(night + 1);
  if (mode === 'result' && code === 'KeyR' && game.state === 'lost') return showIntro(night);
  if (mode === 'menu' && code === 'Enter') newRun();
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.name) {
      case 'mote_picked': sfx.pick(e.data.carried); break;
      case 'deposit': case 'refuel': sfx.deposit(); break;
      case 'lantern_out': sfx.out(); sub(`Đèn ${e.data.lantern_id} đã tắt`); break;
      case 'fuel_drain': sfx.shade(); break;
      case 'lantern_lit': skyLanterns(game.lanterns.find((l) => l.id === e.data.lantern_id).pos); sfx.lit(); break;
      case 'pulse': pulseRing(game.player.pos); sfx.pulse(); break;
      case 'player_hit':
        e.data.by === 'fall' ? sfx.fall() : sfx.hit();
        if (!settings.reduceMotion) { shake = 0.35; flash(); }
        sub(e.data.by === 'fall' ? 'Mây rơi xuống biển mây! −1 Ngọn Lửa' : `Bị Bóng Mực chạm! −1 Ngọn Lửa, rơi ${e.data.dropped} đom đóm`);
        break;
      case 'dash': sfx.dash(); break;
      case 'charm_picked': sfx.charm(); break;
      case 'drifter_steal': sfx.steal(); sub(`Gió Lạc cướp ${e.data.amount} đom đóm!`); break;
      case 'shade_spawned': sfx.shade(); sub('⚠ Bóng Mực xuất hiện!'); shadeAlert = { id: e.data.id, until: performance.now() + 4000 }; break;
      case 'game_over': e.data.result === 'won' ? sfx.win() : sfx.lose(); break;
    }
  }
}

// ---------- subtitles / visual cues (Ticket-04 §4) ----------
const subs = [];
function sub(text, secs = 3) {
  const same = subs.find((x) => x.base === text);
  if (same) { same.n++; same.text = `${text} ×${same.n}`; same.until = performance.now() + secs * 1000; return; }
  subs.push({ base: text, text, n: 1, until: performance.now() + secs * 1000 });
  if (subs.length > 3) subs.shift();
}
function renderSubs() {
  const now = performance.now();
  while (subs.length && subs[0].until < now) subs.shift();
  $('subs').innerHTML = subs.map((x) => `<div>${x.text}</div>`).join('');
}
function flash() {
  const f = $('flash');
  f.style.transition = 'none';
  f.style.opacity = '0.45';
  requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = '0'; });
}
// arrow at the screen edge pointing to a world position; hidden when it is on screen
function edgeArrow(el, pos) {
  const v = new THREE.Vector3(pos[0], pos[1], pos[2]).project(camera);
  const behind = v.z > 1;
  if (!behind && Math.abs(v.x) <= 0.95 && Math.abs(v.y) <= 0.95) { el.style.display = 'none'; return; }
  let x = v.x, y = v.y;
  if (behind) { x = -x; y = -y; }
  const ang = Math.atan2(y, x), r = 0.85;
  const k = Math.min(r / Math.abs(Math.cos(ang) || 1e-6), r / Math.abs(Math.sin(ang) || 1e-6));
  el.style.display = 'block';
  el.style.left = `${((Math.cos(ang) * k + 1) / 2) * innerWidth - 14}px`;
  el.style.top = `${((1 - Math.sin(ang) * k) / 2) * innerHeight - 15}px`;
  el.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
}

// ---------- HUD ----------
{ const lbl = document.createElement('span'); lbl.className = 'mlabel'; $('motebar').appendChild(lbl); }
const hudEls = ['flames', 'status', 'timer', 'topright', 'motebar', 'cds', 'prompt', 'arrow', 'subs', 'shadearrow'].map($);
const setHudVisible = (v) => { for (const el of hudEls) el.style.visibility = v ? 'visible' : 'hidden'; };
const cdStyle = (frac) => `background: conic-gradient(rgba(14,20,48,.85) ${frac * 360}deg, rgba(242,193,78,.35) 0)`;
function updateHud() {
  const P = game.player;
  $('flames').innerHTML = Array.from({ length: T.flames }, (_, i) => `<div class="flame${i < P.flames ? '' : ' off'}"></div>`).join('');
  const t = Math.max(0, game.timeLeft());
  const tm = $('timer');
  tm.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  tm.classList.toggle('danger', t <= 30);
  if (t <= 30 && settings.colorblind) tm.textContent = '⚠ ' + tm.textContent;
  const lit = game.lanterns.filter((l) => l.lit).length;
  const need = game.winNeed();
  $('topright').innerHTML = `Đèn <b>${lit}/${game.lanterns.length}</b> <span class="small">(cần ${need} lúc bình minh)</span><br>Điểm <b>${game.score}</b>`;
  const cap = game.capacity();
  const mb = $('motebar');
  while (mb.childNodes.length < cap + 1) { const c = document.createElement('div'); c.className = 'cell'; mb.insertBefore(c, mb.lastChild); }
  while (mb.childNodes.length > cap + 1) mb.removeChild(mb.firstChild);
  mb.childNodes.forEach((c, i) => { if (c.classList.contains('cell')) c.classList.toggle('on', i < P.carried); });
  mb.lastChild.textContent = `${P.carried}/${cap}`;
  $('cd-dash').setAttribute('style', cdStyle(P.charm > 0 ? 0 : P.dashCd / game.ticks.dashCd));
  $('cd-dash').innerHTML = `Lướt<br>${keyName(settings.keys.dash)}`;
  $('cd-pulse').setAttribute('style', cdStyle(P.pulseCd / game.ticks.pulseCd) + (P.carried < T.pulse_cost ? ';border-color:#5B5F6E;opacity:.6' : ''));
  $('cd-pulse').innerHTML = `Tỏa<br>${keyName(settings.keys.pulse)}`;
  let st = `<div>Đêm ${night} · ${NIGHTS[night].name}</div>`;
  if (P.charm > 0) st += `<div class="charm">Bùa Gió: ${(P.charm / TICK_HZ).toFixed(1)} s</div>`;
  const warn = game.simTick % C.WIND_EVERY >= C.WIND_EVERY - C.WIND_WARN;
  if (game.windEnabled && game.wind.dirDeg != null && (game.wind.active || warn)) st += `<div class="wind">${game.wind.active ? 'Gió mạnh!' : 'Gió sắp nổi…'}</div>`;
  if (P.respawn > 0) st += '<div style="color:#FF5A5F">Rơi xuống biển mây…</div>';
  $('status').innerHTML = st;
  // prompt + arrow to the nearest unlit lantern
  let nearL = null, best = null, bd = Infinity;
  for (const l of game.lanterns) {
    const d = Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]);
    if (d <= T.interact_radius && (!l.lit || l.fu < game.FU_MAX) && (!nearL || d < Math.hypot(nearL.pos[0] - P.pos[0], nearL.pos[2] - P.pos[2]))) nearL = l;
    if (l.lit) continue;
    if (d < bd) { bd = d; best = l; }
  }
  const pr = $('prompt');
  if (nearL) {
    pr.style.display = 'block';
    pr.innerHTML = nearL.lit
      ? `<b>${keyName(settings.keys.interact)}</b> — Châm dầu (${(nearL.fu / TICK_HZ).toFixed(0)}/${T.fuel_max})`
      : `<b>${keyName(settings.keys.interact)}</b> — ${nearL.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${nearL.deposited}/${game.lightCost(nearL)})`;
  } else pr.style.display = 'none';
  if (best) edgeArrow($('arrow'), [best.pos[0], best.pos[1] + 3.6, best.pos[2]]); else $('arrow').style.display = 'none';
  const sh = shadeAlert && performance.now() < shadeAlert.until && game.shades.find((x) => x.id === shadeAlert.id);
  if (sh) edgeArrow($('shadearrow'), sh.pos); else $('shadearrow').style.display = 'none';
  // visual cues: lanterns below 30 fuel, last 10 seconds, wind warning
  for (const l of game.lanterns) {
    if (l.lit && l.fu < game.FU_LOW) { if (!lowWarned.has(l.id)) { lowWarned.add(l.id); sub(`⚠ Đèn ${l.id} sắp cạn dầu (dưới 30)`); } }
    else lowWarned.delete(l.id);
  }
  if (t <= 10 && t > 0 && !tenWarned) { tenWarned = true; sub('⚠ Còn 10 giây tới bình minh!', 4); }
  renderSubs();
  // countdown beeps for the last 10 s
  const sLeft = Math.ceil(t);
  if (mode === 'playing' && sLeft <= 10 && sLeft > 0 && sLeft !== lastCount) sfx.tick();
  lastCount = sLeft;
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawMs = now - last;
  const dt = Math.max(0, Math.min(0.1, rawMs / 1000));
  last = now;
  const time = now / 1000;
  if (mode === 'bench') {
    // standard bench scene: fixed 60 Hz sim with no input; camera orbit; 3 s warm-up then measure
    if (bench.t0 == null) { bench.t0 = now; window.__bench.firstFrameEpoch = performance.timeOrigin + now; }
    else if (now - bench.t0 > BENCH.WARMUP_S * 1000 && !window.__bench.done) {
      bench.dts.push(rawMs);
      if (bench.dts.reduce((a, b) => a + b, 0) >= bench.duration * 1000) { window.__bench.dts = bench.dts; window.__bench.done = true; document.title = 'BENCH DONE'; }
    }
    acc += dt;
    while (acc >= DT) { game.step(); acc -= DT; }
  }
  if (mode === 'playing') {
    acc += dt;
    while (acc >= DT && game.state === 'playing') {
      game.applyFrame(readFrame());
      const wasGrounded = game.player.grounded;
      handleEvents(game.step());
      const P = game.player;
      if (wasGrounded && !P.grounded && P.vel[1] > 0) P.launched ? sfx.charm() : sfx.jump(); // jump / launch pad
      acc -= DT;
    }
    if (game.state !== 'playing') showResult();
  }
  if (game) draw(dt, time);
  setHudVisible(!!game && (mode === 'playing' || mode === 'paused' || mode === 'bench'));
  updateEffects(dt);
  renderer.render(scene, camera);
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 1) {
    if (params.has('fps')) $('fps').textContent = `${(fpsFrames / fpsTime).toFixed(0)} FPS`;
    fpsFrames = 0;
    fpsTime = 0;
  }
}

function draw(dt, time) {
  const P = game.player;
  may.position.set(P.pos[0], P.pos[1], P.pos[2]);
  const want = Math.atan2(P.facing[0], P.facing[1]);
  may.rotation.y += ((want - may.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 12);
  may.userData.light.intensity = 1.2 + P.carried * 0.2 + Math.sin(time * 6) * 0.1;
  may.visible = P.respawn === 0 && !(P.invuln > 0 && Math.floor(time * 12) % 2 === 0);

  let lit = 0;
  for (const l of game.lanterns) {
    const v = views.lanterns.get(l.id);
    const fill = l.lit ? 1 : l.deposited / game.lightCost(l);
    const fuel = l.fu / TICK_HZ;
    const low = l.lit && l.fu < game.FU_LOW;
    const blinkOn = !low || Math.floor(time) % 2 === 0 ? 1 : 0.25; // 1 Hz slow blink when fuel < 30
    v.lampMat.color.set(PAL.off).lerp(new THREE.Color(PAL.lit), l.lit ? blinkOn : fill * 0.6);
    v.coreMat.opacity = l.lit ? blinkOn : fill * 0.5;
    v.light.intensity = l.lit ? (14 + 16 * fuel / 100) * blinkOn : 0;
    v.ring.material.opacity = game.hasZone(l) ? 0.35 : 0;
    v.lampGroup.scale.y = l.lit ? 1 : 0.8; // out = squashed 20% + torn paper
    v.lampGroup.position.y = l.lit ? 0 : 3.6 * 0.2;
    v.tear.visible = !l.lit;
    v.bar.visible = l.lit;
    if (l.lit) {
      v.fill.scale.x = Math.max(0.001, fuel / 100);
      v.fill.position.x = -0.75 * (1 - fuel / 100);
      v.fillMat.color.set(low ? (settings.colorblind ? 0xffffff : PAL.danger) : PAL.lit);
      v.fill.visible = blinkOn === 1;
      v.bar.lookAt(camera.position);
    }
    if (l.lit) lit++;
  }
  ambient.intensity = 0.15 + 0.55 * (lit / game.lanterns.length);
  scene.fog.density = 0.018 - 0.008 * (lit / game.lanterns.length);

  sync(views.motes, game.motes, makeMote);
  for (const m of game.motes) {
    const v = views.motes.get(m.id);
    const ph = parseInt(m.id.slice(1), 10);
    v.position.set(m.pos[0], m.pos[1] + 0.8 + Math.sin(time * 2 + ph) * 0.2, m.pos[2]);
    v.visible = m.kind !== 'dropped' || m.ttl > 120 || Math.floor(time * 8) % 2 === 0;
  }
  sync(views.shades, game.shades, makeShade);
  for (const s of game.shades) {
    const v = views.shades.get(s.id);
    v.position.set(s.pos[0], s.pos[1] + Math.sin(time * 3 + s.id.length) * 0.08, s.pos[2]);
    v.lookAt(P.pos[0], v.position.y, P.pos[2]);
    const stunned = s.state === 'stunned';
    v.userData.body.material.color.set(stunned ? PAL.shadeStun : PAL.shade);
    v.scale.setScalar(Math.max(0.05, s.state === 'spawning' ? 1 - s.ticks / C.SPAWNING_TICKS : stunned ? 0.8 : 1));
  }
  sync(views.drifters, game.drifters.filter((d) => d.state !== 'removed'), makeDrifter);
  for (const d of game.drifters) {
    const v = views.drifters.get(d.id);
    if (!v) continue;
    v.position.set(d.pos[0], d.pos[1], d.pos[2]);
    const away = d.state === 'flee';
    v.lookAt(away ? 2 * d.pos[0] - P.pos[0] : P.pos[0], d.pos[1], away ? 2 * d.pos[2] - P.pos[2] : P.pos[2]);
    v.children.forEach((c, i) => { c.position.y = Math.sin(time * 6 + i) * 0.25; c.rotation.z = Math.sin(time * 4 + i) * 0.4; });
  }
  sync(views.charms, game.charms, makeCharm);
  for (const c of game.charms) {
    const v = views.charms.get(c.id);
    v.visible = c.available;
    v.position.set(c.pos[0], c.pos[1] + 1 + Math.sin(time * 2) * 0.15, c.pos[2]);
    v.rotation.y = time * 1.5;
  }
  // wind: leaves blow 2 s before and during a gust
  if (game.windEnabled && game.wind.dirDeg != null) {
    const warn = game.simTick % C.WIND_EVERY >= C.WIND_EVERY - C.WIND_WARN;
    if ((warn || game.wind.active) && mode === 'playing' && Math.random() < (game.wind.active ? 0.6 : 0.3)) windLeaf(game.wind.dirDeg);
    if (warn && !windWarned) { windWarned = true; sfx.wind(); sub('⚠ Gió sắp thổi! Lá đang bay theo hướng gió', 3); }
    if (!warn && !game.wind.active) windWarned = false;
  }
  // third-person camera behind the player along cam yaw (forward = (sin θ, cos θ))
  const th = (camYaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  const camY = Math.max(P.pos[1], -4);
  if (mode === 'bench') {
    camera.position.set(...benchCamera((performance.now() - bench.t0) / 1000));
    camera.lookAt(0, 0, 0);
  } else {
    camera.position.lerp(new THREE.Vector3(P.pos[0] - fx * 8, camY + 5, P.pos[2] - fz * 8), Math.min(1, dt * 8));
    camera.lookAt(P.pos[0], camY + 1.4, P.pos[2]);
    if (shake > 0) { // camera shake on hit (off with "reduce motion")
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake = Math.max(0, shake - dt);
    }
  }
  if (mode === 'playing' || mode === 'paused' || mode === 'bench') updateHud();
}

// ---------- boot ----------
applyPalette();
// URL params (dev/proof only): ?night=N, ?autostart, ?lit=N (pre-light N lanterns), ?seed=, ?fps,
// ?benchscene&seed=42&duration=30 (standard benchmark scene, driven by tools/bench.js)
loadNight(1);
camera.position.set(0, 14, -26);
camera.lookAt(0, 0, 0);
if (benchMode) {
  if (world) scene.remove(world);
  clearViews();
  night = 1;
  game = makeBenchGame(T, bench.seed);
  world = buildWorld(1, NIGHTS[1], game.lanterns.map((l) => l.pos));
  scene.add(world);
  for (const l of game.lanterns) views.lanterns.set(l.id, makeLantern(l));
  window.__bench = { firstFrameEpoch: null, dts: null, done: false, three: THREE.REVISION, shades: game.shades.length, motes: game.motes.length };
  mode = 'bench';
} else if (params.has('night') || params.has('autostart')) {
  const n = Math.min(3, Math.max(1, parseInt(params.get('night') || '1', 10)));
  const litN = parseInt(params.get('lit') || '0', 10);
  const scenario = litN > 0 ? { lanterns: NIGHTS[n].lanterns.slice(0, litN).map((_, i) => ({ id: `L${i + 1}`, lit: true })) } : null;
  loadNight(n, scenario);
  if (params.has('autostart')) startPlay();
  else { mode = 'intro'; showIntro(n); }
} else showMenu();
requestAnimationFrame(frame);
