# Loop State — LibraLearn

Last run: 2026-10-02 (phase build, human-started)
Baseline: `php artisan test` 7 passed (SQLite in-memory) · `npm run build` OK (chunk-size warning only)

## Phase scorecard

| Phase | Status | Evidence |
|-------|--------|----------|
| A. Book copies + accession numbers | **done** | book_copies table + BookCopy model; loans/reservations carry book_copy_id; books.status kept and auto-synced from copies (human decision); overdue only on loans; backfill = one GSA-###### copy per library book (local MySQL: 16 books → 16 copies, backup in storage/backups); plain page /librarian/books/:id/copies; insights reads book_copies. Tests: BookCopiesTest (14). Verifier: REJECT → minimal-fix → ACCEPT. |
| B. Loan rules + fines | **done** | Request cap (3 open loans+requests) and approve cap (3 out); 3-day due date from config; student renew-request + librarian renew/decline (1 renewal, +1 day, not when past due); old /extend now follows renewal rules; settings table (fine_per_day, env is only default); fine = days late × rate stored on good/damaged returns; mark fine paid; plain /librarian/loan-desk page; Request Renewal button in My Books. Tests: LoanRulesTest (11). Verifier: ACCEPT. |
| C. Account approval | **done** | users.status now string (active/inactive/pending/rejected; enum dropped for Postgres); registration starts pending, no token, librarians notified; login 403 with pending message; librarian approve (in-app notification) / reject (kept as rejected, not deleted); PUT cannot bypass approval; plain Approve/Reject buttons + filter on Students page. Tests: AccountApprovalTest (9). Verifier: REJECT → minimal-fix → ACCEPT. |
| D. Scheduled jobs | **done** | library:mark-overdue (daily 00:05), library:send-due-reminders (daily 07:00, "tomorrow" on the school calendar, one reminder per due date via reminded_due_date), library:expire-reservations (hourly); LIBRARY_TIMEZONE=Asia/Manila; shared logic moved to BorrowTransaction::markOverdue and Reservation::expire/releaseHeldCopy; fines now count days on the same calendar. Needs `php artisan schedule:work` or a scheduler process. Tests: ScheduledJobsTest (5, frozen clock). Verifier: ACCEPT. |
| E. Google Cloud Vision OCR | **done** | Vision TEXT_DETECTION via backend (key in X-Goog-Api-Key header, never in URL or logs); flow kept: OCR → (OpenAI, existing) → Open Library → Google Books fallback (now correctly triggered only when Open Library has no docs) → librarian review. No fabrication: genre/subject default "Not detected" (was Fiction/General); "Not detected" title/author cannot be confirmed. Base lookup URLs accepted. Tests: AiCatalogVisionTest (8, Http::fake + preventStrayRequests). Verifier: REJECT (key in logs) → minimal-fix → ACCEPT. |
| F. PostgreSQL readiness | **partial** | Tests run on SQLite, not Postgres. 9 `->enum()` columns (Laravel emits CHECK constraints on pgsql — works, but enum changes need migrations). Case-sensitive `LIKE`: Book::scopeSearch (L93–98), BookController L42, UserController L27–29. `selectRaw('DATE(borrow_date)…')` in Dashboard/Report is portable. Uploads hard-coded to `public` disk (BookController L231, AiCatalogController L55/145/178/658). `league/flysystem-aws-s3-v3` not installed. |
| G. Deployment config | **missing** | No railway/render config, no `frontend/vercel.json`, no DEPLOY.md. `frontend/src/utils/api.js` uses `baseURL: '/api'` (no VITE_API_URL). |

Already built (integrate only): AssistantController, AssistantKnowledge, LibraryDemandService, LibraryInsightsNarrator, LibraryInsightsController, DemoActivitySeeder, LibraryInsightsTest — present and green.

## High Priority (loop is acting or waiting on human)

1. **Reservation queue (decision for human).** Approving a reservation now needs a copy on the shelf to hold. When a copy is returned it goes to `available`; it is not auto-held for the oldest waiting reservation. Option: auto-hold on return. Not built.
2. **Phase F needs a Postgres to test against.** No PostgreSQL in Laragon or on PATH, and the CLI PHP (8.2) has no `pdo_pgsql` extension. → Human: install Postgres locally (or give a Supabase test DB URL) and enable `pdo_pgsql`. Effort: M.
3. **Phase B UI leftovers (low).** BorrowingPage "Extend" still prompts for days (server now applies the 1-day renewal rule); damaged returns have no return_date (pre-existing).

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

## Found during build (not fixed, outside phase scope)

- **Local .env lookup URLs are base URLs** (`OPEN_LIBRARY_API_URL=https://openlibrary.org`, `GOOGLE_BOOKS_API_URL=https://www.googleapis.com/books/v1`). AI catalog now tolerates this; **OnlineSearchController (student online search) still breaks** and still sends the Books key as a URL query param. Fix: set full URLs in `.env` (`.../search.json`, `.../volumes`) or apply the same handling there.
- `.env` still has `OCR_API_KEY`/`OCR_API_URL` (OCR.space, now unused). Add `GOOGLE_CLOUD_VISION_API_KEY` to use Vision.
