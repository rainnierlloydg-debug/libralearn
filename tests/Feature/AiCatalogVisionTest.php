<?php

namespace Tests\Feature;

use App\Models\AiCatalogJob;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AiCatalogVisionTest extends TestCase
{
    use RefreshDatabase;

    // 1x1 transparent PNG (GD is not required to build it).
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Http::preventStrayRequests();
        config([
            'services.google_vision.api_key' => 'test-vision-key',
            'services.gemini.api_key' => null,
            'services.google_books.api_key' => 'test-books-key',
            'services.google_vision.api_url' => 'https://vision.googleapis.com/v1/images:annotate',
            'services.open_library.api_url' => 'https://openlibrary.org/search.json',
            'services.google_books.api_url' => 'https://www.googleapis.com/books/v1/volumes',
        ]);

        Sanctum::actingAs(User::factory()->create([
            'role' => 'librarian',
            'school_id' => 'LIB-' . Str::random(6),
            'status' => 'active',
        ]));
    }

    private function upload(): AiCatalogJob
    {
        $file = UploadedFile::fake()->createWithContent('cover.png', base64_decode(self::PNG));
        $id = $this->post('/api/ai-catalog', ['image' => $file], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data.id');

        return AiCatalogJob::findOrFail($id);
    }

    private function visionText(string $text): array
    {
        return ['responses' => [['fullTextAnnotation' => ['text' => $text], 'textAnnotations' => [['description' => $text]]]]];
    }

    public function test_vision_ocr_then_open_library_without_google_fallback(): void
    {
        Http::fake([
            'vision.googleapis.com/*' => Http::response($this->visionText("Title: Noli Me Tangere\nAuthor: Jose Rizal\nISBN: 978-971-0810-73-6")),
            'openlibrary.org/*' => Http::response(['docs' => [[
                'title' => 'Noli Me Tangere',
                'author_name' => ['José Rizal'],
                'publisher' => ['Anvil'],
                'first_publish_year' => 1887,
            ]]]),
            'www.googleapis.com/books/*' => Http::response(['items' => []]),
        ]);

        $job = $this->upload();

        $this->assertSame('needs_review', $job->status);
        $this->assertSame('Noli Me Tangere', $job->final_metadata['title']);
        $this->assertSame('Jose Rizal', $job->final_metadata['author'], 'OCR value kept; lookups only fill gaps');
        $this->assertSame('9789710810736', $job->final_metadata['isbn']);
        $this->assertSame('Anvil', $job->final_metadata['publisher']);
        $this->assertContains('open_library', $job->final_metadata['sources']);

        Http::assertSent(function (Request $request) {
            return str_starts_with($request->url(), 'https://vision.googleapis.com/v1/images:annotate')
                && $request->hasHeader('X-Goog-Api-Key', 'test-vision-key')
                && !str_contains($request->url(), 'key=')
                && $request['requests'][0]['features'][0]['type'] === 'TEXT_DETECTION'
                && $request['requests'][0]['image']['content'] === self::PNG;
        });
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), 'ocr.space'));
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), 'googleapis.com/books'));
    }

    public function test_google_books_fallback_when_open_library_finds_nothing(): void
    {
        Http::fake([
            'vision.googleapis.com/*' => Http::response($this->visionText("Title: Florante at Laura\nAuthor: Francisco Balagtas")),
            'openlibrary.org/*' => Http::response(['docs' => []]),
            'www.googleapis.com/books/*' => Http::response(['items' => [['volumeInfo' => [
                'title' => 'Florante at Laura',
                'authors' => ['Francisco Balagtas'],
                'publisher' => 'Adarna House',
                'publishedDate' => '2005',
            ]]]]),
        ]);

        $job = $this->upload();

        $this->assertSame('Adarna House', $job->final_metadata['publisher']);
        $this->assertSame('2005-01-01', $job->final_metadata['publication_date']);
        $this->assertContains('google_books', $job->final_metadata['sources']);
        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'googleapis.com/books') && $r->hasHeader('X-Goog-Api-Key', 'test-books-key') && !str_contains($r->url(), 'key='));
    }

    public function test_base_lookup_urls_reach_the_search_endpoints(): void
    {
        config([
            'services.open_library.api_url' => 'https://openlibrary.org',
            'services.google_books.api_url' => 'https://www.googleapis.com/books/v1',
        ]);
        Http::fake([
            'vision.googleapis.com/*' => Http::response($this->visionText('Title: Ibong Adarna')),
            'openlibrary.org/search.json*' => Http::response(['docs' => []]),
            'www.googleapis.com/books/v1/volumes*' => Http::response(['items' => []]),
        ]);

        $this->upload();

        Http::assertSent(fn (Request $r) => str_starts_with($r->url(), 'https://openlibrary.org/search.json?'));
        Http::assertSent(fn (Request $r) => str_starts_with($r->url(), 'https://www.googleapis.com/books/v1/volumes?'));
    }

    public function test_missing_fields_are_marked_not_detected(): void
    {
        Http::fake([
            'vision.googleapis.com/*' => Http::response(['responses' => [[]]]), // no text found
            '*' => Http::response([], 500),
        ]);

        $job = $this->upload();

        $this->assertSame('needs_review', $job->status);
        foreach (['title', 'author', 'isbn', 'publisher', 'publication_date', 'edition', 'language', 'description', 'genre', 'subject'] as $field) {
            $this->assertSame('Not detected', $job->final_metadata[$field], "{$field} must not be invented");
        }
        Http::assertSentCount(1); // nothing to search for after OCR found no text
    }

    public function test_vision_error_is_handled_without_inventing_data(): void
    {
        Http::fake([
            'vision.googleapis.com/*' => Http::response(['responses' => [['error' => ['code' => 7, 'message' => 'API key invalid']]]]),
        ]);

        $job = $this->upload();

        $this->assertSame('needs_review', $job->status);
        $this->assertSame('', $job->extracted_text);
        $this->assertSame('Not detected', $job->final_metadata['title']);
    }

    public function test_connection_failure_never_logs_api_keys(): void
    {
        Http::fake([
            'vision.googleapis.com/*' => fn () => throw new \Illuminate\Http\Client\ConnectionException(
                'cURL error 28: timed out for https://vision.googleapis.com/v1/images:annotate?key=test-vision-key'
            ),
        ]);
        \Illuminate\Support\Facades\Log::spy();

        $job = $this->upload();

        $this->assertSame('needs_review', $job->status);
        \Illuminate\Support\Facades\Log::shouldHaveReceived('warning')
            ->withArgs(fn ($message, $context = []) => $message === 'Google Vision OCR request failed.'
                && !str_contains(json_encode($context), 'test-vision-key')
                && str_contains($context['message'], '[redacted]'))
            ->once();
    }

    public function test_no_api_key_skips_vision_call(): void
    {
        config(['services.google_vision.api_key' => null]);
        Http::fake();

        $job = $this->upload();

        $this->assertSame('needs_review', $job->status);
        Http::assertNothingSent();
    }

    public function test_librarian_cannot_confirm_with_not_detected_title(): void
    {
        Http::fake(['vision.googleapis.com/*' => Http::response(['responses' => [[]]])]);
        $job = $this->upload();

        $this->postJson("/api/ai-catalog/{$job->id}/confirm", ['title' => 'Not detected', 'author' => 'Not detected'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'author']);

        $this->postJson("/api/ai-catalog/{$job->id}/confirm", ['title' => 'Real Title', 'author' => 'Real Author', 'isbn' => 'Not detected'])
            ->assertOk()
            ->assertJsonPath('data.isbn', null);
    }

    public function test_identification_api_uses_gemini_image_input_and_numeric_publication_year(): void
    {
        config(['services.gemini.api_key' => 'test-gemini-key', 'services.google_vision.api_key' => null]);
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['candidates' => [[
                'content' => ['parts' => [['text' => json_encode(['title' => 'Cover Title', 'author' => 'Cover Author', 'publication_year' => 2024])]]],
            ]]]),
            'openlibrary.org/*' => Http::response(['docs' => []]),
            'www.googleapis.com/books/*' => Http::response(['items' => []]),
        ]);
        $file = UploadedFile::fake()->createWithContent('cover.png', base64_decode(self::PNG));
        $this->post('/api/ai/identify-image', ['image' => $file], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.status', 'needs_review')
            ->assertJsonPath('data.final_metadata.title', 'Cover Title')
            ->assertJsonPath('data.final_metadata.sources', ['gemini'])
            ->assertJsonPath('data.final_metadata.publication_date', '2024-01-01');
        Http::assertSent(fn ($r) => str_contains($r->url(), ':generateContent')
            && $r->hasHeader('X-Goog-Api-Key', 'test-gemini-key') && !str_contains($r->url(), 'key=')
            && $r['contents'][0]['parts'][1]['inline_data']['data'] === self::PNG);
    }

    public function test_students_cannot_identify_images_and_non_images_are_rejected(): void
    {
        $this->post('/api/ai/identify-image', ['image' => UploadedFile::fake()->createWithContent('cover.txt', 'not an image')], ['Accept' => 'application/json'])
            ->assertUnprocessable();
        Sanctum::actingAs(User::factory()->create(['role' => 'student', 'status' => 'active']));
        $this->postJson('/api/ai/identify-image')->assertForbidden();
    }

    public function test_cataloging_uses_its_own_key_and_preserves_the_assistant_key(): void
    {
        config([
            'services.google_vision.api_key' => null,
            'services.gemini.api_key' => 'assistant-key',
            'services.gemini.catalog_api_key' => 'catalog-key',
        ]);
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['candidates' => [[
                'content' => ['parts' => [['text' => '{"title":"Sample Cover","author":"Sample Writer"}']]],
            ]]]),
            'openlibrary.org/*' => Http::response(['docs' => []]),
            'www.googleapis.com/books/*' => Http::response(['items' => []]),
        ]);
        $job = $this->upload();
        $this->assertSame('Sample Cover', $job->final_metadata['title']);
        $this->assertSame('assistant-key', config('services.gemini.api_key'));
        Http::assertSent(fn ($r) => str_contains($r->url(), ':generateContent') && $r->hasHeader('X-Goog-Api-Key', 'catalog-key'));
        Http::assertNotSent(fn ($r) => $r->hasHeader('X-Goog-Api-Key', 'assistant-key'));
    }

    public function test_catalog_key_is_redacted_from_connection_errors(): void
    {
        config(['services.google_vision.api_key' => null, 'services.gemini.catalog_api_key' => 'catalog-key']);
        Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('Connection failed with catalog-key'));
        \Illuminate\Support\Facades\Log::spy();
        $job = $this->upload();
        $this->assertSame('needs_review', $job->status);
        \Illuminate\Support\Facades\Log::shouldHaveReceived('warning')->withArgs(fn ($message, $context) =>
            $message === 'Gemini book metadata extraction request failed.'
            && !str_contains($context['message'], 'catalog-key')
            && str_contains($context['message'], '[redacted]'))->once();
    }
}
