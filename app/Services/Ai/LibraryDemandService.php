<?php

namespace App\Services\Ai;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\Reservation;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Library demand analysis and forecasting.
 *
 * Everything here is deterministic and explainable so the numbers can be
 * defended in the capstone paper:
 *   - Demand per month = borrow requests + reservations made that month.
 *   - Next-month forecast = 50% weighted moving average (last 3 months,
 *     weights 1-2-3) + 50% linear trend projection (least squares).
 *   - Copy capacity per month = 30 / (loan days + turnaround days),
 *     planned at a target utilization (default 70%).
 *   - Copies needed = ceil(forecast / usable capacity per copy).
 *
 * The LLM never computes these numbers. It only narrates them
 * (see LibraryInsightsNarrator).
 */
class LibraryDemandService
{
    private const DAYS_PER_MONTH = 30;

    /** Borrow statuses that mean a copy actually left the shelf. */
    private const FULFILLED_STATUSES = ['borrowed', 'return_requested', 'returned', 'overdue', 'lost', 'damaged'];

    /** Reservation statuses still waiting for a copy. */
    private const OPEN_RESERVATION_STATUSES = ['pending', 'approved', 'ready_for_pickup'];

    public function analyze(int $months = 6, ?CarbonInterface $now = null, ?int $days = null): array
    {
        if ($days !== null && !in_array($days, [7, 14, 30], true)) {
            throw new \InvalidArgumentException('Short insight windows must be 7, 14, or 30 days.');
        }

        $months = $days === null ? max(3, min($months, 24)) : 1;
        $now = $now ? Carbon::instance($now) : now();

        $currentMonthStart = $now->copy()->startOfMonth();
        $windowStart = $days === null
            ? $currentMonthStart->copy()->subMonths($months)
            : $now->copy()->subDays($days - 1)->startOfDay();
        $monthKeys = $days === null
            ? $this->monthKeys($windowStart, $months)
            : $this->monthKeysForWindow($windowStart, $currentMonthStart);
        $currentKey = $currentMonthStart->format('Y-m');

        $events = $this->demandEvents($windowStart);
        $books = Book::query()
            ->where('source', 'gsa')
            ->get(['id', 'title', 'author', 'genre', 'subject', 'status', 'library_section', 'shelf', 'created_at'])
            ->keyBy('id');

        $copies = $this->copiesFor($books);
        $openWaitlist = $this->openWaitlist();
        $currentlyOut = $this->currentlyOut();

        $perBook = $this->perBookSeries($events, $monthKeys, $currentKey);
        $capacity = $this->capacityPerCopy();

        $forecastLabel = $days === null ? $currentMonthStart->format('F') : 'the selected period';

        $bookStats = $perBook->map(function (array $series, int $bookId) use ($books, $copies, $openWaitlist, $currentlyOut, $capacity, $forecastLabel, $days) {
            $book = $books->get($bookId);
            if (!$book) {
                return null;
            }

            return $this->bookStats($book, $series, $copies[$bookId] ?? 1, $openWaitlist[$bookId] ?? 0, $currentlyOut[$bookId] ?? 0, $capacity, $forecastLabel, $days !== null);
        })->filter()->values();

        $monthlyTotals = $this->monthlyTotals($events, $monthKeys, $currentKey);
        $predictions = $this->predictionOutlook($monthlyTotals['complete'], $currentMonthStart, $days === null);
        $totalForecast = $predictions['available']
            ? $this->forecast(array_slice(array_column($monthlyTotals['complete'], 'demand'), -$predictions['history_months']))
            : ['value' => 0.0, 'trend' => 'insufficient_data'];
        if ($predictions['available']) {
            $totalForecast['value'] = $predictions['months'][0]['requests'];
        }
        $totalDemand = $days === null
            ? array_sum(array_column($monthlyTotals['complete'], 'demand'))
            : $events->count();
        $totalLoans = $days === null
            ? array_sum(array_column($monthlyTotals['complete'], 'loans'))
            : $events->where('fulfilled', true)->count();
        $turnedAway = $days === null
            ? array_sum(array_column($monthlyTotals['complete'], 'rejected'))
            : $events->where('rejected', true)->count();
        $periodLabel = match ($days) {
            7 => '1 week',
            14 => '2 weeks',
            30 => '1 month',
            default => "{$months} months",
        };
        $method = $this->methodNotes($capacity, $days === null);
        if ($predictions['engine'] === 'statsmodels') {
            $method['forecast'] = 'AR/MA model comparison using rolling validation MAE, RMSE and training AIC, followed by a final fit on complete monthly history. Per-title copy forecasts use the weighted-average and linear-trend baseline.';
        }

        return [
            'generated_at' => $now->toIso8601String(),
            'window' => [
                'months' => $months,
                'days' => $days,
                'label' => $periodLabel,
                'forecast_available' => $predictions['available'],
                'from' => $windowStart->toDateString(),
                'to' => $days === null ? $currentMonthStart->copy()->subDay()->toDateString() : $now->toDateString(),
                'current_month_to_date' => $currentKey,
                // The forecast covers the first month after the complete-month
                // window, which is the month in progress.
                'forecast_month' => $currentKey,
                'forecast_label' => $currentMonthStart->format('F Y'),
            ],
            'method' => $method,
            'summary' => [
                'total_demand' => $totalDemand,
                'total_loans' => $totalLoans,
                'turned_away' => $turnedAway,
                'books_in_demand' => $bookStats->where('window_demand', '>', 0)->count(),
                'books_needing_copies' => $bookStats->where('additional_copies', '>', 0)->count(),
                'next_month_forecast' => $totalForecast['value'],
                'trend' => $totalForecast['trend'],
            ],
            'monthly' => $monthlyTotals,
            'predictions' => $predictions,
            'activity' => $days === null ? null : [
                'buckets' => $this->activityBuckets($events, $windowStart, $now, $days),
            ],
            'top_books' => $bookStats
                ->where('window_loans', '>', 0)
                ->sortByDesc('window_loans')
                ->take(10)
                ->values()
                ->all(),
            'copy_recommendations' => $bookStats
                ->where('additional_copies', '>', 0)
                ->sortBy([
                    fn ($a, $b) => $this->priorityRank($b['priority']) <=> $this->priorityRank($a['priority']),
                    fn ($a, $b) => $b['additional_copies'] <=> $a['additional_copies'],
                    fn ($a, $b) => $b['forecast_next_month'] <=> $a['forecast_next_month'],
                ])
                ->take(15)
                ->values()
                ->all(),
            'categories' => [
                'genre' => $this->categoryTrends($events, $books, 'genre', $days === null ? $monthKeys : [...$monthKeys, $currentKey], $days === null),
                'subject' => $this->categoryTrends($events, $books, 'subject', $days === null ? $monthKeys : [...$monthKeys, $currentKey], $days === null),
            ],
            'underused' => $this->underusedBooks($books, $perBook, $now),
        ];
    }

