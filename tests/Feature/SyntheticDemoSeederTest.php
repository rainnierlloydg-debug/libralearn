<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookCopy;
use App\Models\BorrowTransaction;
use App\Models\Reservation;
use App\Models\User;
use Database\Seeders\SyntheticDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SyntheticDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_is_repeatable_and_preserves_existing_data_and_workflow_changes(): void
    {
        Storage::fake('public');
        config(['filesystems.covers_disk' => 'public']);
        $existing = Book::create(['title' => 'Existing library title', 'author' => 'Existing author', 'source' => 'gsa']);
        $this->seed(SyntheticDemoSeeder::class);

        $this->assertSame(25, User::count());
        $this->assertSame(18, Book::where('isbn', 'like', 'SYN-BOOK-%')->count());
        $this->assertSame(54, BookCopy::where('book_id', '!=', $existing->id)->count());
        $this->assertSame(852, BorrowTransaction::where('status', 'returned')->count());
        $this->assertSame(12, Reservation::count());
        $this->assertTrue(Hash::check('Demo12345!', User::where('email', 'student01@demo.example')->first()->password));
        $this->assertSame(6, Book::where('isbn', 'like', 'SYN-BOOK-%')->doesntHave('borrowTransactions')->count());
        $this->assertSame(0, Book::where('title', 'like', '%Demo%')->orWhere('author', 'like', '%Demo%')->count());
        $this->assertSame(0, User::where('name', 'like', '%Demo%')->count());
        foreach (Book::where('isbn', 'like', 'SYN-BOOK-%')->get() as $book) {
            Storage::disk('public')->assertExists($book->cover_image);
            $this->assertStringStartsWith('/storage/book-covers/synthetic/', $book->cover_url);
        }

        foreach (BorrowTransaction::whereIn('status', ['borrowed', 'overdue', 'return_requested'])->get() as $loan) {
            $this->assertSame('borrowed', $loan->bookCopy->status);
            $this->assertSame($loan->book_id, $loan->bookCopy->book_id);
            if ($loan->status === 'overdue') {
                $this->assertTrue($loan->due_date->isPast());
            }
        }
        foreach (Reservation::where('status', 'ready_for_pickup')->get() as $reservation) {
            $this->assertSame('reserved', $reservation->bookCopy->status);
            $this->assertTrue($reservation->pickup_deadline->isFuture());
        }

        $loan = BorrowTransaction::where('status', 'borrowed')->first();
        $loan->update(['status' => 'returned', 'return_date' => now()]);
        $loan->bookCopy->update(['status' => 'available']);
        $counts = [Book::count(), BookCopy::count(), User::count(), BorrowTransaction::count(), Reservation::count()];
        $this->seed(SyntheticDemoSeeder::class);
        $this->assertSame($counts, [Book::count(), BookCopy::count(), User::count(), BorrowTransaction::count(), Reservation::count()]);
        $this->assertSame('returned', $loan->fresh()->status);
        $this->assertSame('available', $loan->bookCopy->fresh()->status);
        $this->assertSame('Existing library title', $existing->fresh()->title);
    }
}
