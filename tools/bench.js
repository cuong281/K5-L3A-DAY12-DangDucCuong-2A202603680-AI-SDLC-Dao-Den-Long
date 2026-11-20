#!/usr/bin/env node
// FPS benchmark of the real web build at 1280x720 (Ticket-02: >= 30 FPS average).
// Needs a built + served game: `npx vite build && npx vite preview --port 4173`.
// Usage: node tools/bench.js [seconds=10] [url=http://localhost:4173]  (CHROME_PATH env to override browser)
// Drives an installed Chrome via puppeteer-core with the page's ?bench=N mode (camera orbits, real time).
import fs from 'node:fs';
import os from 'node:os';
import puppeteer from 'puppeteer-core';

const secs = parseFloat(process.argv[2] || '10');
const base = process.argv[3] || 'http://localhost:4173';
const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) { console.error('No Chrome found; set CHROME_PATH'); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath, headless: false, defaultViewport: { width: 1280, height: 720 },
  args: ['--window-size=1280,800', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
const results = [];
for (const night of [1, 2, 3]) {
  const page = await browser.newPage();
  await page.goto(`${base}/?bench=${secs}&seed=5&night=${night}&lit=3`);
  await page.waitForFunction(() => document.title.startsWith('BENCH'), { timeout: (secs + 30) * 1000 });
  const title = await page.title();
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  const fps = parseFloat(title.split(' ')[1]);
  await page.screenshot({ path: `docs/proof/phase-2/fps-night${night}.png` });
  results.push({ night, fps, gpu });
  console.log(`night ${night}: ${fps} FPS avg over ${secs}s @1280x720 (${gpu})`);
  await page.close();
}
await browser.close();
const out = { date: new Date().toISOString(), cpu: os.cpus()[0].model, platform: `${os.platform()} ${os.release()}`, seconds: secs, results, pass: results.every((r) => r.fps >= 30) };
fs.writeFileSync('docs/proof/phase-2/fps.json', JSON.stringify(out, null, 2));
console.log(out.pass ? 'PASS (>= 30 FPS on every night)' : 'FAIL (< 30 FPS)');
process.exit(out.pass ? 0 : 1);