    /**
     * Next-month forecast for a series of monthly counts (oldest first).
     */
    public function forecast(array $series): array
    {
        $n = count($series);
        if ($n === 0 || array_sum($series) == 0) {
            return ['value' => 0.0, 'wma' => 0.0, 'trend_projection' => 0.0, 'slope' => 0.0, 'trend' => 'none'];
        }

        // Weighted moving average over the last 3 months (weights 1, 2, 3).
        $recent = array_slice($series, -3);
        $weights = array_slice([1, 2, 3], -count($recent));
        $wma = array_sum(array_map(fn ($v, $w) => $v * $w, $recent, $weights)) / array_sum($weights);

        // Least-squares line through (0..n-1, series), projected to x = n.
        $xMean = ($n - 1) / 2;
        $yMean = array_sum($series) / $n;
        $num = 0.0;
        $den = 0.0;
        foreach ($series as $x => $y) {
            $num += ($x - $xMean) * ($y - $yMean);
            $den += ($x - $xMean) ** 2;
        }
        $slope = $den > 0 ? $num / $den : 0.0;
        $projection = max(0.0, $yMean + $slope * ($n - $xMean));

        $value = round(0.5 * $wma + 0.5 * $projection, 1);

        // Trend label: slope relative to the average month.
        $relative = $yMean > 0 ? $slope / $yMean : 0;
        $trend = match (true) {
            $relative > 0.1 => 'rising',
            $relative < -0.1 => 'falling',
            default => 'steady',
        };

        return [
            'value' => $value,
            'wma' => round($wma, 2),
            'trend_projection' => round($projection, 2),
            'slope' => round($slope, 3),
            'trend' => $trend,
        ];
    }

