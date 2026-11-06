<?php

namespace Tests\Feature;

use App\Jobs\BuildLibraryInsights;
use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\Reservation;
use App\Models\User;
use App\Services\Ai\LibraryDemandService;
use App\Services\Ai\LibraryInsightsNarrator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NavigationPerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_does_not_repeat_large_profile_photos_in_transaction_lists(): void
    {
        $student = User::factory()->create(['profile_image' => 'data:image/png;base64,'.str_repeat('A', 300000)]);
        $book = Book::create(['title' => 'Library book', 'author' => 'Writer', 'source' => 'gsa']);
        foreach (['pending', 'overdue'] as $status) {
            BorrowTransaction::create(['student_id' => $student->id, 'book_id' => $book->id, 'status' => $status]);
        }
        Reservation::create(['student_id' => $student->id, 'book_id' => $book->id, 'status' => 'pending', 'reservation_date' => now()]);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $response = $this->getJson('/api/dashboard/librarian')->assertOk();
        foreach (['pending_borrows', 'overdue_transactions', 'pending_reservations'] as $section) {
            $response->assertJsonPath("data.{$section}.0.student.name", $student->name);
            $response->assertJsonMissingPath("data.{$section}.0.student.profile_image");
        }
        $this->assertLessThan(30000, strlen($response->getContent()));
    }

    public function test_insights_serve_a_baseline_without_starting_python_or_external_ai_in_http_requests(): void
    {
        config(['queue.default' => 'database', 'library.forecasting.enabled' => true, 'services.gemini.api_key' => 'test-key']);
        Queue::fake();
        Process::fake();
        Http::preventStrayRequests();
        $student = User::factory()->create();
        $book = Book::create(['title' => 'Popular book', 'author' => 'Writer', 'source' => 'gsa']);
        foreach (range(1, 6) as $month) {
            BorrowTransaction::create([
                'student_id' => $student->id, 'book_id' => $book->id, 'status' => 'returned',
                'request_date' => now()->startOfMonth()->subMonths($month)->addDay(),
            ]);
        }
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/ai/insights?months=6')->assertOk()
            ->assertJsonPath('data.processing', true)
            ->assertJsonPath('data.predictions.engine', 'baseline');
        $this->getJson('/api/ai/insights/briefing?months=6')->assertOk()->assertJsonPath('data.source', 'rules');
        $this->getJson('/api/ai/insights?months=6')->assertOk();
        Queue::assertPushed(BuildLibraryInsights::class, 1);
        Process::assertNothingRan();
        Http::assertNothingSent();

        // Model fitting happens in the queued job, then replaces the baseline.
        config(['services.gemini.api_key' => null]);
        Process::fake(fn () => Process::result(output: json_encode([
            'engine' => 'prophet', 'selected_model' => 'Prophet', 'forecasts' => [2, 3, 4],
            'backtest' => ['results' => []], 'model_comparison' => [],
        ])));
        $job = Queue::pushed(BuildLibraryInsights::class)->first();
        $job->handle(app(LibraryDemandService::class), app(LibraryInsightsNarrator::class));
        $this->getJson('/api/ai/insights?months=6')->assertOk()
            ->assertJsonPath('data.processing', false)
            ->assertJsonPath('data.predictions.engine', 'prophet')
            ->assertJsonPath('data.predictions.months.0.requests', 2);
    }

    public function test_synchronous_queue_keeps_insights_fast_without_dispatching_inline_work(): void
    {
        config(['queue.default' => 'sync']);
        Queue::fake();
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->getJson('/api/ai/insights')->assertOk()->assertJsonPath('data.processing', false);
        Queue::assertNothingPushed();
    }
}
