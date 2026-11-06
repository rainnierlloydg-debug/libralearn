<?php

namespace App\Console\Commands;

use Database\Seeders\SyntheticDemoSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class SeedHostedDemo extends Command
{
    protected $signature = 'library:seed-demo';

    protected $description = 'Initialize hosted demo fixtures once per seeder version and month';

    public function handle(): int
    {
        if (!config('library.demo.enabled')) {
            $this->info('Hosted demo seeding is disabled.');

            return self::SUCCESS;
        }

        $key = 'library:synthetic-demo:'.now()->format('Y-m').':'.hash_file('sha256', database_path('seeders/SyntheticDemoSeeder.php'));

        return Cache::lock('library:synthetic-demo:seed-lock', 1200)->block(30, function () use ($key) {
            if (Cache::has($key)) {
                $this->info('Synthetic demo already initialized for this version and month.');

                return self::SUCCESS;
            }

            $status = $this->call('db:seed', ['--class' => SyntheticDemoSeeder::class, '--force' => true]);
            if ($status !== self::SUCCESS) {
                return $status;
            }
            Cache::forever($key, true);

            return self::SUCCESS;
        });
    }
}
