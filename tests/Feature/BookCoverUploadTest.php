<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookCoverUploadTest extends TestCase
{
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    public function test_uploaded_cover_can_be_saved_replaced_and_removed_from_a_book(): void
    {
        Storage::fake('public');
        config(['filesystems.covers_disk' => 'public']);
        Sanctum::actingAs(User::factory()->create(['role' => 'librarian', 'status' => 'active']));

        $upload = $this->post('/api/books/upload-cover', [
            'image' => UploadedFile::fake()->createWithContent('cover.png', base64_decode(self::PNG)),
        ])->assertOk()->assertJsonPath('success', true);
        $path = $upload->json('path');
        Storage::disk('public')->assertExists($path);

        $book = $this->postJson('/api/books', [
            'title' => 'Illustrated book', 'author' => 'Writer',
            'cover_image' => $path, 'initial_copies' => 1,
        ])->assertCreated()->assertJsonPath('data.cover_url', '/storage/' . $path);
        $id = $book->json('data.id');
        $this->assertDatabaseHas('book_copies', ['book_id' => $id]);

        $replacement = $this->post('/api/books/upload-cover', [
            'image' => UploadedFile::fake()->createWithContent('replacement.png', base64_decode(self::PNG)),
        ])->assertOk()->json('path');
        $this->putJson('/api/books/' . $id, ['cover_image' => $replacement])
            ->assertOk()->assertJsonPath('data.cover_url', '/storage/' . $replacement);
        $this->getJson('/api/books/' . $id)->assertJsonPath('data.cover_image', $replacement);
        $this->putJson('/api/books/' . $id, ['cover_image' => ''])
            ->assertOk()->assertJsonPath('data.cover_url', null);
    }

    public function test_only_librarians_can_upload_valid_cover_images(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['role' => 'student', 'status' => 'active']));
        $this->post('/api/books/upload-cover', [
            'image' => UploadedFile::fake()->createWithContent('cover.png', base64_decode(self::PNG)),
        ])->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => 'librarian', 'status' => 'active']));
        $this->post('/api/books/upload-cover', [
            'image' => UploadedFile::fake()->createWithContent('cover.txt', 'Not an image'),
        ])->assertUnprocessable()->assertJsonValidationErrors('image');
    }
}
