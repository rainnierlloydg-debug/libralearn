<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\User;
use App\Services\Ai\LibraryDemandService;
use App\Services\Ai\RepositoryForecastService;
use Illuminate\Support\Facades\Process;
use Tests\TestCase;

class RepositoryForecastTest extends TestCase
{
    private function workerResponse(): array
    {
        return [
            'engine' => 'statsmodels', 'selected_model' => 'ARIMA(1,1,0)',
            'forecasts' => [18, 20, 22],
            'backtest' => [
                'mean_absolute_error' => 1, 'root_mean_squared_error' => 1,
                'mean_absolute_percentage_error' => 8.3, 'percentage_months_tested' => 3,
                'results' => [
                    ['index' => 5, 'predicted' => 11, 'actual' => 12],
                    ['index' => 6, 'predicted' => 13, 'actual' => 14],
                    ['index' => 7, 'predicted' => 15, 'actual' => 16],
                ],
            ],
            'model_comparison' => [['model' => 'ARIMA(1,1,0)', 'mean_absolute_error' => 1]],
        ];
    }

    public function test_python_bridge_sends_only_counts_and_maps_selected_model_into_insights(): void
    {
        config(['library.forecasting.enabled' => true]);
        Process::fake(fn () => Process::result(output: json_encode($this->workerResponse())));
        $student = User::factory()->create();
        $book = Book::create(['title' => 'Popular title', 'author' => 'Writer', 'source' => 'gsa']);
        foreach ([2, 4, 6, 8, 10, 12, 14, 16] as $index => $count) {
            for ($i = 0; $i < $count; $i++) {
                BorrowTransaction::create([
                    'student_id' => $student->id, 'book_id' => $book->id, 'status' => 'returned',
                    'request_date' => now()->startOfMonth()->subMonths(8 - $index)->addDays(2),
                ]);
            }
        }
        $data = app(LibraryDemandService::class)->analyze(12);
        $this->assertSame('statsmodels', $data['predictions']['engine']);
        $this->assertSame('ARIMA(1,1,0)', $data['predictions']['selected_model']);
        $this->assertEquals(18, $data['summary']['next_month_forecast']);
        $this->assertEquals(60, $data['predictions']['total_requests']);
        $this->assertSame(now()->startOfMonth()->subMonths(3)->format('Y-m'), $data['predictions']['backtest']['results'][0]['month']);
        Process::assertRan(fn ($process) => json_decode($process->input, true) === [
            'series' => [2, 4, 6, 8, 10, 12, 14, 16], 'horizon' => 3,
        ]);
    }

    public function test_invalid_worker_output_and_process_failures_return_safe_fallback(): void
    {
        config(['library.forecasting.enabled' => true]);
        Process::fake(fn () => Process::result(output: 'not json'));
        $this->assertNull(app(RepositoryForecastService::class)->predict(array_fill(0, 8, 10)));
    }

    public function test_unavailable_runtime_returns_fallback_without_throwing(): void
    {
        config(['library.forecasting.enabled' => true]);
        Process::fake(fn () => Process::result(exitCode: 1));
        $this->assertNull(app(RepositoryForecastService::class)->predict(array_fill(0, 8, 10)));
    }

    public function test_short_history_does_not_start_python(): void
    {
        config(['library.forecasting.enabled' => true]);
        Process::fake();
        $this->assertNull(app(RepositoryForecastService::class)->predict([1, 2, 3]));
        Process::assertNothingRan();
    }
}
