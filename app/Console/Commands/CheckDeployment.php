<?php

namespace App\Console\Commands;

use App\Services\Ai\GeminiClient;
use App\Services\Ai\RepositoryForecastService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CheckDeployment extends Command
{
    protected $signature = 'library:deployment-check {--external : Probe live AI and book search providers} {--forecast : Run the Python forecast engine}';
    protected $description = 'Verify deployment dependencies without displaying credentials';

    public function handle(): int
    {
        $failed = false;
        $check = function (string $label, callable $probe) use (&$failed) {
            try {
                if (!$probe()) {
                    throw new \RuntimeException('Probe failed');
                }
                $this->info('PASS '.$label);
            } catch (\Throwable $exception) {
                $failed = true;
                $reason = $exception instanceof \Illuminate\Http\Client\RequestException
                    ? 'HTTP '.$exception->response->status()
                    : class_basename($exception);
                $this->error('FAIL '.$label.' ('.$reason.'); review the server configuration/provider logs.');
            }
        };
        $check('Database and library records', fn () => DB::table('books')->count() >= 0 && DB::table('users')->count() >= 0);
        $check('Frontend build', fn () => is_file(public_path('build/manifest.json')));
        $check('Cover storage read/write', function () {
            $disk = Storage::disk(config('filesystems.covers_disk', 'public'));
            $path = '.deployment-check/'.Str::uuid().'.txt';
            try {
                return $disk->put($path, 'storage-ok') && $disk->get($path) === 'storage-ok';
            } finally {
                $disk->delete($path);
            }
        });
        $check('Background queue configuration', fn () => !in_array(config('queue.default'), ['sync', 'null'], true));
        if ($this->option('forecast')) {
            $check('Python forecasting', fn () => app(RepositoryForecastService::class)->predictWithFallback([10, 12, 15, 13, 18, 21]) !== null);
        }
        if ($this->option('external')) {
            foreach (['gemini.api_key' => 'Gemini assistant', 'gemini.catalog_api_key' => 'Gemini cover identification'] as $name => $label) {
                $key = config('services.'.$name) ?: config('services.gemini.api_key');
                $check($label, fn () => $key && app(GeminiClient::class)->generate([
                    'contents' => [['role' => 'user', 'parts' => [['text' => 'Reply with OK.']]]],
                    'generationConfig' => ['maxOutputTokens' => 32],
                ], 15, $key)->throw()->successful());
            }
            $check('Open Library search', fn () => Http::connectTimeout(5)->timeout(15)
                ->get(config('services.open_library.api_url'), ['q' => 'harry potter', 'limit' => 1])->throw()->successful());
            $check('Google Books search', fn () => Http::connectTimeout(5)->timeout(15)
                ->get(config('services.google_books.api_url'), array_filter([
                    'q' => 'isbn:9780747532699', 'maxResults' => 1, 'key' => config('services.google_books.api_key'),
                ]))->throw()->successful());
            if (!config('services.google_vision.api_key')) {
                $this->warn('Optional Google Vision OCR is not configured; cover identification uses Gemini.');
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