    public function capacityPerCopy(): array
    {
        $loanDays = max(1, (int) config('library.loan_days', 3));
        $turnaround = max(0, (int) config('library.insights.turnaround_days', 1));
        $utilization = min(1.0, max(0.1, (float) config('library.insights.target_utilization', 0.7)));

        $max = self::DAYS_PER_MONTH / ($loanDays + $turnaround);

        return [
            'loan_days' => $loanDays,
            'turnaround_days' => $turnaround,
            'target_utilization' => $utilization,
            'max_loans_per_copy' => round($max, 2),
            'planned_loans_per_copy' => round($max * $utilization, 2),
        ];
    }

    /** Rolling projections and checks against months withheld from the forecast. */
    private function predictionOutlook(array $monthly, CarbonInterface $start, bool $enabled): array
    {
        $series = array_column($monthly, 'demand');
        $firstActivity = null;
        foreach ($series as $index => $count) {
            if ($count > 0) {
                $firstActivity = $index;
                break;
            }
        }
        // Do not treat padded months before the first recorded request as observations.
        $observed = $firstActivity === null ? [] : array_slice($series, $firstActivity);
        $historyMonths = count($observed);
        $available = $enabled && $historyMonths >= 3;
        $confidence = match (true) {
            $historyMonths >= 12 && array_sum($observed) >= 100 => 'high',
            $historyMonths >= 6 && array_sum($observed) >= 20 => 'medium',
            default => 'low',
        };

        $projections = [];
        $working = $observed;
        if ($available) {
            for ($step = 0; $step < 3; $step++) {
                $forecast = $this->forecast($working);
                $month = Carbon::instance($start)->startOfMonth()->addMonths($step);
                $projections[] = [
                    'month' => $month->format('Y-m'),
                    'label' => $month->format('M Y'),
                    'requests' => $forecast['value'],
                ];
                $working[] = $forecast['value'];
            }
        }

        $checks = [];
        if ($enabled) {
            for ($index = max(3, $historyMonths - 3); $index < $historyMonths; $index++) {
                $predicted = $this->forecast(array_slice($observed, 0, $index))['value'];
                $checks[] = [
                    'month' => $monthly[$firstActivity + $index]['month'],
                    'predicted' => $predicted,
                    'actual' => $observed[$index],
                    'absolute_error' => round(abs($observed[$index] - $predicted), 1),
                ];
            }
        }

        $engine = 'baseline';
        $model = 'Weighted average + linear trend';
        $comparison = [];
        $diagnostics = null;
        $extraMetrics = [];
        $configuredEngine = config('library.forecasting.engine', 'prophet');
        $minHistoryForEngine = $configuredEngine === 'statsmodels' ? 8 : 6;
        $fallback = $available && $historyMonths < $minHistoryForEngine
            ? ($configuredEngine === 'statsmodels'
                ? 'AR/MA model comparison needs at least 8 complete months.'
                : 'Prophet needs at least 6 complete months.')
                . ' Select a longer period as more history becomes available.'
            : null;
        if ($available && $historyMonths >= $minHistoryForEngine) {
            $modeled = app(RepositoryForecastService::class)->predictWithFallback($observed);
            if ($modeled) {
                $engine = $modeled['engine'];
                $model = $modeled['selected_model'];
                $comparison = $modeled['model_comparison'];
                $diagnostics = $modeled['diagnostics'] ?? null;
                foreach ($projections as $index => &$projection) {
                    $projection['requests'] = (float) $modeled['forecasts'][$index];
                }
                unset($projection);
                $checks = array_map(fn ($row) => [
                    'month' => $monthly[$firstActivity + $row['index']]['month'],
                    'predicted' => $row['predicted'], 'actual' => $row['actual'],
                    'absolute_error' => round(abs($row['actual'] - $row['predicted']), 1),
                ], $modeled['backtest']['results']);
                $extraMetrics = [
                    'mean_absolute_error' => $modeled['backtest']['mean_absolute_error'] ?? null,
                    'root_mean_squared_error' => $modeled['backtest']['root_mean_squared_error'] ?? null,
                    'mean_absolute_percentage_error' => $modeled['backtest']['mean_absolute_percentage_error'] ?? null,
                    'percentage_months_tested' => $modeled['backtest']['percentage_months_tested'] ?? 0,
                ];
            } else {
                $fallback = 'The Python forecasting worker is unavailable. Showing the baseline forecast.';
            }
        }

        return [
            'engine' => $engine,
            'selected_model' => $model,
            'source_repository' => $engine === 'prophet'
                ? RepositoryForecastService::SOURCE_PROPHET
                : RepositoryForecastService::SOURCE_STATSMODELS,
            'source_revision' => $engine === 'prophet'
                ? RepositoryForecastService::REVISION_PROPHET
                : RepositoryForecastService::REVISION_STATSMODELS,
            'fallback_reason' => $fallback,
            'model_comparison' => $comparison,
            'diagnostics' => $diagnostics,
            'available' => $available,
            'history_months' => $historyMonths,
            'confidence' => $available ? $confidence : null,
            'reason' => !$enabled
                ? 'Choose a period of 3 months or longer to view predictions.'
                : ($available ? null : 'Predictions need at least 3 complete months since the first recorded request.'),
            'months' => $projections,
            'total_requests' => $available ? round(array_sum(array_column($projections, 'requests')), 1) : null,
            'backtest' => [
                'months_tested' => count($checks),
                'mean_absolute_error' => $checks ? round(array_sum(array_column($checks, 'absolute_error')) / count($checks), 1) : null,
                'results' => $checks,
                ...$extraMetrics,
            ],
            'notes' => 'The first prediction covers the month in progress. Model comparison tests each candidate using earlier months only, then fits the selected model on all complete history. Confidence reflects history length and request volume, not a measured probability. Holidays and school schedules can change demand.',
        ];
    }

