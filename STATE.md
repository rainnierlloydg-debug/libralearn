# Loop State — LibraLearn

Last run: 2026-10-02 (phase build, human-started)
Baseline: `php artisan test` 7 passed (SQLite in-memory) · `npm run build` OK (chunk-size warning only)

## Phase scorecard

| Phase | Status | Evidence |
|-------|--------|----------|
| A. Book copies + accession numbers | **done** | book_copies table + BookCopy model; loans/reservations carry book_copy_id; books.status kept and auto-synced from copies (human decision); overdue only on loans; backfill = one GSA-###### copy per library book (local MySQL: 16 books → 16 copies, backup in storage/backups); plain page /librarian/books/:id/copies; insights reads book_copies. Tests: BookCopiesTest (14). Verifier: REJECT → minimal-fix → ACCEPT. |
| B. Loan rules + fines | **partial** | `config/library.php` has loan_days=3, max_active_loans=3, max_renewals=1, renewal_days=1, fine_per_day (env). BorrowController does not enforce them: store() has no active-loan cap; extend() is librarian-only with free 1–30 days; no renewal count; no fine computation/storage; no settings table; no student renew request. approve() reads `loan_period_days` (OK, falls back to 14 if config missing). |
| C. Account approval | **missing** | `users.status` enum is `active, inactive`. register() creates `active`. login() already blocks non-active users (AuthController L89) — reusable. No approve/reject endpoints. |
| D. Scheduled jobs | **missing** | `routes/console.php` has only `inspire`; no app/Console commands; no Schedule entries. Expiry logic exists as an HTTP action in ReservationController L291–311 (reusable). No overdue sweep, no due-date reminder. |
| E. Google Cloud Vision OCR | **missing** | AiCatalogController L136 calls OCR.space (`services.ocr`). Open Library + Google Books fallback present. No `GOOGLE_CLOUD_VISION_API_KEY`. No tests for the catalog flow. |
| F. PostgreSQL readiness | **partial** | Tests run on SQLite, not Postgres. 9 `->enum()` columns (Laravel emits CHECK constraints on pgsql — works, but enum changes need migrations). Case-sensitive `LIKE`: Book::scopeSearch (L93–98), BookController L42, UserController L27–29. `selectRaw('DATE(borrow_date)…')` in Dashboard/Report is portable. Uploads hard-coded to `public` disk (BookController L231, AiCatalogController L55/145/178/658). `league/flysystem-aws-s3-v3` not installed. |
| G. Deployment config | **missing** | No railway/render config, no `frontend/vercel.json`, no DEPLOY.md. `frontend/src/utils/api.js` uses `baseURL: '/api'` (no VITE_API_URL). |

Already built (integrate only): AssistantController, AssistantKnowledge, LibraryDemandService, LibraryInsightsNarrator, LibraryInsightsController, DemoActivitySeeder, LibraryInsightsTest — present and green.

## High Priority (loop is acting or waiting on human)

1. **Reservation queue (decision for human).** Approving a reservation now needs a copy on the shelf to hold. When a copy is returned it goes to `available`; it is not auto-held for the oldest waiting reservation. Option: auto-hold on return. Not built.
2. **Phase F needs a Postgres to test against.** No PostgreSQL in Laragon or on PATH, and the CLI PHP (8.2) has no `pdo_pgsql` extension. → Human: install Postgres locally (or give a Supabase test DB URL) and enable `pdo_pgsql`. Effort: M.
3. **Phase B fine rate source.** Spec says settings table; config currently reads `LIBRARY_FINE_PER_DAY` env. → Settings table wins, env becomes the seed default. Effort: M.

## Watch List

- Old `StudentAssistantController.php` and `frontend/src/components/layout/StudentAssistant.jsx` are now unused after the zip overlay (routes point to AssistantController). Leave until the human decides.
- `/api/assistant/chat` route lost its `role:student` gate (now any authenticated user, by design for librarians).
- Frontend bundle 628 kB (Vite warning). Not in scope.
- `.env.example` defaults to `DB_CONNECTION=sqlite`; local dev uses MySQL.

## Recent Noise (ignored this run)

- `RecommendationController` `where('feedback', 'like')` — a value, not a LIKE operator.
- Doctor's second-round actions (gate.yaml, harness-foundry) — out of scope for L1.

## Loop setup (this run)

- Scaffolded daily-triage (claude): LOOP.md, STATE.md, loop-constraints.md, loop-budget.md, loop-run-log.md, AGENTS.md, .claude skills/agent.
- Doctor top-3 fixed: docs/safety.md, .github (issue + PR templates, CI workflow), patterns/registry.yaml. Doctor: HEALTHY 100/100.

---
Run log: loop-run-log.md
