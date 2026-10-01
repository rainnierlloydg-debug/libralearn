# Loop Run Log — YOUR_PROJECT

Append one entry per run. Prune entries older than 30 days.

## Format

```json
{
  "run_id": "2026-06-09T08:15:00Z",
  "pattern": "daily-triage",
  "duration_s": 45,
  "items_found": 4,
  "actions_taken": 1,
  "escalations": 0,
  "tokens_estimate": 52000,
  "outcome": "report-only | fix-proposed | escalated | no-op"
}
```

## Recent Runs

<!-- Loop appends below this line -->
| 2026-10-01 | daily-triage | report-only | 7 phases scored (0 done, 2 partial, 5 missing) | 3 escalations to human | 0 actions |
{"run_id": "2026-10-02T00:45:00+08:00", "pattern": "phase-build:A", "items_found": 4, "actions_taken": 2, "escalations": 1, "tokens_estimate": 180000, "outcome": "fix-proposed", "verifier": "REJECT then ACCEPT"}
{"run_id": "2026-10-02T01:20:00+08:00", "pattern": "phase-build:B", "items_found": 4, "actions_taken": 1, "escalations": 0, "tokens_estimate": 120000, "outcome": "fix-proposed", "verifier": "ACCEPT"}