    // ------------------------------------------------------------------
    // Data gathering
    // ------------------------------------------------------------------

    /**
     * One row per demand event: borrow requests and reservations since $from.
     */
    private function demandEvents(CarbonInterface $from): Collection
    {
        $borrows = BorrowTransaction::query()
            ->where(function ($q) use ($from) {
                $q->where('request_date', '>=', $from)
                  ->orWhere(fn ($q2) => $q2->whereNull('request_date')->where('created_at', '>=', $from));
            })
            ->get(['book_id', 'status', 'request_date', 'created_at'])
            ->map(function ($t) {
                $date = Carbon::parse($t->request_date ?? $t->created_at);

                return [
                    'book_id' => (int) $t->book_id,
                    'month' => $date->format('Y-m'),
                    'date' => $date->toDateString(),
                    'type' => 'borrow',
                    'fulfilled' => in_array($t->status, self::FULFILLED_STATUSES, true),
                    'rejected' => $t->status === 'rejected',
                ];
            });

        $reservations = Reservation::query()
            ->where('reservation_date', '>=', $from)
            ->get(['book_id', 'status', 'reservation_date'])
            ->map(function ($r) {
                $date = Carbon::parse($r->reservation_date);

                return [
                    'book_id' => (int) $r->book_id,
                    'month' => $date->format('Y-m'),
                    'date' => $date->toDateString(),
                    'type' => 'reservation',
                    'fulfilled' => false,
                    'rejected' => false,
                ];
            });

        return $borrows->concat($reservations)->values();
    }

    /**
     * Usable copies per book. Uses the book_copies table once it exists
     * (accession numbers); until then each book row counts as one copy.
     */
    private function copiesFor(Collection $books): array
    {
        if (Schema::hasTable('book_copies')) {
            $counts = DB::table('book_copies')
                ->whereNotIn('status', ['lost', 'damaged', 'withdrawn'])
                ->select('book_id', DB::raw('COUNT(*) as total'))
                ->groupBy('book_id')
                ->pluck('total', 'book_id');

            return $books->mapWithKeys(fn ($b) => [$b->id => (int) ($counts[$b->id] ?? 0)])->all();
        }

        return $books->mapWithKeys(fn ($b) => [
            $b->id => in_array($b->status, ['lost', 'damaged'], true) ? 0 : 1,
        ])->all();
    }

