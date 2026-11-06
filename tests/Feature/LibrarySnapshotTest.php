<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\User;
use App\Services\Deployment\LibrarySnapshot;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LibrarySnapshotTest extends TestCase
{
    use RefreshDatabase;

    public function test_encrypted_snapshot_preserves_accounts_relations_uploads_and_omits_sessions_and_tokens(): void
    {
        config(['filesystems.covers_disk' => 'public']);
        Storage::fake('public');
        Storage::fake('snapshot-private');
        $archive = Storage::disk('snapshot-private')->path('library.llsnapshot');
        $keyFile = $archive.'.key';
        $student = User::factory()->create(['password' => 'A-strong-password']);
        $student->createToken('must-not-transfer');
        $book = Book::create(['title' => 'Original title', 'author' => 'Writer', 'source' => 'gsa', 'cover_image' => 'book-covers/cover.jpg']);
        $loan = BorrowTransaction::create(['student_id' => $student->id, 'book_id' => $book->id, 'book_copy_id' => $book->copies()->first()->id, 'status' => 'returned']);
        Storage::disk('public')->put('book-covers/cover.jpg', 'cover-bytes');

        $snapshot = app(LibrarySnapshot::class);
        $summary = $snapshot->export($archive, $keyFile);
        $this->assertSame(1, $summary['tables']['users']);
        $this->assertSame(1, $summary['files']);
        $this->assertStringNotContainsString('Original title', file_get_contents($archive));
        $this->assertArrayNotHasKey('personal_access_tokens', $summary['tables']);
        $this->assertArrayNotHasKey('sessions', $summary['tables']);

        // Empty the isolated test database, then restore without model events.
        DB::table('personal_access_tokens')->delete();
        foreach (array_reverse(LibrarySnapshot::TABLES) as $table) {
            DB::table($table)->delete();
        }
        Storage::disk('public')->delete('book-covers/cover.jpg');
        $snapshot->import($archive, $keyFile, true);
        $this->assertSame(0, User::count());
        $this->assertSame($summary, $snapshot->import($archive, $keyFile));
        $this->assertTrue(Hash::check('A-strong-password', User::findOrFail($student->id)->password));
        $this->assertSame($student->id, BorrowTransaction::findOrFail($loan->id)->student_id);
        $this->assertSame(1, Book::findOrFail($book->id)->copies()->count());
        $this->assertSame('cover-bytes', Storage::disk('public')->get('book-covers/cover.jpg'));

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('empty application tables');
        $snapshot->import($archive, $keyFile);
    }
}
