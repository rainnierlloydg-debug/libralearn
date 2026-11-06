<?php

namespace Tests\Feature;

use App\Models\Book;
use Database\Seeders\BookCoverSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BookCoverSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_bundled_covers_fill_matching_empty_records_and_preserve_custom_covers(): void
    {
        config(['filesystems.covers_disk' => 'public']);
        Storage::fake('public');
        $book = Book::create(['title' => 'The Lantern of Isla Verde', 'author' => 'Elena Marquez', 'source' => 'gsa']);
        $custom = Book::create([
            'title' => 'Mystery at the Old Library', 'author' => 'Gabriel Villanueva',
            'source' => 'gsa', 'cover_image' => 'https://example.com/my-cover.jpg',
        ]);
        $otherEdition = Book::create(['title' => 'The Lantern of Isla Verde', 'author' => 'Different author', 'source' => 'gsa']);

        $this->seed(BookCoverSeeder::class);
        $this->assertSame('book-covers/synthetic/book-01.jpg', $book->fresh()->cover_image);
        Storage::disk('public')->assertExists($book->fresh()->cover_image);
        $this->assertSame('https://example.com/my-cover.jpg', $custom->fresh()->cover_image);
        $this->assertNull($otherEdition->fresh()->cover_image);

        $this->seed(BookCoverSeeder::class);
        $this->assertSame(3, Book::count());
        $this->assertSame('book-covers/synthetic/book-01.jpg', $book->fresh()->cover_image);
    }
}
