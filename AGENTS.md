# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js web) + deterministic headless mode per Test Contract **v1.2** (Ticket-03 on top of Ticket-02). Node ≥ 18, plain ES modules.
Design decisions: docs/adr/ · Breaking changes: CHANGELOG.md (update it whenever a ticket replaces a rule).

## Commands
- Install: `npm install` · Play: `npm run dev` (http://localhost:5173)
- Tests: `npm test` (node:test, tests/*.test.js) — must be green before you finish (Stop hook enforces)
- Proof: `npm run proof -- phase-N` → runs scenarios/*/ twice via headless, writes docs/proof/phase-N/
- New/changed cases: edit `tools/mkcases.py`, then `python tools/mkcases.py scenarios`
- FPS: `npx vite build && npx vite preview --port 4173` then `npm run bench` (opens Chrome, writes docs/proof/phase-2/fps.json)
- Headless: `node headless.js --seed 1 --night 1|2|3 --ticks 600 --out out/x.jsonl [--scenario f] [--inputs f] [--snapshot-every n]`

## Layout
- `src/sim/` pure logic: sim.js (one `step()` = Ticket-02 tick order phases 1–12, comments mark each), maps.js (standard maps), rng.js, validate.js. **No DOM, no Math.random, no Date.**
- `src/web/` renderer/UI only (main.js flow+HUD, world.js terrain+palette, sfx.js). Never changes rules.
- `game.contract.json` = standard numbers (Ticket-02 Part 1). Other standard constants live in `C` in sim.js.
- `scenarios/<case>/` scenario.json + inputs.json + case.json (seed, night, ticks, hand-computed `expect`)
- `docs/notes/phase-N.md` spec/assumptions/AI log · `docs/proof/phase-N/` evidence · `docs/lab/` brief (read-only)

## Rules
- Ticket numbers/order are law. Tick: snapshot 0 before input; step k reads input k, events tick k+1; pause: tick++ but sim frozen.
- Distances XZ with `<=`; pulse uses 3D distance from foot+0.8. Round 3 decimals. Exit 2 on bad inputs/scenario.
- Lantern fuel is integer 1/60 units (`l.fu`); only round (1 decimal) on output. Zone = lit && fuel >= 30. Win only at dawn.
- Speeds: helpers that take m/s divide by 60 themselves — never pass an already per-tick value (Phase 3 bug).
- When a ticket replaces a rule: update the test with a `[P<n> updated/replaced]` reason, never skip it; log it in CHANGELOG.md.
- Any rule change = sim + unit test + a scenario case. Creative extras must be render-only (headless output unchanged).
- Expected values in tests/cases must be **computed by hand from the ticket**, never copied from program output. Watch off-by-one: counters decrement in phase 2, entities move (phase 8) before contact (phase 9).
- Never hand-edit docs/proof/. Never weaken a test; if a requirement changed, update it and write why (`why` field / docs/notes).
- **Never commit, tag or push** — the owner commits manually (Phase 4 decision). Leave changes in the working tree.
- Phase 4 commands: `node tools/bench.js --seed 42 --duration 30 --out bench.json` (Chrome window), `node --expose-gc --lite-mode tools/soak.js --seed 7 --nights 10 --out soak.json`, `node play.js [--export-leaderboard f]`. Bench mode (`Game({bench:true})`) must never change headless output.
