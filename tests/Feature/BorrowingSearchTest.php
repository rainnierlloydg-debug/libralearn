<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BorrowingSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_matches_student_name_school_id_title_and_isbn_with_status_filter(): void
    {
        $student = User::factory()->create(['name' => 'Mara Reyes', 'school_id' => '2026-0421', 'role' => 'student', 'status' => 'active']);
        $other = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $book = Book::create(['title' => 'The Lunar Atlas', 'author' => 'A. Writer', 'isbn' => '9781234567890', 'source' => 'gsa']);
        $unrelated = Book::create(['title' => 'Botany', 'author' => 'B. Writer', 'source' => 'gsa']);
        $match = BorrowTransaction::create(['student_id' => $student->id, 'book_id' => $book->id, 'status' => 'pending', 'request_date' => now()]);
        BorrowTransaction::create(['student_id' => $other->id, 'book_id' => $unrelated->id, 'status' => 'pending', 'request_date' => now()]);
        BorrowTransaction::create(['student_id' => $student->id, 'book_id' => $book->id, 'status' => 'returned', 'request_date' => now()]);
        Sanctum::actingAs(User::factory()->create(['role' => 'librarian', 'status' => 'active']));

        foreach (['Mara Reyes', '2026-0421', 'Lunar Atlas', '9781234567890'] as $term) {
            $this->getJson('/api/borrow?' . http_build_query(['search' => $term, 'status' => 'pending']))
                ->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.id', $match->id);
        }

        $this->getJson('/api/borrow?search=NoSuchTitle')->assertOk()->assertJsonPath('data.total', 0);
    }

    public function test_search_keeps_student_records_scoped_to_the_signed_in_user(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $other = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $book = Book::create(['title' => 'Shared Search Title', 'author' => 'Author', 'source' => 'gsa']);
        $own = BorrowTransaction::create(['student_id' => $student->id, 'book_id' => $book->id, 'status' => 'pending', 'request_date' => now()]);
        BorrowTransaction::create(['student_id' => $other->id, 'book_id' => $book->id, 'status' => 'pending', 'request_date' => now()]);
        Sanctum::actingAs($student);

        $this->getJson('/api/borrow?search=Shared')->assertOk()
            ->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.id', $own->id);
    }

    public function test_return_lookup_includes_all_active_loan_states_and_excludes_closed_loans(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $book = Book::create(['title' => 'Return Lookup', 'author' => 'Author', 'isbn' => '9781234567890', 'source' => 'gsa']);
        $expected = [];
        foreach (['borrowed', 'return_requested', 'overdue', 'returned', 'pending'] as $status) {
            $transaction = BorrowTransaction::create(['student_id' => $student->id, 'book_id' => $book->id, 'status' => $status, 'request_date' => now()]);
            if (in_array($status, ['borrowed', 'return_requested', 'overdue'])) {
                $expected[] = $transaction->id;
            }
        }
        Sanctum::actingAs(User::factory()->create(['role' => 'librarian', 'status' => 'active']));

        $response = $this->getJson('/api/borrow?' . http_build_query([
            'search' => '9781234567890', 'status' => 'borrowed,return_requested,overdue',
        ]))->assertOk()->assertJsonPath('data.total', 3);

        $this->assertEqualsCanonicalizing($expected, array_column($response->json('data.data'), 'id'));
    }
}
