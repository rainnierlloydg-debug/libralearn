# Loop Safety — LibraLearn

Binding rules for any loop or agent working in this repo. `loop-constraints.md` holds the
short form; this file explains the gates.

## Autonomy level

- Week one: **L1 report-only**. The daily-triage loop reads the repo and writes `STATE.md`.
  It does not fix, commit, push, or merge.
- Build work (phases A–G) runs only when the human starts it, one phase at a time.

## Auto-merge policy

- No auto-merge, ever. Nothing is pushed to `main` without the human saying so.
- Changes go through a human-reviewed PR.

## Path denylist (never edit without explicit human approval)

- `.env`, `.env.*` (except adding keys to `.env.example`)
- `vendor/`, `frontend/node_modules/`, `public/build/`
- `storage/` runtime data
- Deployment and infrastructure config once it exists (`railway.json`, `render.yaml`,
  `frontend/vercel.json`, `.github/workflows/`)

## Data safety

- Ask the human before any destructive migration on existing data (dropping columns or
  tables, rewriting rows, changing enum values in use).
- Never commit secrets. Every new env variable is added to `.env.example` with an empty value.

## Tool scope (least privilege)

- L1 triage: read-only tools (read files, git log/diff, run tests). No writes outside
  `STATE.md` and `loop-run-log.md`.
- MCP connectors are not required for this pattern. If added later, scope them to read + comment.

## Stall detection and escalation

- Max 3 fix attempts per failing item. After the third failure, stop and escalate to the
  human in `STATE.md` under High Priority.
- A phase is done only when PHPUnit passes and `npm run build` in `/frontend` succeeds.
