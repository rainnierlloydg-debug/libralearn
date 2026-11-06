<?php

namespace App\Jobs;

use App\Services\Ai\LibraryDemandService;
use App\Services\Ai\LibraryInsightsNarrator;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class BuildLibraryInsights implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $timeout = 75;
    public int $tries = 1;
    public int $uniqueFor = 180;

    public function __construct(
        public int $months,
        public ?int $days,
        public string $analysisKey,
        public string $briefingKey,
    ) {
        $this->onQueue('analytics');
    }

    public function uniqueId(): string
    {
        return $this->analysisKey;
    }

    public function handle(LibraryDemandService $demand, LibraryInsightsNarrator $narrator): void
    {
        $data = $demand->analyze($this->months, null, $this->days);
        $data['processing'] = false;
        $expires = now()->addMinutes(config('library.insights.cache_minutes', 30));
        Cache::put($this->briefingKey, $narrator->narrate($data), $expires);
        Cache::put($this->analysisKey, $data, $expires);
    }

    public function failed(?\Throwable $exception): void
    {
        if ($data = Cache::get($this->analysisKey)) {
            $data['processing'] = false;
            Cache::put($this->analysisKey, $data, now()->addMinutes(5));
        }
    }
}
