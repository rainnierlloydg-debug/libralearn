<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\LibraryDemandService;
use App\Services\Ai\LibraryInsightsNarrator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

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
        [$months, $days] = $this->period($request);

        $data = Cache::remember(
            $this->cacheKey('analysis', $months, $days),
            now()->addMinutes(config('library.insights.cache_minutes', 30)),
            fn () => $this->demand->analyze($months, null, $days)
        );

        return response()->json(['success' => true, 'data' => $data]);
    }

    /** GET /ai/insights/briefing?months=6 — short written briefing. */
    public function briefing(Request $request)
    {
        [$months, $days] = $this->period($request);

        $briefing = Cache::remember(
            $this->cacheKey('briefing', $months, $days),
            now()->addMinutes(config('library.insights.cache_minutes', 30)),
            fn () => $this->narrator->narrate($this->demand->analyze($months, null, $days))
        );

        return response()->json(['success' => true, 'data' => $briefing]);
    }

    /** POST /ai/insights/refresh — drop cached results after new activity. */
    public function refresh(Request $request)
    {
        [$months, $days] = $this->period($request);
        Cache::forget($this->cacheKey('analysis', $months, $days));
        Cache::forget($this->cacheKey('briefing', $months, $days));

        return $this->index($request);
    }

    private function period(Request $request): array
    {
        $validated = $request->validate([
            'months' => 'nullable|integer|min:3|max:24',
            'days' => 'nullable|integer|in:7,14,30',
        ]);

        if ($request->filled('months') && $request->filled('days')) {
            throw ValidationException::withMessages([
                'period' => 'Choose either a day range or a month range.',
            ]);
        }

        return [
            (int) ($validated['months'] ?? config('library.insights.default_months', 6)),
            isset($validated['days']) ? (int) $validated['days'] : null,
        ];
    }

    private function cacheKey(string $type, int $months, ?int $days = null): string
    {
        $period = $days === null ? "{$months}m" : "{$days}d";

        return "library_insights:v3:{$type}:{$period}:" . now()->format('Y-m-d');
    }
}
