// Web client for Đảo Đèn Lồng. All rules live in src/sim/sim.js; this file reads input,
// steps the sim at a fixed 60 Hz, and draws. Render-only extras never touch the sim.
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { Game, TICK_HZ, C } from '../sim/sim.js';
import { NIGHTS } from '../sim/maps.js';
import { Sfx } from './sfx.js';
import { buildWorld, PAL } from './world.js';

const T = contract.tuning;
const DT = 1 / TICK_HZ;
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ---------- settings (persisted) ----------
const settings = { volume: 0.7, sens: 1 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch {}
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch {} };
const sfx = new Sfx(settings.volume);

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
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9b8ff });

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
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
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
  g.add(pole, lamp, core, cap, light, ring);
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);
  scene.add(g);
  return { g, lampMat, coreMat, light, ring };
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
addEventListener('keydown', (e) => {
  sfx.unlock();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
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
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA')) x += 1; // screen-right is -X when looking along +Z
  if (keys.has('KeyD')) x -= 1;
  if (keys.has('ArrowLeft') || keys.has('KeyQ')) camYaw += 120 * DT * settings.sens;
  if (keys.has('ArrowRight') || keys.has('KeyC')) camYaw -= 120 * DT * settings.sens;
  return {
    move: [x, z], cam_yaw_deg: camYaw, jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyF'),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}

// ---------- game flow: menu -> intro -> play -> result -> next night ----------
const INTRO = {
  1: 'Ông Đăng: "Mây ơi, sương đen đã nuốt hết đèn của Đảo Bến. Gom đom đóm, thắp lại năm ngọn đèn lớn trước khi trời sáng nhé."',
  2: 'Ông Đăng: "Đảo Cau có hai hòn nối bằng cây cầu tre. Bục nhảy sẽ đưa cháu sang nhanh. Coi chừng Gió Lạc, chúng thích cướp đom đóm lắm."',
  3: 'Ông Đăng: "Đảo Chuông cao ba tầng, gió mạnh thổi từng cơn. Nghe lá bay là biết gió sắp tới. Thắp bảy ngọn đèn là bình minh về."',
};
let game = null, mode = 'menu', night = 1, acc = 0, wonScores = {}, lastCount = 0, windWarned = false, menuReturn = 'menu';
let fpsFrames = 0, fpsTime = 0;
const bench = params.has('bench') ? { secs: parseFloat(params.get('bench')) || 10, t: 0, frames: 0, done: false } : null;
const totalScore = () => Object.values(wonScores).reduce((a, b) => a + b, 0);

function loadNight(n, scenario = null) {
  night = n;
  if (world) scene.remove(world);
  clearViews();
  const seed = params.has('seed') ? parseInt(params.get('seed'), 10) : (Date.now() & 0x7fffffff);
  game = new Game(T, { seed, night: n, scenario });
  world = buildWorld(n, NIGHTS[n], game.lanterns.map((l) => l.pos));
  scene.add(world);
  for (const l of game.lanterns) views.lanterns.set(l.id, makeLantern(l));
  camYaw = 0;
  camera.position.set(game.player.pos[0], game.player.pos[1] + 5, game.player.pos[2] - 8);
  acc = 0;
  lastCount = -1;
  windWarned = false;
}

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
  <button id="b-start">Bắt đầu (Đêm 1)</button><button id="b-settings">Cài đặt</button>
  <p style="font-size:14px;opacity:.85"><kbd>WASD</kbd> đi · <kbd>Space</kbd> nhảy · <kbd>Shift</kbd> lướt · <kbd>E</kbd> nạp đèn · <kbd>F</kbd> tỏa sáng · kéo chuột / <kbd>Q</kbd> <kbd>C</kbd> xoay camera · <kbd>Esc</kbd>/<kbd>P</kbd> tạm dừng</p>`);
  bind('b-start', () => { wonScores = {}; showIntro(1); });
  bind('b-settings', () => showSettings('menu'));
}
function showIntro(n) {
  loadNight(n);
  mode = 'intro';
  show(`<h2>Đêm ${n}</h2><h1>${NIGHTS[n].name}</h1><p class="quote">${INTRO[n]}</p>
  <p>${game.lanterns.length} đèn · ${Math.round(game.timeLeft0 / 60 * 10) / 10} phút trước bình minh</p><button id="b-go">Vào đêm (Enter)</button>`);
  bind('b-go', startPlay);
}
function startPlay() { mode = 'playing'; hide(); sfx.startMusic(); }
function showResult() {
  mode = 'result';
  sfx.stopMusic();
  const won = game.state === 'won';
  if (won) wonScores[night] = game.score;
  const why = { all_lit: 'Mọi đèn đã sáng trở lại!', dawn: 'Trời đã sáng mà đảo vẫn chưa thắp hết đèn.', no_flames: 'Ngọn lửa của Mây đã tắt.' }[game.result];
  if (won && night === 3) {
    show(`<h1>Bình Minh</h1><p>Ba hòn đảo đã sáng rực. Mặt trời lên trên biển mây.</p>
    <p>Tổng điểm: <b style="color:#F2C14E;font-size:24px">${totalScore()}</b></p>
    <p>Đêm 1: ${wonScores[1] ?? 0} · Đêm 2: ${wonScores[2] ?? 0} · Đêm 3: ${wonScores[3]}</p><button id="b-menu">Về menu</button>`);
    bind('b-menu', showMenu);
    return;
  }
  show(`<h2>Đêm ${night}: ${NIGHTS[night].name}</h2><h1>${won ? 'Thắp sáng!' : 'Thua rồi…'}</h1><p>${why}</p>
  <p>Điểm đêm này: <b>${game.score}</b>${won ? '' : ' (chỉ đêm thắng mới được cộng)'} · Tổng: <b>${totalScore()}</b></p>
  ${won ? '<button id="b-next">Đêm kế tiếp (Enter)</button>' : '<button id="b-retry">Chơi lại đêm này (R)</button>'}<button id="b-menu">Về menu</button>`);
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
function showSettings(from) {
  menuReturn = from;
  mode = 'settings';
  show(`<h1>Cài đặt</h1>
  <label>Âm lượng: <span id="v-vol">${Math.round(settings.volume * 100)}</span>%</label><input id="s-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}">
  <label>Độ nhạy chuột: <span id="v-sens">${settings.sens.toFixed(2)}</span></label><input id="s-sens" type="range" min="0.2" max="3" step="0.05" value="${settings.sens}">
  <button id="b-back">Quay lại</button>`);
  $('s-vol').oninput = (e) => { settings.volume = +e.target.value; $('v-vol').textContent = Math.round(settings.volume * 100); sfx.setVolume(settings.volume); saveSettings(); };
  $('s-sens').oninput = (e) => { settings.sens = +e.target.value; $('v-sens').textContent = settings.sens.toFixed(2); saveSettings(); };
  bind('b-back', () => (menuReturn === 'paused' ? showPause() : showMenu()));
}

function onKey(code) {
  if (mode === 'playing' && (code === 'Escape' || code === 'KeyP')) return showPause();
  if (mode === 'paused' && (code === 'Escape' || code === 'KeyP')) return resume();
  if (mode === 'intro' && (code === 'Enter' || code === 'Space')) return startPlay();
  if (mode === 'result' && code === 'Enter' && game.state === 'won' && night < 3) return showIntro(night + 1);
  if (mode === 'result' && code === 'KeyR' && game.state === 'lost') return showIntro(night);
  if (mode === 'menu' && code === 'Enter') { wonScores = {}; showIntro(1); }
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.name) {
      case 'mote_picked': sfx.pick(e.data.carried); break;
      case 'deposit': sfx.deposit(); break;
      case 'lantern_lit': skyLanterns(game.lanterns.find((l) => l.id === e.data.lantern_id).pos); sfx.lit(); break;
      case 'pulse': pulseRing(game.player.pos); sfx.pulse(); break;
      case 'player_hit': e.data.by === 'fall' ? sfx.fall() : sfx.hit(); break;
      case 'dash': sfx.dash(); break;
      case 'charm_picked': sfx.charm(); break;
      case 'drifter_steal': sfx.steal(); break;
      case 'shade_spawned': sfx.shade(); break;
      case 'game_over': e.data.result === 'won' ? sfx.win() : sfx.lose(); break;
    }
  }
}

// ---------- HUD ----------
for (let i = 0; i < T.carry_capacity; i++) { const c = document.createElement('div'); c.className = 'cell'; $('motebar').appendChild(c); }
const hudEls = ['flames', 'status', 'timer', 'topright', 'motebar', 'cds', 'prompt', 'arrow'].map($);
const setHudVisible = (v) => { for (const el of hudEls) el.style.visibility = v ? 'visible' : 'hidden'; };
const cdStyle = (frac) => `background: conic-gradient(rgba(14,20,48,.85) ${frac * 360}deg, rgba(242,193,78,.35) 0)`;
function updateHud() {
  const P = game.player;
  $('flames').innerHTML = Array.from({ length: T.flames }, (_, i) => `<div class="flame${i < P.flames ? '' : ' off'}"></div>`).join('');
  const t = Math.max(0, game.timeLeft());
  const tm = $('timer');
  tm.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  tm.classList.toggle('danger', t <= 30);
  const lit = game.lanterns.filter((l) => l.lit).length;
  $('topright').innerHTML = `Đèn <b>${lit}/${game.lanterns.length}</b><br>Điểm <b>${game.score}</b>`;
  $('motebar').childNodes.forEach((c, i) => c.classList.toggle('on', i < P.carried));
  $('cd-dash').setAttribute('style', cdStyle(P.charm > 0 ? 0 : P.dashCd / game.ticks.dashCd));
  $('cd-dash').innerHTML = 'Lướt<br>Shift';
  $('cd-pulse').setAttribute('style', cdStyle(P.pulseCd / game.ticks.pulseCd) + (P.carried < T.pulse_cost ? ';border-color:#5B5F6E;opacity:.6' : ''));
  $('cd-pulse').innerHTML = `Tỏa<br>F (${T.pulse_cost})`;
  let st = `<div>Đêm ${night} · ${NIGHTS[night].name}</div>`;
  if (P.charm > 0) st += `<div class="charm">Bùa Gió: ${(P.charm / TICK_HZ).toFixed(1)} s</div>`;
  const warn = game.simTick % C.WIND_EVERY >= C.WIND_EVERY - C.WIND_WARN;
  if (game.windEnabled && game.wind.dirDeg != null && (game.wind.active || warn)) st += `<div class="wind">${game.wind.active ? 'Gió mạnh!' : 'Gió sắp nổi…'}</div>`;
  if (P.respawn > 0) st += '<div style="color:#FF5A5F">Rơi xuống biển mây…</div>';
  $('status').innerHTML = st;
  // prompt + arrow to the nearest unlit lantern
  let nearL = null, best = null, bd = Infinity;
  for (const l of game.lanterns) {
    if (l.lit) continue;
    const d = Math.hypot(l.pos[0] - P.pos[0], l.pos[2] - P.pos[2]);
    if (d <= T.interact_radius) nearL = l;
    if (d < bd) { bd = d; best = l; }
  }
  const pr = $('prompt');
  if (nearL) { pr.style.display = 'block'; pr.innerHTML = `<b>E</b> — Nạp ánh sáng (${nearL.deposited}/${T.lantern_cost})`; } else pr.style.display = 'none';
  const ar = $('arrow');
  if (best) {
    const v = new THREE.Vector3(best.pos[0], best.pos[1] + 3.6, best.pos[2]).project(camera);
    const behind = v.z > 1;
    if (!behind && Math.abs(v.x) <= 0.95 && Math.abs(v.y) <= 0.95) ar.style.display = 'none';
    else {
      let x = v.x, y = v.y;
      if (behind) { x = -x; y = -y; }
      const ang = Math.atan2(y, x), r = 0.85;
      const k = Math.min(r / Math.abs(Math.cos(ang) || 1e-6), r / Math.abs(Math.sin(ang) || 1e-6));
      ar.style.display = 'block';
      ar.style.left = `${((Math.cos(ang) * k + 1) / 2) * innerWidth - 14}px`;
      ar.style.top = `${((1 - Math.sin(ang) * k) / 2) * innerHeight - 15}px`;
      ar.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
    }
  } else ar.style.display = 'none';
  // countdown beeps for the last 10 s
  const sLeft = Math.ceil(t);
  if (mode === 'playing' && sLeft <= 10 && sLeft > 0 && sLeft !== lastCount) sfx.tick();
  lastCount = sLeft;
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
    if (game.state !== 'playing') showResult();
  }
  if (game) draw(dt, time);
  setHudVisible(!!game && (mode === 'playing' || mode === 'paused'));
  updateEffects(dt);
  renderer.render(scene, camera);
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 1) {
    if (params.has('fps')) $('fps').textContent = `${(fpsFrames / fpsTime).toFixed(0)} FPS`;
    fpsFrames = 0;
    fpsTime = 0;
  }
  if (bench && !bench.done && mode === 'playing') {
    bench.t += dt;
    bench.frames++;
    camYaw += 25 * dt;
    if (bench.t >= bench.secs) {
      bench.done = true;
      const avg = bench.frames / bench.t;
      document.title = `BENCH ${avg.toFixed(1)} FPS`;
      $('fps').style.cssText = 'font-size:34px;opacity:1;bottom:42%;left:50%;transform:translateX(-50%);background:#000c;padding:10px 20px';
      $('fps').textContent = `BENCH night ${night}: avg ${avg.toFixed(1)} FPS over ${bench.t.toFixed(1)} s @ ${innerWidth}x${innerHeight}`;
    }
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
    const fill = l.lit ? 1 : l.deposited / T.lantern_cost;
    v.lampMat.color.set(PAL.off).lerp(new THREE.Color(PAL.lit), l.lit ? 1 : fill * 0.6);
    v.coreMat.opacity = l.lit ? 1 : fill * 0.5;
    v.light.intensity = l.lit ? 28 + Math.sin(time * 3 + l.pos[0]) * 2 : 0;
    v.ring.material.opacity = l.lit ? 0.35 : 0;
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
    if (warn && !windWarned) { windWarned = true; sfx.wind(); }
    if (!warn && !game.wind.active) windWarned = false;
  }
  // third-person camera behind the player along cam yaw (forward = (sin θ, cos θ))
  const th = (camYaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  const camY = Math.max(P.pos[1], -4);
  camera.position.lerp(new THREE.Vector3(P.pos[0] - fx * 8, camY + 5, P.pos[2] - fz * 8), Math.min(1, dt * 8));
  camera.lookAt(P.pos[0], camY + 1.4, P.pos[2]);
  if (mode === 'playing' || mode === 'paused') updateHud();
}

// ---------- boot ----------
// URL params (dev/proof only): ?night=N, ?autostart, ?lit=N (pre-light N lanterns), ?seed=, ?fps, ?bench=SECONDS
loadNight(1);
camera.position.set(0, 14, -26);
camera.lookAt(0, 0, 0);
if (params.has('night') || params.has('autostart') || bench) {
  const n = Math.min(3, Math.max(1, parseInt(params.get('night') || '1', 10)));
  const litN = parseInt(params.get('lit') || '0', 10);
  const scenario = litN > 0 ? { lanterns: NIGHTS[n].lanterns.slice(0, litN).map((_, i) => ({ id: `L${i + 1}`, lit: true })) } : null;
  loadNight(n, scenario);
  if (params.has('autostart') || bench) startPlay();
  else { mode = 'intro'; showIntro(n); }
} else showMenu();
requestAnimationFrame(frame);
