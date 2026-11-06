# Full application deployment with the current data

Status: prepared locally; no Railway project or live URL has been created.
Railway must be installed and connected in the assistant session before deployment.
Check available credits and resource limits before provisioning services.

## Services

Use a new Railway project and empty managed MySQL database, matching the local
database engine. Deploy the same reviewed source to these services:

| Service | Configuration | Purpose |
| --- | --- | --- |
| Web | `railway.json` | React frontend, Laravel API, book uploads, same HTTPS origin |
| Worker | `railway.worker.json` | `analytics,default` queues, including forecasting and AI briefings |
| Scheduler | `railway.cron.json` | Overdue marking, reminders and reservation expiry |

All use the Dockerfile with PHP, Apache, Python, Prophet and statsmodels.
Attach a persistent volume to the **Web** service at
`/var/www/html/storage/app/public`. Keep one web replica with this local cover
disk. Larger deployments can use shared S3 storage instead. Worker and scheduler
use the same database but do not require the public-upload volume for their jobs.

Do not use the existing Render Free blueprint for this full-feature deployment:
its queue and forecast settings intentionally target a smaller configuration.

## Runtime variables

Use the hosting secret manager, never Git, build arguments, browser variables,
or frontend source for credentials. Preserve configured AI model and provider
URLs when transferring their keys.

| Variable | Setting |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | New persistent Laravel application key, shared by all services |
| `APP_URL` | Web HTTPS URL; web startup can derive it from `RAILWAY_PUBLIC_DOMAIN` |
| `DB_CONNECTION` | `mysql` |
| `DB_URL` | Managed database's private connection URL |
| `CACHE_STORE`, `SESSION_DRIVER`, `QUEUE_CONNECTION` | `database` |
| `SESSION_SECURE_COOKIE` | `true` |
| `COVERS_DISK` | `public` with the web volume mounted |
| `LOG_CHANNEL` | `stderr` |
| `LIBRARY_FORECAST_ENABLED` | `true` |
| `LIBRARY_FORECAST_PYTHON` | `/opt/forecast-venv/bin/python` (in image) |
| `GEMINI_API_KEY` | Existing working assistant key |
| `GEMINI_CATALOG_API_KEY` | Existing working catalog key, or the shared Gemini key |
| `GEMINI_MODEL`, `GEMINI_API_URL` | Match the verified local provider configuration |
| `GOOGLE_BOOKS_API_URL` | `https://www.googleapis.com/books/v1/volumes` |
| `GOOGLE_BOOKS_API_KEY` | A working credential with Books API access and quota |
| `GOOGLE_CLOUD_VISION_API_KEY` | Optional; Gemini handles cover identification without it |
| `OPEN_LIBRARY_API_URL` | `https://openlibrary.org/search.json` |
| `RUN_MIGRATIONS` | `false`; the web pre-deploy command performs migrations |

Keep frontend and API together; the existing relative `/api` calls and
`/storage` image URLs then work without a separate frontend API origin.

## Current-data transfer

The prepared encrypted bundle and its separate key are local-only in
`storage/backups/`. The archive is deliberately excluded from Git and the Docker
build context. Its contents include password hashes, student records and
transaction history, so transfer both files only through authenticated access.
Never put either file in a public bucket, repository or web directory.

Capture a new snapshot immediately before the final transfer if local records
have changed:

```sh
php -d memory_limit=512M artisan library:export-snapshot storage/backups/current.llsnapshot
```

After the new target database is migrated, securely transfer the bundle and key
to private storage on the web service. Validate, then import:

```sh
php -d memory_limit=512M artisan library:import-snapshot /private/path/current.llsnapshot --key-file=/private/path/current.llsnapshot.key --dry-run
php -d memory_limit=512M artisan library:import-snapshot /private/path/current.llsnapshot --key-file=/private/path/current.llsnapshot.key
```

The importer refuses a nonempty application database. It does not delete tables,
replace existing users, run sample seeders, or change passwords. It transfers
record IDs and relationships, public uploads, saved books, notifications, catalog
jobs and settings. It excludes API-provider secrets, active login tokens,
sessions, cache, queued jobs and logs. Imported accounts sign in again normally.

On 2026-11-06, the full bundle was restored to a separate SQLite verification
database: 53 users, 31 books, 67 copies, 1,228 borrowing records, 117 reservations,
and 44 uploaded files, plus reference/pivot records. The source directory's 45th
file is `.gitignore`, which is intentionally excluded. Foreign-key checks passed;
both presentation account passwords remained valid. The local database was not
reset or changed by this verification. Verify again against the deployed MySQL
database, then remove the temporary bundle/key from the web service.
If the import runs as root, restore upload ownership afterward with
`chown -R www-data:www-data /var/www/html/storage/app/public` so Apache can
accept subsequent cover uploads. Startup also restores runtime-directory
ownership after a volume mount. Test an authenticated HTTP upload as well as
the CLI storage probe.

Start worker and scheduler after the import and count verification. The scheduler
will subsequently update overdue loans and expired reservations normally.

## Required live verification

```sh
php artisan library:deployment-check --external --forecast
```

This checks the database, build, upload storage, async queue configuration,
Python forecasting, Gemini assistant/catalog credentials, Open Library and Google
Books. It prints no credentials. The external probes use small live requests.
A valid queue setting alone does not prove a running worker: also load Analytics
and verify that a queued job completes and `processing` becomes false.

Then check the HTTPS URL, `/up`, both login portals, role restrictions, books and
their images, student search, saved books, borrowing/returns/reservations, map,
reports/CSV export, recommendations, assistant, catalog identification and online
search. Verify uploaded images survive a redeploy. Compare imported table counts
with the encrypted bundle before making test transactions.

Local external preflight: Gemini assistant, Gemini catalog and Open Library
passed. Google Books was configured with a base URL lacking `/volumes`; the
configuration now normalizes that base URL. The standard endpoint returned a
quota error without a Books key, and the existing Gemini credential did not grant
Books access. Google Books cannot be marked verified until a working Books
credential/quota is configured. The full Linux Docker image and hosted forecast
runtime still require cloud build verification; Docker is unavailable locally.

Local validation after these changes: 123 tests passed (736 assertions), frontend
lint and production build passed, and all deployment shell scripts passed syntax
checks. No production import or online deployment has run yet.