    private function openWaitlist(): array
    {
        return Reservation::query()
            ->whereIn('status', self::OPEN_RESERVATION_STATUSES)
            ->select('book_id', DB::raw('COUNT(*) as total'))
            ->groupBy('book_id')
            ->pluck('total', 'book_id')
            ->map(fn ($v) => (int) $v)
            ->all();
    }

    private function currentlyOut(): array
    {
        return BorrowTransaction::query()
            ->whereIn('status', ['borrowed', 'return_requested', 'overdue'])
            ->select('book_id', DB::raw('COUNT(*) as total'))
            ->groupBy('book_id')
            ->pluck('total', 'book_id')
            ->map(fn ($v) => (int) $v)
            ->all();
    }

    // ------------------------------------------------------------------
    // Aggregation
    // ------------------------------------------------------------------

    private function monthKeys(CarbonInterface $start, int $months): array
    {
        $keys = [];
        for ($i = 0; $i < $months; $i++) {
            $keys[] = $start->copy()->addMonths($i)->format('Y-m');
        }

        return $keys;
    }

    private function monthKeysForWindow(CarbonInterface $start, CarbonInterface $currentMonthStart): array
    {
        $keys = [];
        $month = $start->copy()->startOfMonth();

        while ($month->lt($currentMonthStart)) {
            $keys[] = $month->format('Y-m');
            $month->addMonth();
        }

        return $keys;
    }

    private function perBookSeries(Collection $events, array $monthKeys, string $currentKey): Collection
    {
        $empty = array_fill_keys($monthKeys, 0);

        return $events->groupBy('book_id')->map(function (Collection $rows) use ($empty, $currentKey) {
            $demand = $empty;
            $loans = $empty;
            $rejected = 0;
            $currentDemand = 0;
            $currentLoans = 0;
            $currentRejected = 0;

            foreach ($rows as $row) {
                if ($row['month'] === $currentKey) {
                    $currentDemand++;
                    $currentLoans += $row['fulfilled'] ? 1 : 0;
                    $currentRejected += $row['rejected'] ? 1 : 0;
                    continue;
                }
                if (!array_key_exists($row['month'], $demand)) {
                    continue;
                }
                $demand[$row['month']]++;
                if ($row['fulfilled']) {
                    $loans[$row['month']]++;
                }
                if ($row['rejected']) {
                    $rejected++;
                }
            }

            return compact('demand', 'loans', 'rejected', 'currentDemand', 'currentLoans', 'currentRejected');
        });
    }

    private function activityBuckets(Collection $events, CarbonInterface $windowStart, CarbonInterface $now, int $days): array
    {
        $start = $windowStart->copy()->startOfDay();
        $buckets = [];

        for ($offset = 0; $offset < $days; $offset += 7) {
            $bucketStart = $start->copy()->addDays($offset);
            $bucketEnd = $bucketStart->copy()->addDays(min(6, $days - $offset - 1));
            if ($bucketEnd->gt($now)) {
                $bucketEnd = $now->copy();
            }

            $buckets[] = [
                'label' => $bucketStart->format('M j') . ' - ' . $bucketEnd->format('M j'),
                'demand' => 0,
                'loans' => 0,
            ];
        }

        foreach ($events as $event) {
            $eventDate = Carbon::parse($event['date'])->startOfDay();
            if ($eventDate->lt($start) || $eventDate->gt($now)) {
                continue;
            }

            $offset = (int) $start->diffInDays($eventDate);
            $index = intdiv($offset, 7);
            if (!isset($buckets[$index])) {
                continue;
            }

            $buckets[$index]['demand']++;
            $buckets[$index]['loans'] += $event['fulfilled'] ? 1 : 0;
        }

        return $buckets;
    }

