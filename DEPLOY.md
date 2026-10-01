# Deploying LibraLearn

Target: **Supabase** (PostgreSQL + Storage) → **Railway** (Laravel API: web, queue worker, scheduler) → **Vercel** (React frontend in `/frontend`). Auth stays on Sanctum bearer tokens.

Do the steps in this order. Each one needs a value from the step before it.

## 1. Supabase

1. Create a project at supabase.com. Note the database password you set.
2. **Database URL:** Project → Connect → **Session pooler** (IPv4, port 5432). Copy the URI:
   `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
   Use the session pooler, not the transaction pooler (port 6543): Laravel uses prepared statements.
3. **Storage bucket:** Storage → New bucket → name `covers`, **Public bucket: on**.
4. **S3 keys:** Storage → Settings → S3 Connection. Note the **Endpoint** and **Region**, then create an access key pair (Access key ID + Secret).

## 2. Railway (Laravel API)

1. New Project → Deploy from GitHub repo → pick this repo. This first service is the **web** service. It uses `railway.json` (Railpack build, `railway/init-app.sh` runs migrations before each deploy, health check `/up`).
2. Web service → Settings → Networking → **Generate Domain**. This is the API origin, e.g. `https://libralearn-api.up.railway.app`.
3. Web service → **Variables** (Raw editor), fill in your values:

   ```
   APP_NAME=LibraLearn
   APP_ENV=production
   APP_DEBUG=false
   APP_KEY=                      # run `php artisan key:generate --show` locally and paste
   APP_URL=https://libralearn-api.up.railway.app
   LOG_CHANNEL=stderr

   DB_CONNECTION=pgsql
   DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   DB_SSLMODE=require

   SESSION_DRIVER=database
   CACHE_STORE=database
   QUEUE_CONNECTION=database

   COVERS_DISK=s3
   AWS_ACCESS_KEY_ID=<supabase s3 access key id>
   AWS_SECRET_ACCESS_KEY=<supabase s3 secret>
   AWS_DEFAULT_REGION=<supabase region, e.g. ap-southeast-1>
   AWS_BUCKET=covers
   AWS_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
   AWS_USE_PATH_STYLE_ENDPOINT=true
   AWS_URL=https://<project-ref>.supabase.co/storage/v1/object/public/covers

   CORS_ALLOWED_ORIGINS=https://<your-app>.vercel.app   # update after step 3
   LIBRARY_TIMEZONE=Asia/Manila
   LIBRARY_FINE_PER_DAY=5

   GOOGLE_CLOUD_VISION_API_KEY=<key>
   GOOGLE_BOOKS_API_KEY=<key>
   GOOGLE_BOOKS_API_URL=https://www.googleapis.com/books/v1/volumes
   OPEN_LIBRARY_API_URL=https://openlibrary.org/search.json
   OPENAI_API_KEY=<optional>
   ```

   Railpack installs `pdo_pgsql` because `composer.json` requires `ext-pdo_pgsql`.
4. Deploy. The pre-deploy step runs `php artisan migrate --force` against Supabase. Open `https://<api-domain>/up`: it should return 200.
5. **Queue worker:** in the project, New → GitHub Repo → same repo. Settings → **Config-as-code file path** = `railway.worker.json`. Variables → copy all variables from the web service (Railway: "Shared variables" or the Raw editor). No domain needed.
6. **Scheduler:** New → same repo again. Config-as-code path = `railway.cron.json`, same variables, no domain. It runs `php artisan schedule:work`: overdue marking (00:05), due-date reminders (07:00) and reservation expiry (hourly), on Manila time.
7. **First admin account:** web service → ⋯ → Shell (or `railway run` locally):
   `php artisan db:seed --force` creates the seed users and books. Change their passwords right after. Skip `DemoActivitySeeder` on the real school database.

## 3. Vercel (frontend)

1. Add New → Project → import this repo.
2. **Root Directory:** `frontend`. Framework is Vite. Build settings come from `frontend/vercel.json` (`npm run build`, output `dist`, SPA rewrites).
3. **Environment variable:** `VITE_API_URL=https://libralearn-api.up.railway.app` (the Railway API origin, without `/api`). Vercel sets `VERCEL=1`, which makes `vite.config.js` build the standalone SPA into `dist/`.
4. Deploy and note the URL, e.g. `https://libralearn.vercel.app`.
5. Back on Railway (web, worker, scheduler): set `CORS_ALLOWED_ORIGINS` to that URL and redeploy the web service.

## 4. Check it works

- `https://<api-domain>/up` returns 200.
- On the Vercel URL: register a student. It should say the account is waiting for approval. Log in as librarian, approve the student on Students, log in as the student.
- Librarian: upload a cover (Books) or a photo (AI Cataloging). The image URL should start with `https://<project-ref>.supabase.co/storage/v1/object/public/covers/`.
- Railway scheduler logs show `schedule:work` running. You can run the jobs once by hand from the web Shell: `php artisan library:mark-overdue`, `php artisan library:send-due-reminders`, `php artisan library:expire-reservations`.

## If the first Railway deploy misbehaves

- **Build fails on `npm run build`:** Railpack also builds the root `package.json` (Laravel's starter Vite assets). The API doesn't need them: remove the `"build"` script from the root `package.json` and redeploy.
- **Config changes not picked up:** `php artisan optimize` runs in the pre-deploy container. If the running service shows stale config, run `php artisan optimize:clear` from the Shell.
- Only `/up` and `/api/*` are meant to be used on the API domain. The React app lives on Vercel.

## Local development (unchanged)

- API: Laragon MySQL + `php artisan serve` (port 8000); `php artisan storage:link` once.
- Frontend: `cd frontend && npm run dev` (Vite proxies `/api` and `/storage` to port 8000). Leave `VITE_API_URL` empty.
- Scheduler locally: `php artisan schedule:work`.
- Tests: `php artisan test` (SQLite) and `composer test:pgsql` (local PostgreSQL, uses the `PG_*` values in `.env`).
