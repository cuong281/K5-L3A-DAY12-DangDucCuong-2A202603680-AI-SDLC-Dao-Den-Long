#!/usr/bin/env node
// Game launcher (contract run_cmd): builds the web client if needed, serves it on http://localhost:5173,
// opens the browser and stores the local leaderboard on disk.
//   node play.js                                   play
//   node play.js --export-leaderboard out.json     write {"entries": [...]} (sorted, top 10) and exit
//   node play.js --no-open --port 8080             options
// Leaderboard file: $DDL_DATA_DIR/leaderboard.json (default ~/.dao-den-long/leaderboard.json)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { addEntry, exportLeaderboard, makeEntry } from './src/leaderboard.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const dataDir = process.env.DDL_DATA_DIR || path.join(os.homedir(), '.dao-den-long');
const lbFile = path.join(dataDir, 'leaderboard.json');

function readBoard() {
  try {
    const j = JSON.parse(fs.readFileSync(lbFile, 'utf8'));
    return Array.isArray(j.entries) ? j.entries : [];
  } catch { return []; }
}
function writeBoard(entries) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = lbFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2));
  fs.renameSync(tmp, lbFile); // atomic replace
}

if (argv.includes('--export-leaderboard')) {
  const out = opt('--export-leaderboard');
  if (!out) { process.stderr.write('usage: node play.js --export-leaderboard <out.json>\n'); process.exit(2); }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(exportLeaderboard(readBoard()), null, 2) + '\n');
  console.log(`exported ${readBoard().length} entries from ${lbFile} to ${out}`);
  process.exit(0);
}

const dist = path.join(root, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html')) || argv.includes('--rebuild')) {
  console.log('Building web client (vite build)...');
  const { build } = await import('vite');
  await build({ root, logLevel: 'warn' });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/leaderboard') {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET') return res.end(JSON.stringify(exportLeaderboard(readBoard())));
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 1e4) req.destroy(); });
      req.on('end', () => {
        try {
          const entry = makeEntry(JSON.parse(body));
          const entries = addEntry(readBoard(), entry);
          writeBoard(entries);
          res.end(JSON.stringify({ entries }));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
    res.statusCode = 405;
    return res.end('{}');
  }
  let file = path.normalize(path.join(dist, decodeURIComponent(url.pathname)));
  if (!file.startsWith(dist)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
const port = parseInt(opt('--port') || process.env.PORT || '5173', 10);
server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/`;
  console.log(`Đảo Đèn Lồng is running at ${url}  (Ctrl+C to stop)\nLeaderboard file: ${lbFile}`);
  if (!argv.includes('--no-open')) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch {}
  }
});
