# Synthetic demo data

On the local development database, run:

```sh
php artisan db:seed --class=SyntheticDemoSeeder
```

Adds 24 synthetic students, one admin, 18 fictional titles with 54 physical
copies, 852 historical returned loans across the previous six months, nine
current borrowing requests/loans, 12 reservations, saved books, interests and
notifications. The activity includes rising, steady and declining demand,
six unused titles, overdue loans and reservations ready for pickup.

New account credentials:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@demo.example | Demo12345! |
| Student | student01@demo.example | Demo12345! |

Student emails continue through `student24@demo.example`. All accounts use
the same initial password. Existing account passwords are preserved.

The seeder runs in `local` or `testing` by default. For a dedicated hosted demo,
set `LIBRARY_DEMO_DATA=true` and a `LIBRARY_DEMO_PASSWORD` of at least 12 characters.
Run `php artisan db:seed --class=SyntheticDemoSeeder --force` (the Render startup
script runs this when opted in). Hosted accounts use the configured password;
the sample password above applies only to local/testing without an override.
See [Render deployment](render-deployment.md) for storage and API requirements.
It adds its own records inside
a database transaction, preserves existing data and can be run again without
duplicating the same fixtures or undoing demo workflow actions. Running it in
a later month adds history for newly covered months. Synthetic records have
`SYN-BOOK-` identifiers, `@demo.example` emails or `library:` activity notes.
Book titles, author names, student names and notifications have no demo labels.
Illustrated covers are bundled in `database/assets/book-covers/` and copied to
the configured cover disk when a book has no cover. Custom covers are preserved.
For the existing sample titles, run `php artisan db:seed --class=BookCoverSeeder`.
It is separate from the default database seeder and the older DemoActivitySeeder.
