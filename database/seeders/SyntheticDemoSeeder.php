<?php

namespace Database\Seeders;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\Interest;
use App\Models\LibraryLocation;
use App\Models\Notification;
use App\Models\Reservation;
use App\Models\SavedBook;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

/** Additive, repeatable demo fixtures; never resets the existing collection. */
class SyntheticDemoSeeder extends Seeder
{
    public function run(): void
    {
        $local = app()->environment(['local', 'testing']);
        $demoPassword = config('library.demo.password');
        if (!$local && !config('library.demo.enabled')) {
            throw new \RuntimeException('Synthetic demo data requires LIBRARY_DEMO_DATA=true outside local/testing.');
        }
        if (!$local && (!is_string($demoPassword) || strlen($demoPassword) < 12)) {
            throw new \RuntimeException('Set LIBRARY_DEMO_PASSWORD to at least 12 characters for a hosted demo.');
        }

        DB::transaction(function () use ($demoPassword) {
            $this->call([InterestSeeder::class, LibraryLocationSeeder::class]);
            $password = Hash::make($demoPassword ?: 'Demo12345!');
            $admin = User::firstOrCreate(['email' => 'admin@demo.example'], [
                'name' => 'Library Administrator', 'school_id' => 'LIB-900',
                'role' => 'admin', 'password' => $password, 'status' => 'active',
            ]);
            if ($admin->name === 'Demo Library Administrator') {
                $admin->update(['name' => 'Library Administrator']);
            }
            if ($admin->school_id === 'DEMO-ADMIN') {
                $admin->update(['school_id' => 'LIB-900']);
            }

            $firstNames = ['Andrea', 'Miguel', 'Bianca', 'Paolo', 'Chloe', 'Rafael', 'Daniella', 'Luis'];
            $lastNames = ['Santos', 'Reyes', 'Cruz'];
            $students = collect();
            for ($i = 0; $i < 24; $i++) {
                $student = User::firstOrCreate(['email' => sprintf('student%02d@demo.example', $i + 1)], [
                    'name' => $firstNames[$i % 8].' '.$lastNames[intdiv($i, 8)],
                    'school_id' => sprintf('2026-S%03d', $i + 1), 'role' => 'student',
                    'password' => $password, 'status' => 'active',
                    'grade_level' => 'Grade '.(7 + $i % 6),
                    'section' => ['St. Joseph', 'St. Mary', 'St. Peter'][$i % 3],
                ]);
                if (str_ends_with($student->name, ' (Demo)')) {
                    $student->update(['name' => substr($student->name, 0, -7)]);
                }
                if ($student->school_id === sprintf('DEMO-%04d', $i + 1)) {
                    $student->update(['school_id' => sprintf('2026-S%03d', $i + 1)]);
                }
                $students->push($student);
            }

            $catalog = [
                ['The Lantern of Isla Verde', 'Fantasy', 'English', 'Fiction'],
                ['Mystery at the Old Library', 'Mystery', 'English', 'Fiction'],
                ['Robots of Tomorrow', 'Science Fiction', 'Technology', 'Science'],
                ['Exploring Our Solar System', 'Adventure', 'Science', 'Science'],
                ['Everyday Algebra Adventures', 'Fiction', 'Mathematics', 'Mathematics'],
                ['Mga Kuwento sa Ating Bayan', 'Short Stories', 'Filipino', 'Filipino'],
                ['Young Inventors Workshop', 'Adventure', 'Technology', 'Science'],
                ['Journey Through Philippine History', 'Historical Fiction', 'History', 'History'],
                ['The Secret Garden Club', 'Fiction', 'Science', 'Fiction'],
                ['Poems Under the Mango Tree', 'Poetry', 'Filipino', 'Filipino'],
                ['A Student Guide to Clear Writing', 'Fiction', 'English', 'English'],
                ['Discovering Geometry', 'Adventure', 'Mathematics', 'Mathematics'],
                ['Oceans and Coral Reefs', 'Adventure', 'Science', 'Science'],
                ['The Bamboo Bridge', 'Drama', 'Filipino', 'Filipino'],
                ['Atlas of Imaginary Islands', 'Fantasy', 'Reference', 'Reference'],
                ['Learning with Local Heroes', 'Biography', 'History', 'History'],
                ['Sketchbook of a Young Artist', 'Fiction', 'Arts', 'Reference'],
                ['The Little Book of Kindness', 'Short Stories', 'Values Education', 'Reference'],
            ];

            $authors = [
                'Elena Marquez', 'Gabriel Villanueva', 'Sofia Navarro', 'Adrian Castillo',
                'Isabel Mercado', 'Luningning Soriano', 'Marco Valdez', 'Teresa Aguilar',
                'Camila Bautista', 'Amihan de Leon', 'Patricia Rivera', 'Daniel Alonzo',
                'Nina Salcedo', 'Mateo Domingo', 'Lucia Serrano', 'Ramon Velasco',
                'Clara Mendoza', 'Angela Flores',
            ];

            foreach ($catalog as $index => [$title, $genre, $subject, $section]) {
                $location = LibraryLocation::where('section_name', $section)->orderBy('id')->first();
                Book::where('isbn', sprintf('DEMO-BOOK-%03d', $index + 1))
                    ->update(['isbn' => sprintf('SYN-BOOK-%03d', $index + 1)]);
                $book = Book::firstOrCreate(['isbn' => sprintf('SYN-BOOK-%03d', $index + 1)], [
                    'title' => $title, 'author' => $authors[$index],
                    'publisher' => 'Synthetic Learning Press', 'publication_date' => '2024-06-01',
                    'description' => $title.' explores '.$subject.' through engaging stories and activities for young readers.',
                    'language' => $subject === 'Filipino' ? 'Filipino' : 'English',
                    'genre' => $genre, 'subject' => $subject, 'library_section' => $section,
                    'shelf' => $location?->shelf_number, 'library_location_id' => $location?->id,
                    'source' => 'gsa', 'status' => 'available',
                ]);
                // Upgrade the original fixture labels while keeping custom edits.
                if ($book->title === $title.' (Demo)') {
                    $book->title = $title;
                }
                if (str_starts_with($book->author, 'Demo Author ')) {
                    $book->author = $authors[$index];
                }
                if ($book->description === 'Fictional book created for the LibraLearn demonstration.') {
                    $book->description = $title.' explores '.$subject.' through engaging stories and activities for young readers.';
                }
                $coverName = sprintf('book-%02d.jpg', $index + 1);
                $coverSource = database_path('assets/book-covers/'.$coverName);
                if (!$book->cover_image && is_file($coverSource)) {
                    $coverPath = 'book-covers/synthetic/'.$coverName;
                    $disk = Storage::disk(config('filesystems.covers_disk', 'public'));
                    if (!$disk->put($coverPath, file_get_contents($coverSource))) {
                        throw new \RuntimeException('Could not save book cover: '.$coverName);
                    }
                    $book->cover_image = $coverPath;
                }
                // Keep wasRecentlyCreated available to the copy setup below.
                if ($book->isDirty()) {
                    $book->saveQuietly();
                }
                if ($book->wasRecentlyCreated) {
                    $book->forceFill(['created_at' => now()->startOfMonth()->subMonths(7)])->saveQuietly();
                    // The automatic first copy plus two additional copies.
                    for ($c = 2; $c <= 3; $c++) {
                        $book->copies()->create([
                            'accession_no' => sprintf('GSA-S%03d-%d', $index + 1, $c),
                            'library_location_id' => $location?->id, 'status' => 'available', 'condition' => 'good',
                        ]);
                    }
                }
                for ($c = 2; $c <= 3; $c++) {
                    $book->copies()->where('accession_no', sprintf('DEMO-%03d-%d', $index + 1, $c))
                        ->update(['accession_no' => sprintf('GSA-S%03d-%d', $index + 1, $c)]);
                }
                $book->categories()->syncWithoutDetaching(Interest::whereIn('name', [$genre, $subject])->pluck('id'));
                foreach ([BorrowTransaction::class, Reservation::class] as $model) {
                    foreach ($model::where('book_id', $book->id)->where('notes', 'like', 'synthetic-demo:%')->get() as $activity) {
                        $activity->update(['notes' => 'library:'.substr($activity->notes, strlen('synthetic-demo:'))]);
                    }
                }
                $copies = $book->copies()->orderBy('id')->get();
                $student = $students[$index];
                $student->interests()->syncWithoutDetaching($book->categories()->pluck('interests.id'));
                SavedBook::firstOrCreate(['student_id' => $student->id, 'book_id' => $book->id]);

                // Six unused titles make the underused-collection view demonstrable.
                if ($index >= 12) {
                    continue;
                }

                $profile = match ($index % 3) {
                    0 => [6, 9, 12, 15, 18, 18],
                    1 => [12, 12, 12, 12, 12, 12],
                    default => [18, 15, 12, 9, 6, 3],
                };
                // Keep cloud startup bounded: fetch existing fixture keys once and
                // insert missing history in one batch instead of two queries per loan.
                $existingHistory = BorrowTransaction::where('book_id', $book->id)
                    ->where('notes', 'like', 'library:history:%')->pluck('notes')->flip();
                $history = [];
                foreach ($profile as $month => $count) {
                    $start = now()->startOfMonth()->subMonths(6 - $month);
                    for ($n = 0; $n < $count; $n++) {
                        $note = 'library:history:'.$index.':'.$start->format('Y-m').':'.$n;
                        if ($existingHistory->has($note)) {
                            continue;
                        }
                        $borrowed = $start->copy()->addDays(intdiv($n, 3) * 4)->setTime(9 + $n % 3, 0);
                        $due = $borrowed->copy()->addDays(3);
                        $history[] = [
                            'notes' => $note,
                            'student_id' => $students[($index + $n) % 24]->id,
                            'book_id' => $book->id, 'book_copy_id' => $copies[$n % 3]->id,
                            'request_date' => $borrowed->copy()->subHour(),
                            'approval_date' => $borrowed, 'borrow_date' => $borrowed, 'due_date' => $due,
                            'return_request_date' => $due, 'return_date' => $due, 'status' => 'returned',
                            'approved_by' => $admin->id, 'return_confirmed_by' => $admin->id,
                            'created_at' => $borrowed, 'updated_at' => $due,
                        ];
                    }
                }
                if ($history !== []) {
                    DB::table('borrow_transactions')->insert($history);
                }

                if ($index < 9) {
                    $status = ['borrowed', 'overdue', 'return_requested', 'borrowed', 'overdue', 'return_requested', 'pending', 'pending', 'rejected'][$index];
                    $issued = $index < 6;
                    $borrowed = now()->subDays($status === 'overdue' ? 8 : 1);
                    $loan = BorrowTransaction::firstOrCreate(['notes' => 'library:current:'.$index], [
                        'student_id' => $student->id, 'book_id' => $book->id,
                        'book_copy_id' => $issued ? $copies[0]->id : null,
                        'request_date' => $borrowed->copy()->subHour(), 'status' => $status,
                        'approval_date' => $issued ? $borrowed : null,
                        'borrow_date' => $issued ? $borrowed : null,
                        'due_date' => $issued ? $borrowed->copy()->addDays(max(1, (int) config('library.loan_days', 3))) : null,
                        'approved_by' => $issued ? $admin->id : null,
                        'return_request_date' => $status === 'return_requested' ? now()->subHour() : null,
                    ]);
                    if ($loan->wasRecentlyCreated && $issued) {
                        $copies[0]->update(['status' => 'borrowed']);
                    }
                }

                $ready = $index >= 9 && $index <= 10;
                $reservation = Reservation::firstOrCreate(['notes' => 'library:reservation:'.$index], [
                    'student_id' => $students[($index + 12) % 24]->id, 'book_id' => $book->id,
                    'book_copy_id' => $ready ? $copies[0]->id : null,
                    'reservation_date' => now()->subHours(12),
                    'status' => $ready ? 'ready_for_pickup' : 'pending',
                    'approved_date' => $ready ? now()->subHours(2) : null,
                    'approved_by' => $ready ? $admin->id : null,
                    'pickup_deadline' => $ready ? now()->addDays(2) : null,
                ]);
                if ($reservation->wasRecentlyCreated && $ready) {
                    $copies[0]->update(['status' => 'reserved']);
                }
                Notification::where('user_id', $student->id)
                    ->where('title', 'Synthetic demo: library activity')
                    ->update([
                        'title' => 'Library activity',
                        'message' => 'Your library account is ready. Explore borrowing, saved books and recommendations.',
                    ]);
                Notification::firstOrCreate([
                    'user_id' => $student->id, 'title' => 'Library activity',
                ], [
                    'message' => 'Your library account is ready. Explore borrowing, saved books and recommendations.',
                    'type' => 'system', 'read_status' => false,
                ]);
            }
        });

        $this->command?->info('Synthetic demo ready: 24 students, 1 admin, 18 titles, 54 copies, six months of history and current workflows.');
        $this->command?->info('Login: admin@demo.example or student01@demo.example. Hosted passwords come from LIBRARY_DEMO_PASSWORD; existing passwords are preserved.');
    }
}