    private function monthlyTotals(Collection $events, array $monthKeys, string $currentKey): array
    {
        $complete = [];
        foreach ($monthKeys as $key) {
            $complete[$key] = ['month' => $key, 'label' => Carbon::createFromFormat('Y-m-d', $key . '-01')->format('M Y'), 'demand' => 0, 'loans' => 0, 'reservations' => 0, 'rejected' => 0];
        }
        $current = ['month' => $currentKey, 'label' => Carbon::createFromFormat('Y-m-d', $currentKey . '-01')->format('M Y') . ' (to date)', 'demand' => 0, 'loans' => 0, 'reservations' => 0, 'rejected' => 0];

        foreach ($events as $e) {
            if ($e['month'] === $currentKey) {
                $bucket = &$current;
            } elseif (isset($complete[$e['month']])) {
                $bucket = &$complete[$e['month']];
            } else {
                continue;
            }
            $bucket['demand']++;
            $bucket['loans'] += $e['fulfilled'] ? 1 : 0;
            $bucket['reservations'] += $e['type'] === 'reservation' ? 1 : 0;
            $bucket['rejected'] += $e['rejected'] ? 1 : 0;
            unset($bucket);
        }

        return ['complete' => array_values($complete), 'current' => $current];
    }

    private function bookStats(Book $book, array $series, int $copies, int $waitlist, int $out, array $capacity, string $forecastLabel, bool $includeCurrent = false): array
    {
        $demandSeries = array_values($series['demand']);
        $forecast = $this->forecast($demandSeries);
        $activeMonths = count(array_filter($demandSeries));
        $windowDemand = array_sum($demandSeries) + ($includeCurrent ? $series['currentDemand'] : 0);
        $windowLoans = array_sum($series['loans']) + ($includeCurrent ? $series['currentLoans'] : 0);
        $turnedAway = $series['rejected'] + ($includeCurrent ? $series['currentRejected'] : 0);
        $peak = $demandSeries ? max($demandSeries) : 0;

        $usable = max(0.1, $capacity['planned_loans_per_copy']);
        $basis = max($forecast['value'], $series['currentDemand']);
        $required = $basis > 0 ? (int) ceil($basis / $usable) : 0;
        $additional = max(0, $required - $copies);

        $reasons = [];
        if ($forecast['value'] > 0) {
            $reasons[] = sprintf(
                'Forecast of %s requests for %s; one copy handles about %s loans a month at %d-day loans.',
                $this->num($forecast['value']),
                $forecastLabel,
                $this->num($usable),
                $capacity['loan_days']
            );
        }
        if ($peak > $copies * $capacity['max_loans_per_copy'] && $copies > 0) {
            $reasons[] = sprintf('Peak month had %d requests, above what %d %s can serve.', $peak, $copies, $copies === 1 ? 'copy' : 'copies');
        }
        if ($waitlist >= max(2, $copies)) {
            $reasons[] = sprintf('%d students are waiting on reservations right now.', $waitlist);
            if ($additional === 0) {
                $additional = 1;
            }
        }
        if ($turnedAway > 0) {
            $reasons[] = sprintf('%d borrow %s turned away in the period.', $turnedAway, $turnedAway === 1 ? 'request was' : 'requests were');
        }
        if ($forecast['trend'] === 'rising') {
            $reasons[] = 'Demand is rising month over month.';
        }
        if ($copies === 0) {
            $reasons[] = 'No usable copy on record (lost, damaged, or not yet accessioned).';
            $additional = max($additional, $windowDemand > 0 ? 1 : 0);
        }

        $priority = match (true) {
            $additional >= 2, $additional >= 1 && $forecast['trend'] === 'rising', $copies === 0 && $windowDemand > 0 => 'high',
            $additional === 1 => 'medium',
            default => 'low',
        };

        return [
            'book_id' => $book->id,
            'title' => $book->title,
            'author' => $book->author,
            'genre' => $book->genre,
            'subject' => $book->subject,
            'location' => trim(($book->library_section ?? '') . ' ' . ($book->shelf ?? '')),
            'monthly_demand' => $series['demand'],
            'monthly_loans' => $series['loans'],
            'current_month_demand' => $series['currentDemand'],
            'window_demand' => $windowDemand,
            'window_loans' => $windowLoans,
            'turned_away' => $turnedAway,
            'open_waitlist' => $waitlist,
            'currently_out' => $out,
            'current_copies' => $copies,
            'forecast_next_month' => $forecast['value'],
            'trend' => $forecast['trend'],
            'recommended_copies' => max($required, $copies),
            'additional_copies' => $additional,
            'priority' => $additional > 0 ? $priority : 'none',
            'confidence' => match (true) {
                $activeMonths >= 4 => 'high',
                $activeMonths >= 2 => 'medium',
                default => 'low',
            },
            'reasons' => $reasons,
        ];
    }

