#!/bin/sh
set -eu

: "${APP_KEY:?Set a persistent Laravel APP_KEY in Render's environment settings}"
: "${DB_URL:?Set the external PostgreSQL connection URL}"
export APP_URL="${APP_URL:-${RENDER_EXTERNAL_URL:-http://localhost:10000}}"

php artisan config:cache
php artisan view:cache

# Enable only after reviewing migrations against the selected database.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force
fi

exec apache2-foreground
