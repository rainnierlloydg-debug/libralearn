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

    public function analyze(int $months = 6, ?CarbonInterface $now = null): array
    {
        $months = max(3, min($months, 24));
        $now = $now ? Carbon::instance($now) : now();

        $currentMonthStart = $now->copy()->startOfMonth();
        $windowStart = $currentMonthStart->copy()->subMonths($months);
        $monthKeys = $this->monthKeys($windowStart, $months);
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

        $forecastLabel = $currentMonthStart->format('F');

        $bookStats = $perBook->map(function (array $series, int $bookId) use ($books, $copies, $openWaitlist, $currentlyOut, $capacity, $forecastLabel) {
            $book = $books->get($bookId);
            if (!$book) {
                return null;
            }

            return $this->bookStats($book, $series, $copies[$bookId] ?? 1, $openWaitlist[$bookId] ?? 0, $currentlyOut[$bookId] ?? 0, $capacity, $forecastLabel);
        })->filter()->values();

        $monthlyTotals = $this->monthlyTotals($events, $monthKeys, $currentKey);
        $totalForecast = $this->forecast(array_column($monthlyTotals['complete'], 'demand'));

        return [
            'generated_at' => $now->toIso8601String(),
            'window' => [
                'months' => $months,
                'from' => $windowStart->toDateString(),
                'to' => $currentMonthStart->copy()->subDay()->toDateString(),
                'current_month_to_date' => $currentKey,
                // The forecast covers the first month after the complete-month
                // window, which is the month in progress.
                'forecast_month' => $currentKey,
                'forecast_label' => $currentMonthStart->format('F Y'),
            ],
            'method' => $this->methodNotes($capacity),
            'summary' => [
                'total_demand' => array_sum(array_column($monthlyTotals['complete'], 'demand')),
                'total_loans' => array_sum(array_column($monthlyTotals['complete'], 'loans')),
                'turned_away' => array_sum(array_column($monthlyTotals['complete'], 'rejected')),
                'books_in_demand' => $bookStats->where('window_demand', '>', 0)->count(),
                'books_needing_copies' => $bookStats->where('additional_copies', '>', 0)->count(),
                'next_month_forecast' => $totalForecast['value'],
                'trend' => $totalForecast['trend'],
            ],
            'monthly' => $monthlyTotals,
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
                'genre' => $this->categoryTrends($events, $books, 'genre', $monthKeys),
                'subject' => $this->categoryTrends($events, $books, 'subject', $monthKeys),
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
            ->map(fn ($t) => [
                'book_id' => (int) $t->book_id,
                'month' => Carbon::parse($t->request_date ?? $t->created_at)->format('Y-m'),
                'type' => 'borrow',
                'fulfilled' => in_array($t->status, self::FULFILLED_STATUSES, true),
                'rejected' => $t->status === 'rejected',
            ]);

        $reservations = Reservation::query()
            ->where('reservation_date', '>=', $from)
            ->get(['book_id', 'status', 'reservation_date'])
            ->map(fn ($r) => [
                'book_id' => (int) $r->book_id,
                'month' => Carbon::parse($r->reservation_date)->format('Y-m'),
                'type' => 'reservation',
                'fulfilled' => false,
                'rejected' => false,
            ]);

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

    private function perBookSeries(Collection $events, array $monthKeys, string $currentKey): Collection
    {
        $empty = array_fill_keys($monthKeys, 0);

        return $events->groupBy('book_id')->map(function (Collection $rows) use ($empty, $currentKey) {
            $demand = $empty;
            $loans = $empty;
            $rejected = 0;
            $currentDemand = 0;

            foreach ($rows as $row) {
                if ($row['month'] === $currentKey) {
                    $currentDemand++;
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

            return compact('demand', 'loans', 'rejected', 'currentDemand');
        });
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

    private function bookStats(Book $book, array $series, int $copies, int $waitlist, int $out, array $capacity, string $forecastLabel): array
    {
        $demandSeries = array_values($series['demand']);
        $forecast = $this->forecast($demandSeries);
        $activeMonths = count(array_filter($demandSeries));
        $windowDemand = array_sum($demandSeries);
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
        if ($series['rejected'] > 0) {
            $reasons[] = sprintf('%d borrow %s turned away in the period.', $series['rejected'], $series['rejected'] === 1 ? 'request was' : 'requests were');
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
            'window_loans' => array_sum($series['loans']),
            'turned_away' => $series['rejected'],
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

    private function categoryTrends(Collection $events, Collection $books, string $field, array $monthKeys): array
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
            ->map(function ($row) use ($grand) {
                $row['share'] = round($row['demand'] / $grand * 100, 1);
                $row['change'] = $row['previous_month'] > 0
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
            ->filter(fn ($b) => !$perBook->has($b->id) || array_sum($perBook[$b->id]['demand']) === 0)
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

    private function methodNotes(array $capacity): array
    {
        return [
            'demand' => 'Borrow requests plus reservations, counted by the month they were made.',
            'forecast' => 'Average of a 3-month weighted moving average (weights 1, 2, 3) and a linear trend line.',
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
