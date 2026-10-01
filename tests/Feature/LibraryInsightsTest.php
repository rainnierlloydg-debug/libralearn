<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\User;
use App\Services\Ai\LibraryDemandService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
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
        config(['services.openai.api_key' => null]);
        Sanctum::actingAs($this->user('librarian'));

        $this->getJson('/api/ai/insights?months=6')
            ->assertOk()
            ->assertJsonStructure(['data' => ['summary', 'monthly', 'top_books', 'copy_recommendations', 'categories', 'underused', 'method']]);

        $this->getJson('/api/ai/insights/briefing')
            ->assertOk()
            ->assertJsonPath('data.source', 'rules');
    }
}
