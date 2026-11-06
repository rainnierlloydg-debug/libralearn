<?php

namespace App\Console\Commands;

use App\Services\Deployment\LibrarySnapshot;
use Illuminate\Console\Command;

class ImportLibrarySnapshot extends Command
{
    protected $signature = 'library:import-snapshot {path} {--key-file=} {--dry-run}';
    protected $description = 'Restore an encrypted snapshot into an empty migrated database; existing data is never cleared';

    public function handle(LibrarySnapshot $snapshot): int
    {
        try {
            $path = $this->argument('path');
            $summary = $snapshot->import($path, $this->option('key-file') ?: $path.'.key', $this->option('dry-run'));
            $this->table(['Table', 'Records'], collect($summary['tables'])->map(fn ($count, $table) => [$table, $count])->all());
            $this->info(($this->option('dry-run') ? 'Validated' : 'Restored').' snapshot with '.$summary['files'].' uploads.');

            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }
}
