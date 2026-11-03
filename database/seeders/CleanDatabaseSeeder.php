<?php

namespace Database\Seeders;

use App\Models\AiCatalogJob;
use App\Models\Book;
use App\Models\BookCategory;
use App\Models\BorrowTransaction;
use App\Models\Interest;
use App\Models\LibraryLocation;
use App\Models\Notification;
use App\Models\OnlineBookSearch;
use App\Models\RecommendationFeedback;
use App\Models\Reservation;
use App\Models\SavedBook;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CleanDatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->command?->info('Cleaning all seeded/fake data...');

        // 1. Delete demo activity (borrow transactions & reservations with notes='demo-activity')
        $deletedBorrow = BorrowTransaction::where('notes', 'demo-activity')->delete();
        $deletedReservations = Reservation::where('notes', 'demo-activity')->delete();
        $this->command?->info("Deleted {$deletedBorrow} demo borrow transactions and {$deletedReservations} demo reservations.");

        // 2. Delete all other activity data (real-looking but fake)
        BorrowTransaction::where('notes', '!=', 'demo-activity')->delete();
        Reservation::where('notes', '!=', 'demo-activity')->delete();
        $this->command?->info('Deleted all other borrow transactions and reservations.');

        // 3. Delete AI catalog jobs
        AiCatalogJob::truncate();
        $this->command?->info('Deleted AI catalog jobs.');

        // 4. Delete online book searches
        OnlineBookSearch::truncate();
        $this->command?->info('Deleted online book searches.');

        // 5. Delete notifications
        Notification::truncate();
        $this->command?->info('Deleted notifications.');

        // 6. Delete saved books
        SavedBook::truncate();
        $this->command?->info('Deleted saved books.');

        // 7. Delete recommendation feedback
        RecommendationFeedback::truncate();
        $this->command?->info('Deleted recommendation feedback.');

        // 8. Delete books (source='gsa' are seeded, keep source='online' if any)
        $deletedBooks = Book::where('source', 'gsa')->delete();
        $this->command?->info("Deleted {$deletedBooks} seeded books (source=gsa).");

        // 9. Delete book-category relationships (pivot table)
        DB::table('book_categories')->truncate();
        $this->command?->info('Deleted book-category relationships.');

        // 10. Delete interests (genres/subjects) - use delete instead of truncate due to FK
        $deletedInterests = Interest::query()->delete();
        $this->command?->info("Deleted {$deletedInterests} interests (genres/subjects).");

        // 11. Delete library locations (seeded)
        LibraryLocation::query()->delete();
        $this->command?->info('Deleted library locations.');

        // 12. Delete students but KEEP admin/librarian users
        $deletedStudents = User::where('role', 'student')->delete();
        $this->command?->info("Deleted {$deletedStudents} student users.");

        // 13. Clear cache table
        DB::table('cache')->truncate();
        DB::table('cache_locks')->truncate();
        $this->command?->info('Cleared cache tables.');

        // 14. Clear sessions
        DB::table('sessions')->truncate();
        $this->command?->info('Cleared sessions.');

        // 15. Clear jobs tables
        DB::table('jobs')->truncate();
        DB::table('job_batches')->truncate();
        DB::table('failed_jobs')->truncate();
        $this->command?->info('Cleared job tables.');

        $this->command?->info('✅ Database cleaned! Ready for real data.');
        $this->command?->info('Remaining users (librarians/admins):');
        User::whereIn('role', ['admin', 'librarian'])->get(['name', 'email', 'role'])->each(function ($u) {
            $this->command?->line("  - {$u->name} ({$u->email}) [{$u->role}]");
        });
    }
}