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
{"run_id": "2026-10-02T01:55:00+08:00", "pattern": "phase-build:C", "items_found": 3, "actions_taken": 2, "escalations": 0, "tokens_estimate": 110000, "outcome": "fix-proposed", "verifier": "REJECT then ACCEPT"}
{"run_id": "2026-10-02T02:25:00+08:00", "pattern": "phase-build:D", "items_found": 3, "actions_taken": 1, "escalations": 0, "tokens_estimate": 90000, "outcome": "fix-proposed", "verifier": "ACCEPT"}
{"run_id": "2026-10-02T03:05:00+08:00", "pattern": "phase-build:E", "items_found": 6, "actions_taken": 2, "escalations": 1, "tokens_estimate": 130000, "outcome": "fix-proposed", "verifier": "REJECT then ACCEPT"}
{"run_id": "2026-10-02T03:45:00+08:00", "pattern": "phase-build:F", "items_found": 5, "actions_taken": 1, "escalations": 0, "tokens_estimate": 140000, "outcome": "fix-proposed", "verifier": "ACCEPT"}
{"run_id": "2026-10-02T04:20:00+08:00", "pattern": "phase-build:G", "items_found": 4, "actions_taken": 1, "escalations": 0, "tokens_estimate": 90000, "outcome": "fix-proposed", "verifier": "ACCEPT"}
