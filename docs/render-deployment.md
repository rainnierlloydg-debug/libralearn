# LibraLearn on Render (synthetic demo)

The Docker image serves Laravel, its React production build, the `analytics,default`
queue worker and the scheduler on one origin. No separate Vercel deployment is required.
`render.yaml` opts into the synthetic demonstration dataset. Use a dedicated demo
PostgreSQL database, not a school production database.

## Required account configuration

Connect Render, then create a Blueprint from the reviewed repository branch using
`render.yaml`. The current workspace also contains pre-existing uncommitted changes;
Render builds committed source, so those changes must be reviewed before publishing.

Supply these values as Render environment secrets, never in Git:

| Variable | Value |
| --- | --- |
| `APP_KEY` | Persistent Laravel key; generate with `php artisan key:generate --show` |
| `DB_URL` | Managed PostgreSQL connection URI (Supabase session pooler supports IPv4) |
| `LIBRARY_DEMO_PASSWORD` | At least 12 characters, used for newly created synthetic users |
| `GEMINI_API_KEY` | Working Gemini key for the assistant |
| `GEMINI_CATALOG_API_KEY` | Gemini key for cover identification; can use the same project |
| `GOOGLE_BOOKS_API_KEY` | Google Books API key with Books API enabled and usable quota |
| `GOOGLE_CLOUD_VISION_API_KEY` | Optional Google Vision OCR; Gemini handles identification without it |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Storage S3 credentials |
| `AWS_DEFAULT_REGION` | Storage region |
| `AWS_BUCKET` | Public covers bucket name |
| `AWS_ENDPOINT` | S3 endpoint, e.g. `https://<ref>.supabase.co/storage/v1/s3` |
| `AWS_URL` | Public bucket URL, e.g. `https://<ref>.supabase.co/storage/v1/object/public/covers` |

The image derives `APP_URL` from `RENDER_EXTERNAL_URL`. Leave `VITE_API_URL`,
`VERCEL` and `BUILD_STANDALONE` unset so React calls the same-origin API and builds
into Laravel's `public/build`. Use `DB_CONNECTION=pgsql`, `DB_SSLMODE=require`,
`COVERS_DISK=s3`, `AWS_USE_PATH_STYLE_ENDPOINT=true` as set in the Blueprint.

Startup runs non-resetting `migrate --force`, then `SyntheticDemoSeeder --force`.
Never run `migrate:fresh`, `CleanDatabaseSeeder` or a database reset to deploy this demo.
The synthetic seeder preserves existing records, passwords and workflow changes.
It creates 25 accounts, 18 titles, 54 copies, 852 historical returns, current loans,
reservations, saved books, interests and notifications. Covers are bundled in the
image and uploaded to the configured S3 disk. Repeated starts do not duplicate the
same fixtures; newly covered months can add historical activity.

Staff login: `admin@demo.example` at `/librarian/login`.
Student login: `student01@demo.example` through `student24@demo.example` at `/login`.
New users use `LIBRARY_DEMO_PASSWORD`. Changing that environment variable does not
reset passwords for existing accounts.

## Verification

Before publishing source:

```powershell
npm test
npm run lint
npm --prefix frontend run build
```

After Render reports the deployment live, run the included HTTP smoke check:

```powershell
python deploy/smoke_render.py --url https://<service>.onrender.com --external
```

It prompts for the demo password (or reads `LIBRARY_DEMO_PASSWORD` from the process
environment), logs in through both portals, checks staff/student APIs, downloads a
seeded cover, checks report exports and external book search/chat, then revokes the
tokens it created. It never prints passwords, tokens or response bodies.

With shell access, the additional server-side check is:

```sh
php artisan library:deployment-check --external --forecast
```

Check Render logs for the queue and scheduler starting successfully, no database
or storage errors, and successful completion of `BuildLibraryInsights`. Refresh
Insights after processing finishes to confirm that the Python model results appear.

## Free-plan constraints

Render Free sleeps after 15 minutes without incoming traffic. The first request
then has a cold start; the worker and scheduler also stop while sleeping. Reminders
cannot be guaranteed at exact times on this plan. Use an always-on paid service if
that is required. The single container shares limited memory between web requests
and Python forecasting; validate its memory use against the chosen service plan.

Use managed PostgreSQL and S3 for persistent records and covers. Render Free's
filesystem is ephemeral and its free PostgreSQL expires after 30 days.
See [Render's current free-service limits](https://render.com/docs/free).

A local test pass does not establish that Render's database credentials, bucket
permissions, external API quota or deployed endpoints work. The deployment is only
verified after the live checks pass against the actual Render URL.