    private function categoryTrends(Collection $events, Collection $books, string $field, array $monthKeys, bool $compare = true): array
    {
        $last = end($monthKeys);
        $prev = $monthKeys[count($monthKeys) - 2] ?? null;
        $totals = [];

        foreach ($events as $e) {
            if (!in_array($e['month'], $monthKeys, true)) {
                continue;
            }
            $name = $books->get($e['book_id'])?->{$field} ?: 'Uncategorized';
            $totals[$name] ??= ['name' => $name, 'demand' => 0, 'last_month' => 0, 'previous_month' => 0];
            $totals[$name]['demand']++;
            if ($e['month'] === $last) {
                $totals[$name]['last_month']++;
            } elseif ($e['month'] === $prev) {
                $totals[$name]['previous_month']++;
            }
        }

        $grand = max(1, array_sum(array_column($totals, 'demand')));

        return collect($totals)
            ->map(function ($row) use ($grand, $compare) {
                $row['share'] = round($row['demand'] / $grand * 100, 1);
                $row['change'] = $compare && $row['previous_month'] > 0
                    ? round(($row['last_month'] - $row['previous_month']) / $row['previous_month'] * 100)
                    : null;

                return $row;
            })
            ->sortByDesc('demand')
            ->values()
            ->take(10)
            ->all();
    }

    private function underusedBooks(Collection $books, Collection $perBook, CarbonInterface $now): array
    {
        $cutoff = $now->copy()->subDays(30);

        return $books
            ->filter(fn ($b) => !$perBook->has($b->id) || array_sum($perBook[$b->id]['demand']) + $perBook[$b->id]['currentDemand'] === 0)
            ->filter(fn ($b) => !$b->created_at || $b->created_at->lt($cutoff))
            ->filter(fn ($b) => !in_array($b->status, ['lost', 'damaged'], true))
            ->take(10)
            ->map(fn ($b) => [
                'book_id' => $b->id,
                'title' => $b->title,
                'author' => $b->author,
                'genre' => $b->genre,
                'location' => trim(($b->library_section ?? '') . ' ' . ($b->shelf ?? '')),
            ])
            ->values()
            ->all();
    }

    private function methodNotes(array $capacity, bool $forecastAvailable = true): array
    {
        $engine = config('library.forecasting.engine', 'prophet');
        $engineDesc = $engine === 'prophet'
            ? 'Facebook Prophet (additive model with monthly seasonality, automatic trend detection)'
            : 'statsmodels ARIMA (AR/MA model comparison with rolling validation)';

        return [
            'demand' => $forecastAvailable
                ? 'Borrow requests plus reservations, counted by the month they were made.'
                : 'Borrow requests plus reservations in the selected date range, grouped by week.',
            'forecast' => $forecastAvailable
                ? "Model comparison: {$engineDesc} vs. last-month baseline. Best model selected by rolling validation MAE."
                : 'A forecast requires at least three full months of data.',
            'capacity' => sprintf(
                'One copy serves up to %s loans a month (%d-day loan + %d-day turnaround). Planning uses %d%% of that, or %s loans.',
                $this->num($capacity['max_loans_per_copy']),
                $capacity['loan_days'],
                $capacity['turnaround_days'],
                (int) round($capacity['target_utilization'] * 100),
                $this->num($capacity['planned_loans_per_copy'])
            ),
            'copies_source' => Schema::hasTable('book_copies') ? 'book_copies' : 'one_copy_per_book_record',
            'capacity_values' => $capacity,
            'forecast_engine' => $engine,
        ];
    }

    private function priorityRank(string $priority): int
    {
        return ['high' => 3, 'medium' => 2, 'low' => 1][$priority] ?? 0;
    }

    private function num(float $value): string
    {
        return rtrim(rtrim(number_format($value, 1), '0'), '.');
    }
}
