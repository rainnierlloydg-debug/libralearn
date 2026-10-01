<?php

namespace App\Console\Commands;

use App\Models\BorrowTransaction;
use Illuminate\Console\Command;

class MarkOverdueLoans extends Command
{
    protected $signature = 'library:mark-overdue';

    protected $description = 'Mark borrowed loans past their due date as overdue and notify the students';

    public function handle(): int
    {
        $loans = BorrowTransaction::with('book')
            ->where('status', 'borrowed')
            ->where('due_date', '<', now())
            ->get();

        $loans->each->markOverdue();

        $this->info("Marked {$loans->count()} loan(s) overdue.");

        return self::SUCCESS;
    }
}
