# Loop Constraints

> Add rules below with `/constraints <rule>` in your agent.
> The `loop-constraints` skill reads this file at the start of every run.
> Constraints here are **binding** — the agent MUST follow them.

## Push & Merge
- Don't push before telling me
- Never auto-merge to main without human approval
- Always create a draft PR first; let me review before marking ready

## Paths
- Never edit .env, .env.*, auth/, payments/, secrets/, credentials/
- Never edit infrastructure configs without human approval

## Code
- Always run tests before proposing a fix
- Never disable tests to make CI green
- Never refactor unrelated code — one fix per run
- Max 3 fix attempts per item; escalate after
- Enforce the attempt limit mechanically: log each try to `loop-ledger.json` and run `loop-context --check` before retrying (see the `loop-guard` skill)

## Communication
- Always tell me what you're about to do before doing it
- Never close an issue or PR without my approval

## Budget
- If token spend hits 80% of daily cap, switch to report-only
- If loop-pause-all is active, exit immediately

---
<!-- Add your own rules below. Use plain English. The loop reads this verbatim. -->

## LibraLearn project rules
- Functionality first: plain, unstyled React pages only. No new CSS, animations, or layout work. Reuse existing components.
- Do not touch existing working features unless the current phase requires it.
- A phase is done only when PHPUnit feature tests pass and `npm run build` in /frontend succeeds.
- Never commit secrets. Add every new env variable to .env.example.
- Ask the human before any destructive migration on existing data.
- Keep Sanctum for auth. Do not add Supabase Auth.
- Do not rebuild AssistantController, AssistantKnowledge, LibraryDemandService, LibraryInsightsNarrator, LibraryInsightsController, DemoActivitySeeder — integrate only.
