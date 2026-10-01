<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\LibraryDemandService;
use App\Services\Ai\LibraryInsightsNarrator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class LibraryInsightsController extends Controller
{
    public function __construct(
        private LibraryDemandService $demand,
        private LibraryInsightsNarrator $narrator,
    ) {
    }

    /** GET /ai/insights?months=6 — numbers, forecasts, copy recommendations. */
    public function index(Request $request)
    {
        $months = $this->months($request);

        $data = Cache::remember(
            $this->cacheKey('analysis', $months),
            now()->addMinutes(config('library.insights.cache_minutes', 30)),
            fn () => $this->demand->analyze($months)
        );

        return response()->json(['success' => true, 'data' => $data]);
    }

    /** GET /ai/insights/briefing?months=6 — short written briefing. */
    public function briefing(Request $request)
    {
        $months = $this->months($request);

        $briefing = Cache::remember(
            $this->cacheKey('briefing', $months),
            now()->addMinutes(config('library.insights.cache_minutes', 30)),
            fn () => $this->narrator->narrate($this->demand->analyze($months))
        );

        return response()->json(['success' => true, 'data' => $briefing]);
    }

    /** POST /ai/insights/refresh — drop cached results after new activity. */
    public function refresh(Request $request)
    {
        $months = $this->months($request);
        Cache::forget($this->cacheKey('analysis', $months));
        Cache::forget($this->cacheKey('briefing', $months));

        return $this->index($request);
    }

    private function months(Request $request): int
    {
        $request->validate(['months' => 'nullable|integer|min:3|max:24']);

        return (int) $request->input('months', config('library.insights.default_months', 6));
    }

    private function cacheKey(string $type, int $months): string
    {
        return "library_insights:{$type}:{$months}:" . now()->format('Y-m-d');
    }
}
