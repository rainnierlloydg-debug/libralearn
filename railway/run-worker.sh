#!/bin/sh
# Queue worker service (QUEUE_CONNECTION=database).
php artisan queue:work --sleep=3 --tries=3 --max-time=3600
