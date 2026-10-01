<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookCopy;
use App\Models\BorrowTransaction;
use App\Models\Reservation;
use App\Models\User;
use App\Services\Ai\LibraryDemandService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookCopiesTest extends TestCase
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

    private function book(array $attrs = []): Book
    {
        return Book::create(array_merge(['title' => 'Noli Me Tangere', 'author' => 'Jose Rizal', 'source' => 'gsa'], $attrs));
    }

    public function test_new_library_book_gets_one_copy_with_accession_number(): void
    {
        $book = $this->book();

        $this->assertSame(1, $book->copies()->count());
        $this->assertMatchesRegularExpression('/^GSA-\d{6}$/', $book->copies()->first()->accession_no);
    }

    public function test_online_book_gets_no_copy(): void
    {
        $book = $this->book(['source' => 'online']);

        $this->assertSame(0, $book->copies()->count());
    }

    public function test_migration_backfills_one_copy_per_existing_book(): void
    {
        $migration = require database_path('migrations/2026_10_02_000001_create_book_copies_table.php');
        $migration->down();

        $student = $this->user('student');
        $now = now();
        $available = DB::table('books')->insertGetId(['title' => 'A', 'author' => 'X', 'status' => 'available', 'source' => 'gsa', 'created_at' => $now, 'updated_at' => $now]);
        $overdue = DB::table('books')->insertGetId(['title' => 'B', 'author' => 'Y', 'status' => 'overdue', 'source' => 'gsa', 'created_at' => $now, 'updated_at' => $now]);
        DB::table('books')->insert(['title' => 'C', 'author' => 'Z', 'status' => 'available', 'source' => 'online', 'created_at' => $now, 'updated_at' => $now]);
        $loanId = DB::table('borrow_transactions')->insertGetId(['student_id' => $student->id, 'book_id' => $overdue, 'status' => 'overdue', 'created_at' => $now, 'updated_at' => $now]);

        $migration->up();

        $this->assertSame(2, DB::table('book_copies')->count());
        $this->assertSame('GSA-000001', DB::table('book_copies')->where('book_id', $available)->value('accession_no'));
        $overdueCopy = DB::table('book_copies')->where('book_id', $overdue)->first();
        $this->assertSame('borrowed', $overdueCopy->status);
        $this->assertEquals($overdueCopy->id, DB::table('borrow_transactions')->where('id', $loanId)->value('book_copy_id'));
        $this->assertSame('borrowed', DB::table('books')->where('id', $overdue)->value('status'));
    }

    public function test_librarian_can_list_add_and_edit_copies(): void
    {
        Sanctum::actingAs($this->user('librarian'));
        $book = $this->book();

        $this->postJson("/api/books/{$book->id}/copies", ['accession_no' => 'GSA-CUSTOM-1', 'condition' => 'new'])
            ->assertCreated()
            ->assertJsonPath('data.accession_no', 'GSA-CUSTOM-1');

        $this->postJson("/api/books/{$book->id}/copies", ['accession_no' => 'GSA-CUSTOM-1'])
            ->assertStatus(422);

        $this->getJson("/api/books/{$book->id}/copies")
            ->assertOk()
            ->assertJsonCount(2, 'data.copies');

        $copy = BookCopy::where('accession_no', 'GSA-CUSTOM-1')->first();
        $this->putJson("/api/book-copies/{$copy->id}", ['status' => 'withdrawn', 'condition' => 'water damage'])
            ->assertOk()
            ->assertJsonPath('data.status', 'withdrawn');
    }

    public function test_students_cannot_manage_copies(): void
    {
        Sanctum::actingAs($this->user('student'));
        $book = $this->book();

        $this->getJson("/api/books/{$book->id}/copies")->assertForbidden();
        $this->postJson("/api/books/{$book->id}/copies", [])->assertForbidden();
    }

    public function test_cannot_hand_edit_status_of_borrowed_copy(): void
    {
        Sanctum::actingAs($this->user('librarian'));
        $copy = $this->book()->copies()->first();
        $copy->update(['status' => 'borrowed']);

        $this->putJson("/api/book-copies/{$copy->id}", ['status' => 'available'])->assertStatus(422);
    }

    public function test_book_form_cannot_override_status_of_book_with_copies(): void
    {
        Sanctum::actingAs($this->user('librarian'));
        $book = $this->book();

        $this->putJson("/api/books/{$book->id}", ['title' => 'Renamed', 'status' => 'overdue'])->assertOk();

        $this->assertSame('Renamed', $book->fresh()->title);
        $this->assertSame('available', $book->fresh()->status);
    }

    public function test_borrowed_copy_condition_can_be_edited_without_status(): void
    {
        Sanctum::actingAs($this->user('librarian'));
        $copy = $this->book()->copies()->first();
        $copy->update(['status' => 'borrowed']);

        $this->putJson("/api/book-copies/{$copy->id}", ['condition' => 'torn cover'])->assertOk();

        $this->assertSame('torn cover', $copy->fresh()->condition);
        $this->assertSame('borrowed', $copy->fresh()->status);
    }

    public function test_book_status_is_derived_from_copies(): void
    {
        $book = $this->book();
        $first = $book->copies()->first();
        $second = $book->copies()->create(['accession_no' => 'GSA-X2', 'status' => 'available']);

        $first->update(['status' => 'borrowed']);
        $this->assertSame('available', $book->fresh()->status);

        $second->update(['status' => 'reserved']);
        $this->assertSame('borrowed', $book->fresh()->status);

        $first->update(['status' => 'lost']);
        $second->update(['status' => 'withdrawn']);
        $this->assertSame('lost', $book->fresh()->status);
    }

    public function test_borrow_approve_and_return_move_the_copy(): void
    {
        $student = $this->user('student');
        $librarian = $this->user('librarian');
        $book = $this->book();
        $copy = $book->copies()->first();

        Sanctum::actingAs($student);
        $loanId = $this->postJson('/api/borrow', ['book_id' => $book->id])->assertCreated()->json('data.id');

        Sanctum::actingAs($librarian);
        $this->postJson("/api/borrow/{$loanId}/approve")->assertOk()->assertJsonPath('data.book_copy_id', $copy->id);
        $this->assertSame('borrowed', $copy->fresh()->status);
        $this->assertSame('borrowed', $book->fresh()->status);

        $this->postJson("/api/borrow/{$loanId}/mark-overdue")->assertOk();
        $this->assertSame('overdue', BorrowTransaction::find($loanId)->status);
        $this->assertSame('borrowed', $book->fresh()->status, 'overdue belongs on the loan');

        $this->postJson("/api/borrow/{$loanId}/confirm-return", ['condition' => 'damaged'])->assertOk();
        $this->assertSame('damaged', $copy->fresh()->status);
        $this->assertSame('damaged', $book->fresh()->status);
    }

    public function test_second_copy_keeps_book_borrowable(): void
    {
        $librarian = $this->user('librarian');
        $book = $this->book();
        $book->copies()->create(['accession_no' => 'GSA-X2', 'status' => 'available']);

        foreach ([$this->user('student'), $this->user('student')] as $student) {
            Sanctum::actingAs($student);
            $loanId = $this->postJson('/api/borrow', ['book_id' => $book->id])->assertCreated()->json('data.id');
            Sanctum::actingAs($librarian);
            $this->postJson("/api/borrow/{$loanId}/approve")->assertOk();
        }

        $this->assertSame(0, $book->copies()->where('status', 'available')->count());
        $this->assertSame('borrowed', $book->fresh()->status);

        Sanctum::actingAs($this->user('student'));
        $this->postJson('/api/borrow', ['book_id' => $book->id])->assertStatus(422);
    }

    public function test_reservation_holds_a_copy_and_cancel_releases_it(): void
    {
        $student = $this->user('student');
        $librarian = $this->user('librarian');
        $book = $this->book();
        $copy = $book->copies()->first();
        $copy->update(['status' => 'borrowed']);

        Sanctum::actingAs($student);
        $resId = $this->postJson('/api/reservations', ['book_id' => $book->id])->assertCreated()->json('data.id');

        Sanctum::actingAs($librarian);
        $this->postJson("/api/reservations/{$resId}/approve")->assertStatus(422);

        $copy->update(['status' => 'available']);
        $this->postJson("/api/reservations/{$resId}/approve")->assertOk();
        $this->assertSame('reserved', $copy->fresh()->status);
        $this->assertSame($copy->id, Reservation::find($resId)->book_copy_id);

        $this->postJson("/api/reservations/{$resId}/cancel")->assertOk();
        $this->assertSame('available', $copy->fresh()->status);
        $this->assertSame('available', $book->fresh()->status);
    }

    public function test_completed_reservation_creates_loan_on_held_copy(): void
    {
        $student = $this->user('student');
        $book = $this->book();
        $copy = $book->copies()->first();
        $copy->update(['status' => 'reserved']);
        $reservation = Reservation::create([
            'student_id' => $student->id, 'book_id' => $book->id, 'book_copy_id' => $copy->id,
            'reservation_date' => now(), 'status' => 'ready_for_pickup', 'pickup_deadline' => now()->addDays(3),
        ]);

        Sanctum::actingAs($this->user('librarian'));
        $this->postJson("/api/reservations/{$reservation->id}/complete")->assertOk();

        $this->assertSame('borrowed', $copy->fresh()->status);
        $this->assertSame($copy->id, BorrowTransaction::where('student_id', $student->id)->value('book_copy_id'));
    }

    public function test_insights_forecast_counts_copies_from_book_copies(): void
    {
        $student = $this->user('student');
        $book = $this->book();
        $book->copies()->create(['accession_no' => 'GSA-X2', 'status' => 'available']);
        $book->copies()->create(['accession_no' => 'GSA-X3', 'status' => 'lost']);

        foreach ([3, 2, 1] as $back) {
            for ($i = 0; $i < 20; $i++) {
                BorrowTransaction::create([
                    'student_id' => $student->id,
                    'book_id' => $book->id,
                    'request_date' => now()->startOfMonth()->subMonths($back)->addDays($i),
                    'status' => 'returned',
                ]);
            }
        }

        $rec = collect(app(LibraryDemandService::class)->analyze(6)['copy_recommendations'])->firstWhere('book_id', $book->id);

        $this->assertNotNull($rec);
        $this->assertSame(2, $rec['current_copies'], 'lost copies are not counted');
    }
}
