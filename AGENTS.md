# AGENTS.md — Đảo Đèn Lồng

3D game (Three.js web) + deterministic headless mode per Test Contract (lab board). Node ≥ 18, plain ES modules, no TypeScript.

## Commands
- Install: `npm install` · Play: `npm run dev` (http://localhost:5173)
- Tests: `npm test` (node:test, tests/*.test.js) — must be green before you finish
- Proof: `npm run proof` → runs scenarios/*/ twice via headless, writes docs/proof/phase-N/
- Headless: `node headless.js --seed 1 --night 1 --ticks 600 --out out/x.jsonl [--scenario f] [--inputs f] [--snapshot-every n]`

## Layout
- `src/sim/` pure game logic (sim.js), PRNG (rng.js), file validation (validate.js). **No DOM, no Math.random, no Date.**
- `src/web/` renderer only: reads sim state, never changes rules. Visual/audio extras live here.
- `headless.js` CLI · `game.contract.json` tuning (single source of numbers; sim reads it, never hardcode tuning)
- `scenarios/<case>/` scenario.json + inputs.json + case.json (seed, ticks, hand-computed expectations)
- `docs/notes/` assumptions, AI log, retro · `docs/proof/` evidence · `docs/lab/` lab brief (read-only)

## Rules
- Contract is law: tick model (snapshot 0 before input; step k reads input k, events tick k+1), XZ distances with `<=`, round 3 decimals, exit 2 on bad inputs/scenario, `end` line last.
- Any new behavior must be in sim + a test. Creative extras must not change headless output (render-only or disabled in headless).
- Changing a tuning number = update game.contract.json only, then `npm test && npm run proof`.
- Never hand-edit files under docs/proof/ — regenerate. Never weaken a test to make it pass; write the reason in docs/notes if a test is changed.
- Record assumptions for ambiguous requirements in docs/notes/phase-N.md.
- Small commits, one concern each.
