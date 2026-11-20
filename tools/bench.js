#!/usr/bin/env node
// Benchmark (Ticket-04 §1, contract bench_cmd): node tools/bench.js --seed 42 --duration 30 --out bench.json
// - builds the web client if needed and serves it locally
// - opens a 1280x720 Chrome window (not fullscreen) with vsync / frame-rate limit disabled
// - the page runs the standard bench scene (?benchscene): Night 1, 200 wander shades, 100 motes, L1-L3 lit,
//   camera orbit r=30 y=15 from (30,15,0) CCW 15 s/lap; 3 s warm-up, then `duration` seconds measured
// - load_ms = process start -> first frame of the bench scene; peak_mem_mb = max RSS of the Chrome process tree
// Needs Google Chrome/Chromium installed (CHROME_PATH to override).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { frameStats } from '../src/sim/benchScene.js';

const processStartEpoch = Date.now() - process.uptime() * 1000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const seed = parseInt(args.seed ?? '42', 10);
const duration = parseFloat(args.duration ?? '30');
const out = args.out ?? 'bench.json';
const contract = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));

// 1. build + serve
const dist = path.join(root, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  const { build } = await import('vite');
  await build({ root, logLevel: 'warn' });
}
const server = http.createServer((req, res) => {
  let f = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (f.endsWith(path.sep) || f === dist) f = path.join(dist, 'index.html');
  fs.readFile(f, (e, d) => {
    if (e) { res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// 2. chrome
const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean).find((p) => fs.existsSync(p));
if (!exe) { process.stderr.write('Chrome not found: set CHROME_PATH\n'); process.exit(1); }
const browser = await puppeteer.launch({
  executablePath: exe, headless: false, defaultViewport: { width: 1280, height: 720 },
  args: ['--window-size=1280,720', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--no-first-run'],
});

// 3. memory sampling of the browser process tree (RSS / working set)
const rootPid = browser.process().pid;
function treeRssMb() {
  return new Promise((resolve) => {
    const done = (rows) => {
      const kids = new Map();
      for (const [pid, ppid] of rows) { if (!kids.has(ppid)) kids.set(ppid, []); kids.get(ppid).push(pid); }
      const rss = new Map(rows.map(([pid, , kb]) => [pid, kb]));
      let total = 0;
      const stack = [rootPid];
      const seen = new Set();
      while (stack.length) { const p = stack.pop(); if (seen.has(p)) continue; seen.add(p); total += rss.get(p) || 0; stack.push(...(kids.get(p) || [])); }
      resolve(total / 1024);
    };
    if (process.platform === 'win32') {
      execFile('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $([math]::Round($_.WorkingSetSize/1024))" }'], { maxBuffer: 1e7 }, (e, so) =>
        done(e ? [] : so.trim().split(/\r?\n/).map((l) => l.trim().split(/\s+/).map(Number))));
    } else {
      execFile('ps', ['-A', '-o', 'pid=,ppid=,rss='], { maxBuffer: 1e7 }, (e, so) => done(e ? [] : so.trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number))));
    }
  });
}

const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/?benchscene&seed=${seed}&duration=${duration}`);
await page.waitForFunction(() => window.__bench && window.__bench.firstFrameEpoch, { timeout: 60000 });
let peakMem = 0, sampling = true;
const sampler = (async () => { while (sampling) { peakMem = Math.max(peakMem, await treeRssMb()); await new Promise((r) => setTimeout(r, 1000)); } })();
await page.waitForFunction(() => window.__bench.done, { timeout: (duration + 60) * 1000, polling: 500 });
sampling = false;
await sampler;
const b = await page.evaluate(() => window.__bench);
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
const chromeVer = await browser.version();
if (fs.existsSync(path.join(root, 'docs/proof/phase-4'))) await page.screenshot({ path: path.join(root, 'docs/proof/phase-4/bench-frame.png') }).catch(() => {});
await browser.close();
server.close();

const st = frameStats(b.dts);
const r2 = (x) => Math.round(x * 100) / 100;
const report = {
  contract_version: contract.contract_version,
  avg_fps: r2(st.avg_fps),
  p1_low_fps: r2(st.p1_low_fps),
  frame_ms_p95: r2(st.frame_ms_p95),
  frames: st.frames,
  load_ms: Math.round(b.firstFrameEpoch - processStartEpoch),
  peak_mem_mb: peakMem ? Math.round(peakMem) : null,
  vsync_off: true,
  renderer: `three.js r${b.three} WebGL (${gpu}) in ${chromeVer}, flags --disable-gpu-vsync --disable-frame-rate-limit`,
  os: `${os.type()} ${os.release()} ${os.arch()}, ${os.cpus()[0].model}, ${Math.round(os.totalmem() / 1073741824)} GB RAM`,
  seed,
  duration_s: duration,
  measured_s: r2(b.dts.reduce((a, x) => a + x, 0) / 1000),
  peak_mem_note: 'sum of RSS (working set on Windows) of the Chrome process tree, sampled every 1 s',
  shades: b.shades,
  motes: b.motes,
};
report.pass = report.avg_fps >= 60 && report.p1_low_fps >= 30 && report.load_ms <= 10000;
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(0);
