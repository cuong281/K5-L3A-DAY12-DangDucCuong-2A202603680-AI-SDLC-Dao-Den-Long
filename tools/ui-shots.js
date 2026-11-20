#!/usr/bin/env node
// Screenshots of Phase 4 UI for the proof folder (leaderboard, key rebinding with duplicate warning,
// settings, subtitles/visual cues, big text). Needs `node play.js --no-open --port 5199` running.
// Usage: node tools/ui-shots.js [baseUrl=http://localhost:5199] [outDir=docs/proof/phase-4]
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] || 'http://localhost:5199';
const outDir = process.argv[3] || 'docs/proof/phase-4';
const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', defaultViewport: { width: 1280, height: 720 }, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage();
const shot = (n) => page.screenshot({ path: `${outDir}/${n}.png` });
const click = async (sel) => { await page.waitForSelector(sel); await page.click(sel); await new Promise((r) => setTimeout(r, 300)); };

await page.goto(base + '/');
await click('#b-board');
await shot('web-leaderboard');
await click('#b-menu');
await click('#b-settings');
await shot('web-settings');
await click('#b-keys');
await click('#k-jump');
await page.keyboard.press('KeyE'); // bind jump to E -> duplicates interact
await new Promise((r) => setTimeout(r, 300));
await shot('web-keys-duplicate');
const dupText = await page.$eval('#card .err', (e) => e.textContent);
await click('#b-default');
const afterReset = await page.$eval('#card .err', (e) => e.textContent);
// big text + subtitles during play (shade spawns at tick 300 = 5 s)
await page.evaluate(() => localStorage.setItem('ddl-settings', JSON.stringify({ bigText: true })));
await page.goto(base + '/?autostart&seed=5&night=1');
await new Promise((r) => setTimeout(r, 6500));
await shot('web-subtitles-bigtext');
const subs = await page.$eval('#subs', (e) => e.textContent);
const fontPx = await page.$eval('#topright', (e) => getComputedStyle(e).fontSize);
await page.evaluate(() => localStorage.removeItem('ddl-settings'));
await page.goto(base + '/?autostart&seed=5&night=1');
await new Promise((r) => setTimeout(r, 1500));
const minFont = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.hud, .hud *')].filter((e) => e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))));
await browser.close();
const report = { duplicate_warning: dupText, after_restore_defaults: afterReset, subtitles_at_6_5s: subs, hud_font_big_text: fontPx, min_hud_font_px_default: minFont };
fs.writeFileSync(`${outDir}/ui-checks.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
