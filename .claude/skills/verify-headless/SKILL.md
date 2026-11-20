---
name: verify-headless
description: Verify game behaviour through the headless Test Contract and save evidence. Use after changing anything in src/sim, headless.js or game.contract.json, or when asked to add a test scenario / produce proof for a phase.
---

# Verify via headless + save proof

1. `npm test` — unit + CLI tests. Fix code, not tests (unless the requirement changed; then note why in docs/notes/phase-N.md).
2. For a new requirement, add a case folder `scenarios/<name>/`:
   - `scenario.json` (Test Contract §D; use `random_motes/random_shades: false` for exact cases)
   - `inputs.json` (§C, optional)
   - `case.json`: `{ "seed", "ticks", "why", "expect": { "end": {...}, "events": [{tick,name,data}], "no_events": [...] } }`
   - Compute expected ticks/scores **by hand from game.contract.json tuning** and write the arithmetic in `why`. Never copy expectations from the program's own output.
3. `npm run proof -- phase-N` — runs each case twice (determinism) and writes `docs/proof/phase-N/headless-summary.md` + `.jsonl` outputs. Do not edit those files by hand.
4. Visual proof (optional): `npx vite build && npx vite preview --port 4173`, then headless Chrome
   `chrome --headless=new --enable-unsafe-swiftshader --use-angle=swiftshader --window-size=1280,720 --virtual-time-budget=8000 --screenshot=docs/proof/phase-N/web-x.png "http://localhost:4173/?autostart&seed=5&lit=3"`
   (`?autostart` skips the menu, `?lit=N` pre-lights N lanterns via scenario, `?seed=` fixes spawns).
5. Update the traceability table in `docs/proof/phase-N/README.md` (requirement → how verified → evidence → result). Unmet = "chưa đạt" + reason.
