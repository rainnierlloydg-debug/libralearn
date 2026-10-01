<?php

namespace Database\Seeders;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Six months of sample borrowing activity so the AI Insights page has
 * data to analyze during demos and testing.
 *
 *   php artisan db:seed --class=DemoActivitySeeder
 *
 * Every row is tagged with notes = 'demo-activity'. Remove them with:
 *   BorrowTransaction::where('notes', 'demo-activity')->delete();
 *   Reservation::where('notes', 'demo-activity')->delete();
 *
 * Do not run this on the real GSA database used for evaluation.
 */
class DemoActivitySeeder extends Seeder
{
    public function run(): void
    {
        mt_srand(2026);

        $students = User::where('role', 'student')->pluck('id')->all();
        $librarianId = User::whereIn('role', ['librarian', 'admin'])->value('id');
        $books = Book::where('source', 'gsa')->orderBy('id')->get(['id', 'title']);

        if (!$students || $books->isEmpty()) {
            $this->command?->warn('Seed users and books first.');

            return;
        }

        // Treat the sample books as part of the collection for the whole period,
        // so titles nobody requested show up as underused.
        Book::where('source', 'gsa')
            ->where('created_at', '>', now()->subMonths(7))
            ->update(['created_at' => now()->subMonths(7)]);

        BorrowTransaction::where('notes', 'demo-activity')->delete();
        Reservation::where('notes', 'demo-activity')->delete();

        // Demand profile per book, oldest month first. Books past the list
        // get light random demand; the last third get none (underused).
        $profiles = [
            [2, 3, 4, 6, 8, 10],   // rising fast
            [5, 6, 5, 7, 6, 7],    // steady and high
            [8, 7, 5, 4, 3, 2],    // falling
            [1, 2, 2, 3, 4, 5],    // rising
            [3, 3, 4, 3, 4, 4],    // steady
            [0, 1, 0, 2, 1, 3],    // sparse
        ];

        $monthStarts = collect(range(6, 1))->map(fn ($back) => now()->startOfMonth()->subMonths($back));
        $underusedFrom = (int) floor($books->count() * 2 / 3);

        foreach ($books->values() as $index => $book) {
            if ($index >= $underusedFrom) {
                continue;
            }

            $profile = $profiles[$index] ?? array_map(fn () => mt_rand(0, 2), range(1, 6));

            foreach ($monthStarts as $m => $monthStart) {
                for ($i = 0; $i < $profile[$m]; $i++) {
                    $requested = $monthStart->copy()->addDays(mt_rand(0, 26))->setTime(mt_rand(7, 16), mt_rand(0, 59));
                    $studentId = $students[array_rand($students)];

                    // Roughly 1 in 6 requests are reservations, 1 in 10 rejected.
                    if (mt_rand(1, 6) === 1) {
                        Reservation::create([
                            'student_id' => $studentId,
                            'book_id' => $book->id,
                            'reservation_date' => $requested,
                            'status' => 'completed',
                            'approved_by' => $librarianId,
                            'approved_date' => $requested->copy()->addDay(),
                            'notes' => 'demo-activity',
                        ]);
                        continue;
                    }

                    if (mt_rand(1, 10) === 1) {
                        BorrowTransaction::create([
                            'student_id' => $studentId,
                            'book_id' => $book->id,
                            'request_date' => $requested,
                            'status' => 'rejected',
                            'notes' => 'demo-activity',
                        ]);
                        continue;
                    }

                    $borrowed = $requested->copy()->addHours(mt_rand(1, 20));
                    $due = $borrowed->copy()->addDays((int) config('library.loan_days', 3));
                    $returned = $due->copy()->subDays(mt_rand(-1, 2));

                    BorrowTransaction::create([
                        'student_id' => $studentId,
                        'book_id' => $book->id,
                        'request_date' => $requested,
                        'approval_date' => $borrowed,
                        'borrow_date' => $borrowed,
                        'due_date' => $due,
                        'return_request_date' => $returned,
                        'return_date' => $returned,
                        'status' => 'returned',
                        'approved_by' => $librarianId,
                        'return_confirmed_by' => $librarianId,
                        'notes' => 'demo-activity',
                    ]);
                }
            }
        }

        // An open waitlist on the most popular title.
        $popular = $books->first();
        foreach (array_slice($students, 0, 3) as $studentId) {
            Reservation::create([
                'student_id' => $studentId,
                'book_id' => $popular->id,
                'reservation_date' => now()->subDays(mt_rand(0, 4)),
                'status' => 'pending',
                'notes' => 'demo-activity',
            ]);
        }

        $this->command?->info('Demo borrowing activity created for ' . $underusedFrom . ' books.');
    }
}
