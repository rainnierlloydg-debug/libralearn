<?php

namespace App\Console\Commands;

use App\Models\Reservation;
use Illuminate\Console\Command;

class ExpireReservations extends Command
{
    protected $signature = 'library:expire-reservations';

    protected $description = 'Expire reservations past their pickup deadline and release the held copies';

    public function handle(): int
    {
        $reservations = Reservation::with(['book', 'bookCopy'])
            ->where('status', 'ready_for_pickup')
            ->where('pickup_deadline', '<', now())
            ->get();

        $reservations->each->expire();

        $this->info("Expired {$reservations->count()} reservation(s).");

        return self::SUCCESS;
    }
}
