<?php

namespace App\Services\Ai;

use App\Services\Ai\GeminiClient;
use Illuminate\Support\Facades\Log;

/**
 * Turns the numbers from LibraryDemandService into a short briefing for
 * the librarian. The model only rewrites figures it receives; it never
 * computes or invents them. Without an API key, a rule-based briefing
 * is returned so the page still works.
 */
class LibraryInsightsNarrator
{
    public function narrate(array $analysis): array
    {
        $facts = $this->facts($analysis);
        $apiKey = config('services.gemini.api_key');

        if ($apiKey) {
            $ai = $this->askModel($apiKey, $facts);
            if ($ai) {
                return $ai + ['source' => 'ai'];
            }
        }

        return $this->ruleBased($analysis) + ['source' => 'rules'];
    }

    /** Small, number-only payload sent to the model. */
    private function facts(array $a): array
    {
        return [
            'school' => config('library.school_name'),
            'period' => $a['window'],
            'summary' => $a['summary'],
            'monthly_demand' => array_map(fn ($m) => [$m['label'] => $m['demand']], $a['monthly']['complete']),
            'top_books' => array_map(fn ($b) => [
                'title' => $b['title'],
                'loans' => $b['window_loans'],
                'trend' => $b['trend'],
            ], array_slice($a['top_books'], 0, 5)),
            'copy_recommendations' => array_map(fn ($b) => [
                'title' => $b['title'],
                'current_copies' => $b['current_copies'],
                'add' => $b['additional_copies'],
                'priority' => $b['priority'],
                'forecast' => $b['forecast_next_month'],
                'waitlist' => $b['open_waitlist'],
            ], array_slice($a['copy_recommendations'], 0, 5)),
            'top_genres' => array_slice($a['categories']['genre'], 0, 4),
            'top_subjects' => array_slice($a['categories']['subject'], 0, 4),
            'underused_count' => count($a['underused']),
        ];
    }

    private function askModel(string $apiKey, array $facts): ?array
    {
        $system = implode("\n", [
            'You are the analytics assistant for a school library system called LibraLearn.',
            'Write a short briefing for the librarian from the JSON facts you receive.',
            'Use only numbers and titles present in the facts. Never invent figures, titles, budgets, or causes.',
            'If data is thin (few months or low counts), say the forecast is low-confidence.',
            'Reply with JSON only: {"headline": string (max 20 words), "highlights": [3 to 5 short strings], "actions": [2 to 4 short, concrete steps]}.',
            'Plain English, active voice, no markdown.',
        ]);

        try {
            $response = app(GeminiClient::class)->generate([
                    'system_instruction' => [
                        'parts' => [['text' => $system]]
                    ],
                    'contents' => [
                        ['role' => 'user', 'parts' => [['text' => json_encode($facts, JSON_UNESCAPED_UNICODE)]]]
                    ],
                    'generationConfig' => [
                        'temperature' => 0.2,
                        'maxOutputTokens' => 500,
                        'responseMimeType' => 'application/json',
                    ],
                ]);

            if (!$response->successful()) {
                Log::warning('Insights narration failed.', ['status' => $response->status()]);

                return null;
            }

            $text = app(GeminiClient::class)->text($response);
            $parsed = json_decode($text, true);
            if (!is_array($parsed) || empty($parsed['headline'])) {
                return null;
            }

            return [
                'headline' => (string) $parsed['headline'],
                'highlights' => array_values(array_filter(array_map('strval', (array) ($parsed['highlights'] ?? [])))),
                'actions' => array_values(array_filter(array_map('strval', (array) ($parsed['actions'] ?? [])))),
            ];
        } catch (\Throwable $e) {
            Log::warning('Insights narration error.', ['message' => app(GeminiClient::class)->redact($e->getMessage())]);

            return null;
        }
    }

    private function ruleBased(array $a): array
    {
        $s = $a['summary'];
        $highlights = [];
        $actions = [];

        if ($s['total_demand'] === 0) {
            $forecastAvailable = $a['window']['forecast_available'] ?? true;

            return [
                'headline' => 'No borrowing activity recorded in this period yet.',
                'highlights' => [$forecastAvailable
                    ? 'Forecasts need at least three full months of borrow or reservation records.'
                    : 'No requests or reservations were recorded in the selected period.'],
                'actions' => [$forecastAvailable
                    ? 'Keep recording borrow requests and reservations, then check this page again after three full months.'
                    : 'Choose a longer period or keep recording borrow requests and reservations.'],
            ];
        }

        $period = $a['window']['days']
            ? 'the last ' . $a['window']['label']
            : 'the last ' . $a['window']['months'] . ' full months';
        $highlights[] = sprintf(
            '%d requests and %d completed loans over %s.',
            $s['total_demand'],
            $s['total_loans'],
            $period
        );
        if ($a['window']['forecast_available'] ?? true) {
            $highlights[] = sprintf('Demand trend: %s. Forecast for %s: about %s requests.', $s['trend'], $a['window']['forecast_label'], $s['next_month_forecast']);
        } else {
            $highlights[] = 'A forecast needs at least three full months of data.';
        }

        if ($top = $a['top_books'][0] ?? null) {
            $highlights[] = sprintf('Most borrowed: %s with %d loans.', $top['title'], $top['window_loans']);
        }
        if ($genre = $a['categories']['genre'][0] ?? null) {
            $highlights[] = sprintf('Top genre: %s, %s%% of all demand.', $genre['name'], $genre['share']);
        }
        if ($s['turned_away'] > 0) {
            $highlights[] = sprintf('%d borrow requests were turned away.', $s['turned_away']);
        }

        foreach (array_slice($a['copy_recommendations'], 0, 3) as $rec) {
            $actions[] = sprintf(
                'Add %d %s of %s (%s priority).',
                $rec['additional_copies'],
                $rec['additional_copies'] === 1 ? 'copy' : 'copies',
                $rec['title'],
                $rec['priority']
            );
        }
        if (count($a['underused']) > 0) {
            $actions[] = sprintf('Promote or review %d books with no requests in this period.', count($a['underused']));
        }
        if (!$actions) {
            $actions[] = 'Current copies cover the forecast. No purchase needed this month.';
        }

        $headline = $s['books_needing_copies'] > 0
            ? sprintf('%d %s need more copies based on recent demand.', $s['books_needing_copies'], $s['books_needing_copies'] === 1 ? 'title' : 'titles')
            : 'Current copies cover the forecast demand.';

        return compact('headline', 'highlights', 'actions');
    }
}
