# Free demo deployment

Deploy the React frontend and Laravel API together on Render Free, using
Supabase Free for PostgreSQL and uploaded cover images. Vercel is not required.
This deploys code and synthetic demonstration data into a dedicated database;
it does not transfer local users or books. See the current
[Render deployment guide](render-deployment.md) for required secrets and live API checks.

## 1. Create the database and upload bucket

Create a Supabase Free project. Under **Connect**, copy its PostgreSQL **Session
pooler** URI (port 5432), replace the password placeholder with the URL-encoded
database password, and add `?sslmode=require`. This is `DB_URL`. Use the session
pooler for IPv4 connectivity; do not use a Supabase API URL or anon key.

In Storage, create a public bucket named `covers`. In Storage's S3 settings,
generate S3 credentials and record the endpoint and region. Set:

| Render variable | Value |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | Supabase S3 access key ID |
| `AWS_SECRET_ACCESS_KEY` | Supabase S3 secret access key |
| `AWS_DEFAULT_REGION` | Project region from S3 settings |
| `AWS_BUCKET` | `covers` |
| `AWS_ENDPOINT` | `https://<project-ref>.supabase.co/storage/v1/s3` |
| `AWS_URL` | `https://<project-ref>.supabase.co/storage/v1/object/public/covers` |

Keep these values in Render's environment settings, outside Git.

## 2. Deploy on Render

Commit the reviewed deployment files and application changes to a deployment
branch and push it to GitHub. The working tree may contain changes that have not
been pushed; Render builds the selected remote commit, not local files.

In Render, select **New > Blueprint**, connect this repository, select that
branch, and use the root `render.yaml`. Confirm the web service uses **Free**.
Enter the requested environment variables. Generate a new application key with
`php artisan key:generate --show` locally and enter it as `APP_KEY`; retain the
same key across redeploys. Never copy the local `.env` into the image.

For a **new, empty Supabase database**, set `RUN_MIGRATIONS=true` in Render and
deploy the service. For an existing database, back it up and review the pending
migrations before enabling this switch. Startup runs `migrate --force`, never
`migrate:fresh`. With `LIBRARY_DEMO_DATA=true`, it then runs the additive
`SyntheticDemoSeeder --force`, requiring a `LIBRARY_DEMO_PASSWORD` of at least
12 characters. It does not run `DatabaseSeeder` or cleanup seeders. After the first successful
deployment, set `RUN_MIGRATIONS=false`. Enable it again only for reviewed schema
updates. Automatic deployments are disabled in the blueprint.

Render supplies `RENDER_EXTERNAL_URL`; startup uses it for Laravel's `APP_URL`.
Open the returned HTTPS address and check `/up`, the home page, registration,
login, and cover uploads. A healthy `/up` alone does not verify the database or S3.

The synthetic dataset includes `admin@demo.example` for the staff login and
`student01@demo.example` through `student24@demo.example` for student login.
New accounts use `LIBRARY_DEMO_PASSWORD`; existing passwords are preserved.

If deploying without synthetic data, the new database has no librarian account.
After registering your own account, an administrator can use Supabase's SQL
editor to promote that specific account:

```sql
UPDATE public.users
SET role = 'librarian', status = 'active'
WHERE email = '<your registered email>';
```

Seed reference data only after reviewing the individual seeders. Do not run
`DatabaseSeeder` or `CleanDatabaseSeeder` against live data.

## Free-tier limits

- [Render Free](https://render.com/docs/free) sleeps after 15 idle minutes;
  waking takes about a minute. Its filesystem is ephemeral. Use Supabase for
  the database and uploads. Render's free database expires after 30 days, so
  this setup does not provision one.
- [Supabase Free](https://supabase.com/pricing) includes a 500 MB database and
  1 GB file storage, with usage limits; projects pause after a week of inactivity.
- Python forecasting is installed and enabled. A supervised queue worker handles
  insights in the background. The scheduler also runs inside the container, but
  both stop while Render Free sleeps; exact-time reminders require always-on hosting.
  Validate memory use for the combined web and Python processes on the selected plan.
- External AI providers are optional and can charge independently. No paid AI
  keys are provisioned. Configure provider keys only if you intend to use them.
- Email defaults to logging. Configure an email provider if you need delivery.

## Local verification

Run `npm.cmd test` and `npm.cmd run lint`. Build the frontend with
`npm.cmd --prefix frontend run build` (writes Laravel's `public/build`). With
Docker installed, use `docker build -t libralearn .` to verify the full Linux
image before deployment. The image excludes local secrets, runtime data, and
development dependencies.
