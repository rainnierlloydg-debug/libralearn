<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CoverStorageTest extends TestCase
{
    use RefreshDatabase;

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private function uploadCover(): \Illuminate\Testing\TestResponse
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'librarian', 'school_id' => 'LIB-' . Str::random(5), 'status' => 'active']));
        $file = UploadedFile::fake()->createWithContent('cover.png', base64_decode(self::PNG));

        return $this->post('/api/books/upload-cover', ['image' => $file], ['Accept' => 'application/json'])->assertOk();
    }

    public function test_covers_go_to_the_configured_s3_disk(): void
    {
        config([
            'filesystems.covers_disk' => 's3',
            'filesystems.disks.s3.url' => 'https://proj.supabase.co/storage/v1/object/public/covers',
        ]);
        Storage::fake('s3', ['url' => 'https://proj.supabase.co/storage/v1/object/public/covers']);
        Storage::fake('public');

        $response = $this->uploadCover();
        $path = $response->json('path');

        Storage::disk('s3')->assertExists($path);
        Storage::disk('public')->assertMissing($path);
        $this->assertSame("https://proj.supabase.co/storage/v1/object/public/covers/{$path}", $response->json('url'));

        $book = Book::create(['title' => 'T', 'author' => 'A', 'source' => 'gsa', 'cover_image' => $path]);
        $this->assertSame($response->json('url'), $book->cover_url);
    }

    public function test_public_disk_keeps_relative_storage_urls(): void
    {
        config(['filesystems.covers_disk' => 'public']);
        Storage::fake('public');

        $path = $this->uploadCover()->json('path');

        Storage::disk('public')->assertExists($path);
        $this->assertSame("/storage/{$path}", Book::coverUrlFor($path));
    }

    public function test_external_cover_urls_pass_through(): void
    {
        $book = Book::create(['title' => 'T', 'author' => 'A', 'source' => 'gsa', 'cover_image' => 'http://books.google.com/cover.jpg']);

        $this->assertSame('http://books.google.com/cover.jpg', $book->toArray()['cover_url']);
        $this->assertNull(Book::create(['title' => 'U', 'author' => 'A', 'source' => 'gsa'])->cover_url);
    }
}
