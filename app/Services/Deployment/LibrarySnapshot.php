<?php

namespace App\Services\Deployment;

use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/** Transfers application records and public uploads, excluding sessions, keys and queues. */
class LibrarySnapshot
{
    public const TABLES = [
        'users', 'library_locations', 'interests', 'student_interests', 'books',
        'book_copies', 'book_categories', 'borrow_transactions', 'reservations',
        'saved_books', 'recommendation_feedback', 'notifications', 'ai_catalog_jobs',
        'online_book_searches', 'settings',
    ];

    public function export(string $archive, string $keyFile): array
    {
        if (is_file($archive) || is_file($keyFile)) {
            throw new \RuntimeException('Choose new snapshot/key paths; existing files will not be overwritten.');
        }
        $tables = DB::transaction(function () {
            $tables = [];
            foreach (self::TABLES as $table) {
                $query = DB::table($table);
                $tables[$table] = $query->orderBy(Schema::hasColumn($table, 'id') ? 'id' : Schema::getColumnListing($table)[0])
                    ->get()->map(fn ($row) => (array) $row)->all();
            }

            return $tables;
        });
        $disk = Storage::disk(config('filesystems.covers_disk', 'public'));
        $files = [];
        foreach ($disk->allFiles() as $path) {
            if ($path === '.gitignore') {
                continue;
            }
            $this->validatePath($path);
            $content = $disk->get($path);
            $files[$path] = ['sha256' => hash('sha256', $content), 'content' => base64_encode($content)];
        }
        $payload = ['version' => 1, 'exported_at' => now()->toIso8601String(), 'tables' => $tables, 'files' => $files];
        $key = random_bytes(32);
        $compressed = gzcompress(json_encode($payload, JSON_THROW_ON_ERROR), 6);
        $encrypted = (new Encrypter($key, 'AES-256-CBC'))->encryptString($compressed);
        File::ensureDirectoryExists(dirname($archive));
        File::ensureDirectoryExists(dirname($keyFile));
        File::put($keyFile, base64_encode($key));
        File::put($archive, $encrypted);

        return $this->summary($payload);
    }

    public function import(string $archive, string $keyFile, bool $dryRun = false): array
    {
        $key = base64_decode(trim(File::get($keyFile)), true);
        if ($key === false || strlen($key) !== 32) {
            throw new \RuntimeException('Invalid snapshot transfer key.');
        }
        $compressed = (new Encrypter($key, 'AES-256-CBC'))->decryptString(File::get($archive));
        $json = gzuncompress($compressed);
        if ($json === false) {
            throw new \RuntimeException('Invalid compressed snapshot.');
        }
        $payload = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        if (($payload['version'] ?? null) !== 1 || array_keys($payload['tables'] ?? []) !== self::TABLES || !is_array($payload['files'] ?? null)) {
            throw new \RuntimeException('Unsupported snapshot format.');
        }
        foreach (self::TABLES as $table) {
            if (!Schema::hasTable($table) || DB::table($table)->exists()) {
                throw new \RuntimeException('Import requires migrated, empty application tables. Target is not empty or is missing: '.$table);
            }
        }
        $disk = Storage::disk(config('filesystems.covers_disk', 'public'));
        foreach ($payload['files'] as $path => $file) {
            $this->validatePath($path);
            $content = base64_decode($file['content'], true);
            if ($content === false || !hash_equals($file['sha256'], hash('sha256', $content))) {
                throw new \RuntimeException('Snapshot file checksum mismatch: '.$path);
            }
            if ($disk->exists($path) && !hash_equals($file['sha256'], hash('sha256', $disk->get($path)))) {
                throw new \RuntimeException('Refusing to overwrite a different existing upload: '.$path);
            }
        }
        if (!$dryRun) {
            DB::transaction(function () use ($payload, $disk) {
                foreach (self::TABLES as $table) {
                    foreach (array_chunk($payload['tables'][$table], 20) as $rows) {
                        DB::table($table)->insert($rows);
                    }
                    if (DB::connection()->getDriverName() === 'pgsql' && Schema::hasColumn($table, 'id') && ($max = DB::table($table)->max('id'))) {
                        DB::select("SELECT setval(pg_get_serial_sequence(?, 'id'), ?, true)", [$table, $max]);
                    }
                }
                foreach ($payload['files'] as $path => $file) {
                    if (!$disk->put($path, base64_decode($file['content'], true))) {
                        throw new \RuntimeException('Could not restore upload: '.$path);
                    }
                }
            });
        }

        return $this->summary($payload);
    }

    private function validatePath(string $path): void
    {
        if ($path === '' || str_starts_with($path, '/') || preg_match('/[\\\\:\x00]/', $path)
            || in_array('..', explode('/', $path), true) || in_array('.', explode('/', $path), true)) {
            throw new \RuntimeException('Unsafe upload path in snapshot.');
        }
    }

    private function summary(array $payload): array
    {
        return ['tables' => array_map('count', $payload['tables']), 'files' => count($payload['files'])];
    }
}
