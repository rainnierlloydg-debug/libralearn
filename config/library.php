<?php

/*
|--------------------------------------------------------------------------
| GSA Library Rules
|--------------------------------------------------------------------------
|
| Loan rules agreed with Good Shepherd Academy. The fine amount is meant to
| move into an admin-editable settings table later. Until then, it reads
| from LIBRARY_FINE_PER_DAY so the librarian can change it without code.
*/

return [
    'school_name' => env('LIBRARY_SCHOOL_NAME', 'Good Shepherd Academy'),

    // Calendar used for due-date reminders and the daily schedule.
    'timezone' => env('LIBRARY_TIMEZONE', 'Asia/Manila'),

    'loan_days' => (int) env('LIBRARY_LOAN_DAYS', 3),
    // Read by BorrowController::approve() when setting the due date.
    'loan_period_days' => (int) env('LIBRARY_LOAN_DAYS', 3),
    'max_active_loans' => (int) env('LIBRARY_MAX_ACTIVE_LOANS', 3),
    'max_renewals' => (int) env('LIBRARY_MAX_RENEWALS', 1),
    'renewal_days' => (int) env('LIBRARY_RENEWAL_DAYS', 1),
    'fine_per_day' => env('LIBRARY_FINE_PER_DAY'), // pesos, null = not set yet

    /*
    | Demand forecasting (AI Insights)
    |
    | turnaround_days: days a returned copy needs before the next loan
    | (checking, reshelving). target_utilization: share of a copy's
    | capacity we plan to use, leaving slack for demand spikes.
    */
    'insights' => [
        'default_months' => (int) env('LIBRARY_INSIGHTS_MONTHS', 6),
        'turnaround_days' => (int) env('LIBRARY_TURNAROUND_DAYS', 1),
        'target_utilization' => (float) env('LIBRARY_TARGET_UTILIZATION', 0.7),
        'cache_minutes' => (int) env('LIBRARY_INSIGHTS_CACHE_MINUTES', 30),
    ],
];
