#!/bin/sh
set -eu

: "${APP_KEY:?Set a persistent Laravel APP_KEY in the hosting environment}"
: "${DB_URL:?Set the managed database connection URL}"
if [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
    export APP_URL="${APP_URL:-https://${RAILWAY_PUBLIC_DOMAIN}}"
else
    export APP_URL="${APP_URL:-${RENDER_EXTERNAL_URL:-http://localhost:10000}}"
fi

mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

php artisan config:cache
php artisan view:cache
php artisan storage:link --force

# Enable only after reviewing migrations against the selected database.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force
fi

if [ "${LIBRARY_DEMO_DATA:-false}" = "true" ]; then
    php artisan library:seed-demo
fi

if [ "${RUN_BACKGROUND_PROCESSES:-false}" = "true" ]; then
    exec /usr/bin/supervisord -c /etc/supervisor/libralearn.conf
fi

exec apache2-foreground
