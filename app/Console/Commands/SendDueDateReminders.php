<?php

namespace App\Console\Commands;

use App\Models\BorrowTransaction;
use App\Models\Notification;
use Illuminate\Console\Command;

class SendDueDateReminders extends Command
{
    protected $signature = 'library:send-due-reminders';

    protected $description = 'Send an in-app reminder for loans due tomorrow (library timezone)';

    public function handle(): int
    {
        $tz = config('library.timezone', 'Asia/Manila');
        $tomorrow = now($tz)->addDay();

        // "Tomorrow" on the school calendar, as a UTC range for the query.
        $from = $tomorrow->copy()->startOfDay()->utc();
        $to = $tomorrow->copy()->endOfDay()->utc();

        $loans = BorrowTransaction::with('book')
            ->where('status', 'borrowed')
            ->whereBetween('due_date', [$from, $to])
            ->get();

        $sent = 0;
        foreach ($loans as $loan) {
            $dueDate = $loan->due_date->copy()->setTimezone($tz)->toDateString();

            if ($loan->reminded_due_date && substr((string) $loan->reminded_due_date, 0, 10) === $dueDate) {
                continue;
            }

            Notification::createForUser(
                $loan->student_id,
                'Book Due Tomorrow',
                "\"{$loan->book->title}\" is due tomorrow ({$loan->due_date->copy()->setTimezone($tz)->format('M d, Y')}). Return or renew it to avoid a fine.",
                'due_reminder',
                ['transaction_id' => $loan->id, 'book_id' => $loan->book_id, 'due_date' => $dueDate]
            );

            $loan->update(['reminded_due_date' => $dueDate]);
            $sent++;
        }

        $this->info("Sent {$sent} due-date reminder(s).");

        return self::SUCCESS;
    }
}
