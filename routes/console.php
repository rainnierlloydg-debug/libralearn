<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Library jobs (in-app notifications only). Run `php artisan schedule:work`
// locally, or a scheduler process in production.
$tz = config('library.timezone', 'Asia/Manila');

Schedule::command('library:mark-overdue')->dailyAt('00:05')->timezone($tz)->withoutOverlapping();
Schedule::command('library:send-due-reminders')->dailyAt('07:00')->timezone($tz)->withoutOverlapping();
Schedule::command('library:expire-reservations')->hourly()->withoutOverlapping();
