<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\SavedBook;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SavedBooksAndExportsTest extends TestCase
{
    public function test_saved_books_are_idempotent_and_private_to_each_user(): void
    {
        $student = User::factory()->create();
        $other = User::factory()->create();
        $book = Book::create(['title' => 'Saved title', 'author' => 'Writer', 'source' => 'gsa']);
        Sanctum::actingAs($student);
        $this->postJson('/api/saved-books', ['book_id' => $book->id])->assertCreated();
        $this->postJson('/api/saved-books', ['book_id' => $book->id])->assertOk();
        $this->assertSame(1, SavedBook::count());
        $this->getJson('/api/books/' . $book->id)->assertJsonPath('data.is_saved', true);
        $this->getJson('/api/saved-books')->assertJsonPath('data.total', 1);
        Sanctum::actingAs($other);
        $this->getJson('/api/saved-books')->assertJsonPath('data.total', 0);
        $this->deleteJson('/api/saved-books/' . $book->id)->assertOk();
        $this->assertSame(1, SavedBook::count());
        Sanctum::actingAs($student);
        $this->deleteJson('/api/saved-books/' . $book->id)->assertOk();
        $this->getJson('/api/books/' . $book->id)->assertJsonPath('data.is_saved', false);
    }

    public function test_exports_require_librarian_access_and_escape_spreadsheet_formulas(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/reports/books/export')->assertForbidden();
        Sanctum::actingAs(User::factory()->create(['role' => 'librarian']));
        Book::create(['title' => '=HYPERLINK("example")', 'author' => 'Writer', 'source' => 'gsa']);
        foreach (['books', 'borrowing', 'student-activity', 'ai-cataloging'] as $type) {
            $response = $this->get('/api/reports/' . $type . '/export');
            $response->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
            $csv = $response->streamedContent();
            $this->assertNotEmpty($csv);
            if ($type === 'books') {
                $this->assertStringContainsString("'=HYPERLINK", $csv);
            }
        }
    }

    public function test_library_information_and_fines_are_saved_and_validated(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'librarian']));
        $this->putJson('/api/library-settings', ['library_name' => 'GSA Library', 'library_email' => 'library@example.com'])
            ->assertOk()->assertJsonPath('data.library_name', 'GSA Library');
        $this->getJson('/api/library-settings')->assertJsonPath('data.library_email', 'library@example.com');
        $this->putJson('/api/library-settings', ['fine_per_day' => 2.5])->assertOk()->assertJsonPath('data.fine_per_day', 2.5);
        $this->putJson('/api/library-settings', ['library_email' => 'invalid'])->assertUnprocessable();
        $this->putJson('/api/library-settings', [])->assertUnprocessable();
    }

    public function test_multiple_loan_statuses_and_report_end_dates_include_expected_records(): void
    {
        $student = User::factory()->create();
        $book = Book::create(['title' => 'Loan title', 'author' => 'Writer', 'source' => 'gsa']);
        foreach (['pending', 'borrowed', 'returned'] as $status) {
            BorrowTransaction::create([
                'student_id' => $student->id, 'book_id' => $book->id, 'status' => $status,
                'borrow_date' => now()->startOfDay()->addHours(12),
            ]);
        }
        Sanctum::actingAs($student);
        $this->getJson('/api/borrow?status=pending,borrowed')->assertOk()->assertJsonPath('data.total', 2);
        Sanctum::actingAs(User::factory()->create(['role' => 'librarian']));
        $date = now()->toDateString();
        $this->getJson("/api/reports/borrowing?date_from={$date}&date_to={$date}")
            ->assertOk()->assertJsonPath('data.summary.total_transactions', 3);
        $this->getJson('/api/reports/borrowing?date_from=invalid')->assertUnprocessable();
    }
}
