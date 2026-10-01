<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiCatalogJob;
use App\Models\Book;
use App\Models\Interest;
use App\Models\LibraryLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AiCatalogController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('librarian');

        $query = AiCatalogJob::with('reviewedBy')->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $perPage = min($request->get('per_page', 20), 100);
        $jobs = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $jobs,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorize('librarian');

        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Store image
        $path = $request->file('image')->store('ai-catalog', 'public');

        // Create job
        $job = AiCatalogJob::create([
            'uploaded_image' => $path,
            'status' => 'processing',
        ]);

        // Process asynchronously (in production, use a queue)
        // For now, process synchronously
        $this->processJob($job);

        return response()->json([
            'success' => true,
            'message' => 'Image uploaded. Processing started.',
            'data' => $job->fresh(),
        ], 201);
    }

    public function show($id)
    {
        $this->authorize('librarian');

        $job = AiCatalogJob::with('reviewedBy')->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $job,
        ]);
    }

    public function processJob(AiCatalogJob $job)
    {
        try {
            // Step 1: OCR extraction
            $job->update(['status' => 'processing']);
            $extractedData = $this->extractTextFromImage($job->uploaded_image);
            $ocrMetadata = $extractedData['metadata'] ?? [];
            $aiMetadata = $this->extractMetadataWithOpenAI($job->uploaded_image, $extractedData['text'] ?? '');
            $metadata = array_merge($ocrMetadata, $aiMetadata);

            $job->update([
                'extracted_text' => $extractedData['text'] ?? '',
                'extracted_metadata' => $metadata,
            ]);

            // Step 2: Search Open Library
            $openLibraryResult = $this->searchOpenLibrary($metadata);
            $job->update(['open_library_result' => $openLibraryResult]);

            // Step 3: Search Google Books if needed
            $googleBooksResult = null;
            if (!$openLibraryResult || empty($openLibraryResult['items'])) {
                $googleBooksResult = $this->searchGoogleBooks($metadata);
                $job->update(['google_books_result' => $googleBooksResult]);
            }

            // Step 4: Combine and classify
            $finalMetadata = $this->combineAndClassify(
                $metadata,
                $openLibraryResult,
                $googleBooksResult
            );

            $job->update([
                'final_metadata' => $finalMetadata,
                'confidence' => $this->calculateConfidence($finalMetadata, $metadata),
                'status' => 'needs_review',
            ]);
        } catch (\Exception $e) {
            $job->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
        }
    }

    protected function extractTextFromImage(string $imagePath): array
    {
        // Use OCR.space API or similar
        $apiKey = config('services.ocr.api_key');
        $apiUrl = config('services.ocr.api_url', 'https://api.ocr.space/parse/image');

        if (!$apiKey) {
            return ['text' => '', 'metadata' => []];
        }

        try {
            $response = Http::attach(
                'file',
                Storage::disk('public')->get($imagePath),
                basename($imagePath)
            )->post($apiUrl, [
                'apikey' => $apiKey,
                'language' => 'eng',
                'isOverlayRequired' => false,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                if (isset($data['ParsedResults'][0]['ParsedText'])) {
                    $text = $data['ParsedResults'][0]['ParsedText'];
                    return [
                        'text' => $text,
                        'metadata' => $this->parseBookMetadata($text),
                    ];
                }
            }
        } catch (\Exception $e) {
            return ['text' => '', 'metadata' => []];
        }

        return ['text' => '', 'metadata' => []];
    }

    protected function extractMetadataWithOpenAI(string $imagePath, string $ocrText): array
    {
        $apiKey = config('services.openai.api_key');
        if (!$apiKey) {
            return [];
        }

        try {
            $disk = Storage::disk('public');
            $mimeType = $disk->mimeType($imagePath) ?: 'image/jpeg';
            $imageData = base64_encode($disk->get($imagePath));
            $ocrText = $ocrText !== '' ? Str::limit($ocrText, 12000) : 'No OCR text was available.';

            $response = Http::withToken($apiKey)
                ->acceptJson()
                ->timeout(25)
                ->post(config('services.openai.api_url'), [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'temperature' => 0.1,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You catalog books from cover images and OCR. Extract only information supported by the image or OCR; never guess. Return one JSON object with keys title, author, isbn, publisher, publication_year, edition, language, description, genre, and subject. Use null for unknown values. Keep description concise.',
                        ],
                        [
                            'role' => 'user',
                            'content' => [
                                ['type' => 'text', 'text' => "Read this book cover. Use the OCR text as supporting evidence, but correct obvious OCR errors.\n\nOCR text:\n{$ocrText}"],
                                [
                                    'type' => 'image_url',
                                    'image_url' => [
                                        'url' => "data:{$mimeType};base64,{$imageData}",
                                        'detail' => 'high',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ]);

            if (!$response->successful()) {
                Log::warning('OpenAI book metadata extraction failed.', ['status' => $response->status()]);
                return [];
            }

            $content = data_get($response->json(), 'choices.0.message.content');
            $metadata = is_string($content) ? json_decode($content, true) : null;
            if (!is_array($metadata)) {
                Log::warning('OpenAI returned invalid book metadata JSON.');
                return [];
            }

            $fields = ['title', 'author', 'isbn', 'publisher', 'publication_year', 'edition', 'language', 'description', 'genre', 'subject'];
            $extracted = [];
            foreach ($fields as $field) {
                $value = $metadata[$field] ?? null;
                if (is_string($value) && trim($value) !== '') {
                    $extracted[$field] = trim($value);
                }
            }

            return $extracted;
        } catch (\Throwable $e) {
            Log::warning('OpenAI book metadata extraction request failed.', ['message' => $e->getMessage()]);
            return [];
        }
    }

    protected function parseBookMetadata(string $text): array
    {
        $metadata = [];
        $lines = explode("\n", $text);

        foreach ($lines as $line) {
            $line = trim($line);
            // Simple pattern matching for common book metadata
            if (preg_match('/^ISBN[:\s]+([\d\-]+)/i', $line, $matches)) {
                $metadata['isbn'] = str_replace('-', '', $matches[1]);
            } elseif (preg_match('/^Title[:\s]+(.+)/i', $line, $matches)) {
                $metadata['title'] = trim($matches[1]);
            } elseif (preg_match('/^Author[:\s]+(.+)/i', $line, $matches)) {
                $metadata['author'] = trim($matches[1]);
            } elseif (preg_match('/^Publisher[:\s]+(.+)/i', $line, $matches)) {
                $metadata['publisher'] = trim($matches[1]);
            } elseif (preg_match('/^Year[:\s]+(\d{4})/i', $line, $matches)) {
                $metadata['publication_year'] = $matches[1];
            } elseif (preg_match('/^Edition[:\s]+(.+)/i', $line, $matches)) {
                $metadata['edition'] = trim($matches[1]);
            }
        }

        return $metadata;
    }

    protected function searchOpenLibrary(array $metadata): ?array
    {
        $searchTerms = [];

        if (!empty($metadata['isbn'])) {
            $searchTerms[] = 'isbn:' . $metadata['isbn'];
        }
        if (!empty($metadata['title'])) {
            $searchTerms[] = 'title:' . $metadata['title'];
        }
        if (!empty($metadata['author'])) {
            $searchTerms[] = 'author:' . $metadata['author'];
        }

        if (empty($searchTerms)) {
            return null;
        }

        $query = implode(' ', $searchTerms);
        $url = config('services.open_library.api_url', 'https://openlibrary.org/search.json');

        try {
            $response = Http::timeout(10)->get($url, [
                'q' => $query,
                'limit' => 5,
            ]);

            if ($response->successful()) {
                return $response->json();
            }
        } catch (\Exception $e) {
            // Log error but continue
        }

        return null;
    }

    protected function searchGoogleBooks(array $metadata): ?array
    {
        $searchTerms = [];

        if (!empty($metadata['isbn'])) {
            $searchTerms[] = 'isbn:' . $metadata['isbn'];
        }
        if (!empty($metadata['title'])) {
            $searchTerms[] = 'intitle:' . $metadata['title'];
        }
        if (!empty($metadata['author'])) {
            $searchTerms[] = 'inauthor:' . $metadata['author'];
        }

        if (empty($searchTerms)) {
            return null;
        }

        $query = implode(' ', $searchTerms);
        $url = config('services.google_books.api_url', 'https://www.googleapis.com/books/v1/volumes');

        try {
            $response = Http::timeout(10)->get($url, [
                'q' => $query,
                'maxResults' => 5,
                'key' => config('services.google_books.api_key'),
            ]);

            if ($response->successful()) {
                return $response->json();
            }
        } catch (\Exception $e) {
            // Log error but continue
        }

        return null;
    }

    protected function combineAndClassify(array $ocrData, ?array $openLibrary, ?array $googleBooks): array
    {
        $result = [
            'title' => $ocrData['title'] ?? 'Not detected',
            'author' => $ocrData['author'] ?? 'Not detected',
            'isbn' => $ocrData['isbn'] ?? 'Not detected',
            'publisher' => $ocrData['publisher'] ?? 'Not detected',
            'publication_date' => $ocrData['publication_year'] ?? 'Not detected',
            'edition' => $ocrData['edition'] ?? 'Not detected',
            'language' => $ocrData['language'] ?? 'Not detected',
            'description' => $ocrData['description'] ?? 'Not detected',
            'genre' => $ocrData['genre'] ?? 'Not detected',
            'subject' => $ocrData['subject'] ?? 'Not detected',
            'cover_image' => null,
            'sources' => [],
        ];

        // Priority: Open Library > Google Books > OCR
        $sources = [];

        if ($openLibrary && !empty($openLibrary['docs'])) {
            $doc = $openLibrary['docs'][0];
            $sources[] = 'open_library';
            $this->mergeFromOpenLibrary($result, $doc);
        }

        if ($googleBooks && !empty($googleBooks['items'])) {
            $item = $googleBooks['items'][0];
            $volumeInfo = $item['volumeInfo'] ?? [];
            $sources[] = 'google_books';
            $this->mergeFromGoogleBooks($result, $volumeInfo);
        }

        $result['publication_date'] = $this->normalizePublicationDate($result['publication_date']);

        // OCR data as fallback
        $sources[] = 'ocr';

        $result['sources'] = $sources;

        // Classify genre and subject
        if ($result['genre'] === 'Not detected') {
            $result['genre'] = $this->classifyGenre($result);
        }
        if ($result['subject'] === 'Not detected') {
            $result['subject'] = $this->classifySubject($result);
        }

        return $result;
    }

    protected function normalizePublicationDate($value): string
    {
        $value = trim((string) $value);

        if (preg_match('/^\d{4}$/', $value)) {
            return $value . '-01-01';
        }

        if (preg_match('/^\d{4}-\d{2}$/', $value)) {
            return $value . '-01';
        }

        return $value !== '' ? $value : 'Not detected';
    }

    protected function mergeFromOpenLibrary(array &$result, array $doc): void
    {
        $fields = [
            'title' => $doc['title'] ?? null,
            'author' => $doc['author_name'][0] ?? null,
            'isbn' => $doc['isbn'][0] ?? null,
            'publisher' => $doc['publisher'][0] ?? null,
            'publication_date' => $doc['first_publish_year'] ?? null,
            'description' => is_array($doc['description'] ?? null) ? $doc['description'][0] : ($doc['description'] ?? null),
        ];

        foreach ($fields as $key => $value) {
            if ($value && $result[$key] === 'Not detected') {
                $result[$key] = $value;
            }
        }

        // Subjects/genres from Open Library
        if (!empty($doc['subject'])) {
            $subjects = $doc['subject'];
            $result['raw_subjects'] = $subjects;
        }
    }

    protected function mergeFromGoogleBooks(array &$result, array $volumeInfo): void
    {
        $fields = [
            'title' => $volumeInfo['title'] ?? null,
            'author' => $volumeInfo['authors'][0] ?? null,
            'isbn' => ($volumeInfo['industryIdentifiers'][0]['identifier'] ?? null) ?? null,
            'publisher' => $volumeInfo['publisher'] ?? null,
            'publication_date' => $volumeInfo['publishedDate'] ?? null,
            'description' => $volumeInfo['description'] ?? null,
            'cover_image' => $volumeInfo['imageLinks']['thumbnail'] ?? null,
        ];

        foreach ($fields as $key => $value) {
            if ($value && $result[$key] === 'Not detected') {
                $result[$key] = $value;
            }
        }

        // Categories from Google Books
        if (!empty($volumeInfo['categories'])) {
            $result['raw_categories'] = $volumeInfo['categories'];
        }
    }

    protected function classifyGenre(array $metadata): string
    {
        $text = strtolower(implode(' ', [
            $metadata['title'] ?? '',
            $metadata['description'] ?? '',
            $metadata['raw_subjects'] ? implode(' ', $metadata['raw_subjects']) : '',
            $metadata['raw_categories'] ? implode(' ', $metadata['raw_categories']) : '',
        ]));

        $genreKeywords = [
            'Fantasy' => ['fantasy', 'magic', 'wizard', 'dragon', 'quest', 'mythical'],
            'Science Fiction' => ['science fiction', 'sci-fi', 'space', 'future', 'alien', 'robot', 'cyberpunk', 'dystopian'],
            'Mystery' => ['mystery', 'detective', 'crime', 'murder', 'thriller', 'suspense'],
            'Romance' => ['romance', 'love', 'relationship'],
            'Adventure' => ['adventure', 'journey', 'quest', 'expedition'],
            'Horror' => ['horror', 'scary', 'ghost', 'vampire', 'zombie'],
            'Historical Fiction' => ['historical', 'history', 'war', 'ancient', 'medieval'],
            'Biography' => ['biography', 'memoir', 'autobiography', 'life story'],
            'Non-Fiction' => ['non-fiction', 'nonfiction', 'guide', 'handbook', 'textbook'],
            'Young Adult' => ['young adult', 'teen', 'coming of age'],
            'Children\'s Literature' => ['children', 'picture book', 'early reader'],
        ];

        foreach ($genreKeywords as $genre => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($text, $keyword)) {
                    return $genre;
                }
            }
        }

        return 'Fiction';
    }

    protected function classifySubject(array $metadata): string
    {
        $text = strtolower(implode(' ', [
            $metadata['title'] ?? '',
            $metadata['description'] ?? '',
            $metadata['raw_subjects'] ? implode(' ', $metadata['raw_subjects']) : '',
            $metadata['raw_categories'] ? implode(' ', $metadata['raw_categories']) : '',
        ]));

        $subjectKeywords = [
            'Mathematics' => ['math', 'algebra', 'geometry', 'calculus', 'statistics', 'trigonometry'],
            'Science' => ['physics', 'chemistry', 'biology', 'science', 'scientific', 'nature'],
            'English' => ['english', 'literature', 'grammar', 'writing', 'composition', 'poetry'],
            'Filipino' => ['filipino', 'tagalog', 'philippine', 'pilipino'],
            'History' => ['history', 'historical', 'civilization', 'ancient', 'war'],
            'Social Studies' => ['social', 'society', 'geography', 'civics', 'culture', 'economics'],
            'Technology' => ['computer', 'technology', 'programming', 'software', 'digital', 'coding'],
            'Arts' => ['art', 'music', 'theater', 'dance', 'visual arts', 'painting'],
            'Reference' => ['encyclopedia', 'dictionary', 'reference', 'almanac', 'atlas'],
        ];

        foreach ($subjectKeywords as $subject => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($text, $keyword)) {
                    return $subject;
                }
            }
        }

        return 'General';
    }

    protected function calculateConfidence(array $finalMetadata, array $ocrData): float
    {
        $detected = 0;
        $total = 0;

        foreach ($finalMetadata as $key => $value) {
            if (in_array($key, ['sources', 'raw_subjects', 'raw_categories'])) continue;
            $total++;
            if ($value !== 'Not detected' && !empty($value)) {
                $detected++;
            }
        }

        return $total > 0 ? round(($detected / $total) * 100, 2) : 0;
    }

    public function confirm(Request $request, $id)
    {
        $this->authorize('librarian');

        $job = AiCatalogJob::findOrFail($id);

        foreach (['isbn', 'publisher', 'publication_date', 'edition', 'language', 'description', 'cover_image', 'genre', 'subject', 'shelf', 'library_section'] as $field) {
            if ($request->input($field) === 'Not detected') {
                $request->merge([$field => null]);
            }
        }

        if ($job->status !== 'needs_review' && $job->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'Job is not ready for confirmation',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'author' => 'required|string|max:255',
            'isbn' => 'nullable|string|max:20|unique:books,isbn',
            'publisher' => 'nullable|string|max:255',
            'publication_date' => 'nullable|date',
            'edition' => 'nullable|string|max:50',
            'language' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'genre' => 'nullable|string|max:100',
            'subject' => 'nullable|string|max:100',
            'shelf' => 'nullable|string|max:50',
            'library_section' => 'nullable|string|max:100',
            'status' => 'nullable|in:available,borrowed,reserved,overdue,lost,damaged',
            'library_location_id' => 'nullable|exists:library_locations,id',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'exists:interests,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $book = Book::create($request->except('category_ids'));

        if ($request->has('category_ids')) {
            $book->categories()->attach($request->category_ids);
        }

        $job->update([
            'status' => 'confirmed',
            'reviewed_by' => $request->user()->id,
            'final_metadata' => array_merge($job->final_metadata, ['confirmed' => true]),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Book added to catalog successfully',
            'data' => $book->load(['libraryLocation', 'categories']),
        ]);
    }

    public function saveDraft(Request $request, $id)
    {
        $this->authorize('librarian');

        $job = AiCatalogJob::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'final_metadata' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $job->update([
            'final_metadata' => $request->final_metadata,
            'status' => 'draft',
            'reviewed_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Draft saved successfully',
            'data' => $job,
        ]);
    }

    public function retry($id)
    {
        $this->authorize('librarian');

        $job = AiCatalogJob::findOrFail($id);

        $job->update([
            'status' => 'processing',
            'error_message' => null,
        ]);

        $this->processJob($job);

        return response()->json([
            'success' => true,
            'message' => 'Processing restarted',
            'data' => $job->fresh(),
        ]);
    }

    public function destroy($id)
    {
        $this->authorize('librarian');

        $job = AiCatalogJob::findOrFail($id);
        Storage::disk('public')->delete($job->uploaded_image);
        $job->delete();

        return response()->json([
            'success' => true,
            'message' => 'AI catalog job deleted successfully',
        ]);
    }
}
