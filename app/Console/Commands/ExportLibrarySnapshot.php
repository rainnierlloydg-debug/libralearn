<?php

namespace App\Console\Commands;

use App\Services\Deployment\LibrarySnapshot;
use Illuminate\Console\Command;

class ExportLibrarySnapshot extends Command
{
    protected $signature = 'library:export-snapshot {path} {--key-file=}';
    protected $description = 'Export encrypted library records and uploads for transfer to a new deployment';

    public function handle(LibrarySnapshot $snapshot): int
    {
        try {
            $path = $this->argument('path');
            $summary = $snapshot->export($path, $this->option('key-file') ?: $path.'.key');
            $this->table(['Table', 'Records'], collect($summary['tables'])->map(fn ($count, $table) => [$table, $count])->all());
            $this->info('Encrypted snapshot saved with '.$summary['files'].' uploads. Keep the key separate and outside Git.');

            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }
}
