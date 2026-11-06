#!/bin/sh
# Pre-deploy step for the web service: migrate, then cache config/routes.
set -e
php artisan migrate --force
php artisan optimize
