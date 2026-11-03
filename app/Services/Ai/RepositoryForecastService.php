<?php

namespace App\Services\Ai;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class RepositoryForecastService
{
    public const SOURCE_STATSMODELS = 'https://github.com/Shreyansh055/Time-Series-Forecasting_055';
    public const REVISION_STATSMODELS = '875079dd666ad174bbfb12f13e78dd71610e33fd';
    public const SOURCE_PROPHET = 'https://github.com/Tanu-N-Prabhu/Python';
    public const REVISION_PROPHET = 'master';

    private const WORKERS = [
        'statsmodels' => 'forecasting/worker.py',
        'prophet' => 'forecasting/worker_prophet.py',
    ];

    public function predict(array $series, string $engine = 'prophet'): ?array
    {
        if (!config('library.forecasting.enabled', true) || count($series) < 6) {
            return null;
        }

        $workerPath = self::WORKERS[$engine] ?? self::WORKERS['prophet'];
        $expectedEngine = $engine === 'statsmodels' ? 'statsmodels' : 'prophet';

        try {
            $result = Process::path(base_path())->timeout(60)
                ->input(json_encode(['series' => array_values($series), 'horizon' => 3], JSON_THROW_ON_ERROR))
                ->run([config('library.forecasting.python'), base_path($workerPath)]);

            if (!$result->successful()) {
                Log::warning('Forecast worker unavailable.', [
                    'engine' => $engine,
                    'exit_code' => $result->exitCode(),
                    'output' => $result->output(),
                ]);
                return null;
            }

            $data = json_decode($result->output(), true, flags: JSON_THROW_ON_ERROR);

            if (!is_array($data) || ($data['engine'] ?? null) !== $expectedEngine
                || !is_string($data['selected_model'] ?? null)
                || !is_array($data['forecasts'] ?? null) || count($data['forecasts']) !== 3
                || !is_array($data['backtest']['results'] ?? null)
                || !is_array($data['model_comparison'] ?? null)) {
                Log::warning('Forecast worker returned invalid format.', ['engine' => $engine, 'data' => $data]);
                return null;
            }

            foreach ($data['forecasts'] as $value) {
                if (!is_numeric($value) || !is_finite((float) $value) || $value < 0) {
                    return null;
                }
            }

            foreach ($data['backtest']['results'] as $row) {
                $index = $row['index'] ?? null;
                if (!is_int($index) || $index < 0 || $index >= count($series)
                    || !is_numeric($row['predicted'] ?? null)
                    || !is_finite((float) $row['predicted']) || $row['predicted'] < 0
                    || ($row['actual'] ?? null) != $series[$index]) {
                    return null;
                }
            }

            return $data;
        } catch (\Throwable $exception) {
            Log::warning('Forecast worker failed.', [
                'engine' => $engine,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);
            return null;
        }
    }

    public function predictWithFallback(array $series): ?array
    {
        // Try Prophet first (better for seasonal data, easier to use)
        $result = $this->predict($series, 'prophet');
        if ($result) {
            return $result;
        }

        // Fall back to statsmodels ARIMA
        return $this->predict($series, 'statsmodels');
    }
}
