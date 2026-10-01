<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\RecommendationFeedback;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Exercises the raw/aggregate queries and searches that differ between
 * MySQL, SQLite and PostgreSQL. Run against Postgres with:
 *   php artisan test --configuration=phpunit.pgsql.xml
 */
class DatabasePortabilityTest extends TestCase
{
    use RefreshDatabase;

    private User $librarian;
    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->librarian = User::factory()->create(['role' => 'librarian', 'school_id' => 'LIB-' . Str::random(5), 'status' => 'active']);
        $this->student = User::factory()->create(['role' => 'student', 'name' => 'Maria Clara', 'school_id' => 'GSA-' . Str::random(5), 'email' => 'Maria.Clara@Example.com', 'status' => 'active']);

        $book = Book::create(['title' => 'Noli Me Tangere', 'author' => 'Jose Rizal', 'genre' => 'Historical Fiction', 'subject' => 'Filipino', 'source' => 'gsa']);
        Book::create(['title' => 'El Filibusterismo', 'author' => 'Jose Rizal', 'genre' => 'Historical Fiction', 'subject' => 'Filipino', 'source' => 'gsa']);

        foreach ([1, 2, 2] as $daysAgo) {
            BorrowTransaction::create([
                'student_id' => $this->student->id, 'book_id' => $book->id, 'status' => 'returned',
                'request_date' => now()->subDays($daysAgo), 'borrow_date' => now()->subDays($daysAgo),
            ]);
        }
        RecommendationFeedback::create(['student_id' => $this->student->id, 'book_id' => $book->id, 'feedback' => 'like']);
    }

    public function test_book_search_is_case_insensitive(): void
    {
        Sanctum::actingAs($this->student);

        $this->assertSame(['Noli Me Tangere'], Book::search('noli')->pluck('title')->all());
        $this->assertSame(2, Book::search('RIZAL')->count());

        $this->getJson('/api/books?author=jose rizal')->assertOk()->assertJsonPath('data.total', 2);
    }

    public function test_student_search_is_case_insensitive(): void
    {
        Sanctum::actingAs($this->librarian);

        $this->getJson('/api/users?search=maria')->assertOk()->assertJsonPath('data.total', 1);
        $this->getJson('/api/users?search=EXAMPLE.COM')->assertOk()->assertJsonPath('data.total', 1);
    }

    public function test_dashboard_and_report_aggregates_run(): void
    {
        Sanctum::actingAs($this->librarian);

        $this->getJson('/api/dashboard/librarian')->assertOk();
        $this->getJson('/api/reports/books')->assertOk();
        $this->getJson('/api/reports/borrowing')->assertOk();
        $this->getJson('/api/reports/student-activity')->assertOk();
        $this->getJson('/api/reports/ai-cataloging')->assertOk();
        $this->getJson('/api/ai/insights?months=6')->assertOk();
    }
}
