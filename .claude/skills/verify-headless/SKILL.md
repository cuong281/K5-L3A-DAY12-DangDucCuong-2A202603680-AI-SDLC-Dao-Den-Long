---
name: verify-headless
description: Verify game behaviour through the headless Test Contract (v1.1) and save evidence. Use after changing anything in src/sim, headless.js or game.contract.json, when adding a scenario case, or when asked to produce proof / FPS numbers for a phase.
---

# Verify via headless + save proof

1. `npm test` — unit + CLI tests. Fix code, not tests (unless the ticket changed the rule; then note why in docs/notes/phase-N.md).
2. For a new rule/feature add a case in `tools/mkcases.py` (then `python tools/mkcases.py scenarios`):
   - scenario (§D; use the `q(...)` helper = no random motes/shades/drifters, no wind) and inputs (§C, optional)
   - case: `{seed, night, ticks, snapshot_every, why, expect}` where `expect` may hold
     `end` (subset of end line), `events` ([{tick,name,data}] that must appear), `no_events` ([names]),
     `event_names` (exact ordered list "tick:name" for tick > 0), `snapshots` ([{tick, match}] recursive subset, numbers ±0.001, arrays of {id} matched by id).
   - Compute expectations **by hand from the ticket numbers** and write the arithmetic in `why`. Never copy from output.
     Remember the tick order: counters (phase 2) → move player (3) → pickup (4) → interact (5) → safe zones (6) → pulse (7) → move shades/drifters (8) → contact (9) → spawns (10) → win/lose (11).
3. `npm run proof -- phase-N` — each case twice (determinism) → `docs/proof/phase-N/headless-summary.md` + `.jsonl`. Do not edit by hand.
4. Visual proof: `npx vite build && npx vite preview --port 4173`, then headless Chrome
   `chrome --headless=new --enable-unsafe-swiftshader --use-angle=swiftshader --window-size=1280,720 --virtual-time-budget=6000 --screenshot=docs/proof/phase-N/web-x.png "http://localhost:4173/?autostart&seed=5&night=2&lit=3"`
   (`?night=N`, `?autostart`, `?lit=N` pre-lights N lanterns, `?seed=`, `?fps` shows FPS).
5. FPS: `npm run bench` (real Chrome via puppeteer-core, 10 s per night, needs the preview server) → `docs/proof/phase-2/fps.json`.
6. Update the traceability table `docs/proof/phase-N/README.md` (requirement → how → evidence → result). Unmet = "chưa đạt" + reason.
