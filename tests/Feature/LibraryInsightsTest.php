<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\User;
use App\Services\Ai\LibraryDemandService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LibraryInsightsTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        return User::factory()->create([
            'role' => $role,
            'school_id' => strtoupper($role) . '-' . Str::random(6),
            'status' => 'active',
        ]);
    }

    public function test_forecast_detects_rising_demand(): void
    {
        $forecast = app(LibraryDemandService::class)->forecast([2, 3, 4, 6, 8, 10]);

        $this->assertSame('rising', $forecast['trend']);
        $this->assertGreaterThan(8, $forecast['value']);
    }

    public function test_forecast_handles_empty_series(): void
    {
        $forecast = app(LibraryDemandService::class)->forecast([0, 0, 0]);

        $this->assertSame(0.0, $forecast['value']);
        $this->assertSame('none', $forecast['trend']);
    }

    public function test_high_demand_book_gets_copy_recommendation(): void
    {
        $student = $this->user('student');
        $book = Book::create(['title' => 'Popular Book', 'author' => 'A. Writer', 'status' => 'available', 'source' => 'gsa']);

        // 12 requests in each of the last 3 full months, far above one copy's capacity.
        foreach ([3, 2, 1] as $back) {
            for ($i = 0; $i < 12; $i++) {
                BorrowTransaction::create([
                    'student_id' => $student->id,
                    'book_id' => $book->id,
                    'request_date' => now()->startOfMonth()->subMonths($back)->addDays($i),
                    'status' => 'returned',
                ]);
            }
        }

        $result = app(LibraryDemandService::class)->analyze(6);
        $rec = collect($result['copy_recommendations'])->firstWhere('book_id', $book->id);

        $this->assertNotNull($rec);
        $this->assertSame(1, $rec['current_copies']);
        $this->assertGreaterThanOrEqual(1, $rec['additional_copies']);
        $this->assertNotEmpty($rec['reasons']);
    }

    public function test_students_cannot_open_insights(): void
    {
        Sanctum::actingAs($this->user('student'));

        $this->getJson('/api/ai/insights')->assertForbidden();
    }

    public function test_librarian_gets_insights_and_rule_based_briefing(): void
    {
        config(['services.gemini.api_key' => null]);
        Sanctum::actingAs($this->user('librarian'));

        $this->getJson('/api/ai/insights?months=6')
            ->assertOk()
            ->assertJsonStructure(['data' => ['summary', 'monthly', 'top_books', 'copy_recommendations', 'categories', 'underused', 'method']]);

        $this->getJson('/api/ai/insights/briefing')
            ->assertOk()
            ->assertJsonPath('data.source', 'rules');
    }

    public function test_librarian_can_select_week_and_month_insight_windows(): void
    {
        $student = $this->user('student');
        $book = Book::create(['title' => 'Recent Activity', 'author' => 'A. Writer', 'status' => 'available', 'source' => 'gsa']);

        foreach ([2, 10, 25] as $daysAgo) {
            BorrowTransaction::create([
                'student_id' => $student->id,
                'book_id' => $book->id,
                'request_date' => now()->subDays($daysAgo)->toDateString(),
                'status' => 'returned',
            ]);
        }

        Sanctum::actingAs($this->user('librarian'));

        foreach ([7 => 1, 14 => 2, 30 => 3] as $days => $expectedDemand) {
            $this->getJson("/api/ai/insights?days={$days}")
                ->assertOk()
                ->assertJsonPath('data.window.days', $days)
                ->assertJsonPath('data.window.forecast_available', false)
                ->assertJsonPath('data.summary.total_demand', $expectedDemand);
        }

        $this->getJson('/api/ai/insights?days=8')->assertUnprocessable();
        $this->getJson('/api/ai/insights?days=7&months=3')->assertUnprocessable();
    }

    private function demandHistory(array $counts): void
    {
        $student = $this->user('student');
        $book = Book::create(['title' => 'Forecast Book', 'author' => 'Writer', 'source' => 'gsa']);
        foreach ($counts as $index => $count) {
            for ($request = 0; $request < $count; $request++) {
                BorrowTransaction::create([
                    'student_id' => $student->id, 'book_id' => $book->id,
                    'request_date' => now()->startOfMonth()->subMonths(count($counts) - $index)->addDays(5),
                    'status' => 'returned',
                ]);
            }
        }
    }

    public function test_predictions_require_recorded_history_instead_of_zero_padded_months(): void
    {
        $this->demandHistory([8]);
        $outlook = app(LibraryDemandService::class)->analyze(6)['predictions'];
        $this->assertFalse($outlook['available']);
        $this->assertSame(1, $outlook['history_months']);
        $this->assertNull($outlook['confidence']);
        $this->assertNull($outlook['total_requests']);
        $this->assertSame([], $outlook['months']);
    }

    public function test_stable_demand_projects_three_months_without_an_ai_key(): void
    {
        $this->demandHistory([10, 10, 10]);
        Sanctum::actingAs($this->user('admin'));
        $response = $this->getJson('/api/ai/insights?months=6')->assertOk()
            ->assertJsonPath('data.predictions.available', true)
            ->assertJsonPath('data.predictions.history_months', 3)
            ->assertJsonPath('data.predictions.confidence', 'low')
            ->assertJsonPath('data.summary.next_month_forecast', 10)
            ->assertJsonPath('data.predictions.total_requests', 30)
            ->assertJsonPath('data.predictions.backtest.months_tested', 0);
        foreach ($response->json('data.predictions.months') as $index => $month) {
            $this->assertEquals(10, $month['requests']);
            $this->assertSame(now()->startOfMonth()->addMonths($index)->format('Y-m'), $month['month']);
        }
        Http::assertNothingSent();
    }

    public function test_backtest_uses_only_months_before_each_withheld_observation(): void
    {
        $series = [2, 4, 6, 8, 10, 12];
        $this->demandHistory($series);
        $service = app(LibraryDemandService::class);
        $outlook = $service->analyze(6)['predictions'];
        $this->assertSame('medium', $outlook['confidence']);
        $this->assertSame(3, $outlook['backtest']['months_tested']);
        foreach ($outlook['backtest']['results'] as $index => $result) {
            $this->assertEquals($service->forecast(array_slice($series, 0, $index + 3))['value'], $result['predicted']);
            $this->assertSame($series[$index + 3], $result['actual']);
        }
        $this->assertGreaterThan(0, $outlook['backtest']['mean_absolute_error']);
        foreach ($outlook['months'] as $month) {
            $this->assertGreaterThanOrEqual(0, $month['requests']);
        }
    }

    public function test_empty_and_short_windows_do_not_show_predictions(): void
    {
        $service = app(LibraryDemandService::class);
        $this->assertFalse($service->analyze(6)['predictions']['available']);
        $this->demandHistory([6, 6, 6]);
        $outlook = $service->analyze(6, null, 30)['predictions'];
        $this->assertFalse($outlook['available']);
        $this->assertSame([], $outlook['months']);
        $this->assertSame(0, $outlook['backtest']['months_tested']);
    }
}
