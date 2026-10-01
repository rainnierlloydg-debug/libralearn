<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OnlineBookSearch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;

class OnlineSearchController extends Controller
{
    public function search(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|max:255',
            'source' => 'nullable|in:all,open_library,google_books',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $query = $request->input('query');
        $source = $request->input('source', 'all');

        $results = [];

        // Search Open Library
        if ($source === 'all' || $source === 'open_library') {
            $openLibraryResults = $this->searchOpenLibrary($query);
            if ($openLibraryResults) {
                $results = array_merge($results, $this->formatOpenLibraryResults($openLibraryResults));
            }
        }

        // Search Google Books
        if ($source === 'all' || $source === 'google_books') {
            $googleBooksResults = $this->searchGoogleBooks($query);
            if ($googleBooksResults) {
                $results = array_merge($results, $this->formatGoogleBooksResults($googleBooksResults));
            }
        }

        // Remove duplicates by ISBN
        $uniqueResults = [];
        $seenIsbns = [];
        foreach ($results as $result) {
            $isbn = $result['isbn'] ?? '';
            if ($isbn && in_array($isbn, $seenIsbns)) {
                continue;
            }
            if ($isbn) {
                $seenIsbns[] = $isbn;
            }
            $uniqueResults[] = $result;
        }

        // Log the search
        OnlineBookSearch::create([
            'student_id' => $request->user()->id,
            'query' => $query,
            'source' => $source,
            'results' => array_slice($uniqueResults, 0, 20),
        ]);

        return response()->json([
            'success' => true,
            'data' => array_slice($uniqueResults, 0, 20),
            'query' => $query,
            'source' => $source,
        ]);
    }

    protected function searchOpenLibrary(string $query): ?array
    {
        $url = config('services.open_library.api_url', 'https://openlibrary.org/search.json');

        try {
            $response = Http::timeout(10)->get($url, [
                'q' => $query,
                'limit' => 20,
            ]);

            if ($response->successful()) {
                return $response->json();
            }
        } catch (\Exception $e) {
            // Log error
        }

        return null;
    }

    protected function formatOpenLibraryResults(array $data): array
    {
        $results = [];

        if (empty($data['docs'])) {
            return $results;
        }

        foreach ($data['docs'] as $doc) {
            $isbn = null;
            if (!empty($doc['isbn'])) {
                $isbn = $doc['isbn'][0];
            }

            $coverId = $doc['cover_i'] ?? null;
            $coverUrl = $coverId ? "https://covers.openlibrary.org/b/id/{$coverId}-L.jpg" : null;

            $results[] = [
                'source' => 'open_library',
                'source_name' => 'Open Library',
                'title' => $doc['title'] ?? 'Unknown Title',
                'author' => $doc['author_name'][0] ?? 'Unknown Author',
                'isbn' => $isbn,
                'publisher' => $doc['publisher'][0] ?? null,
                'publication_year' => $doc['first_publish_year'] ?? null,
                'cover_url' => $coverUrl,
                'description' => is_array($doc['description'] ?? null) ? $doc['description'][0] : ($doc['description'] ?? null),
                'subjects' => $doc['subject'] ?? [],
                'key' => $doc['key'] ?? null,
                'external_url' => $doc['key'] ? "https://openlibrary.org{$doc['key']}" : null,
                'can_embed' => false, // Open Library doesn't typically allow embedding
                'availability' => 'Check Open Library for availability',
            ];
        }

        return $results;
    }

    protected function searchGoogleBooks(string $query): ?array
    {
        $url = config('services.google_books.api_url', 'https://www.googleapis.com/books/v1/volumes');

        try {
            $response = Http::timeout(10)->get($url, [
                'q' => $query,
                'maxResults' => 20,
                'key' => config('services.google_books.api_key'),
            ]);

            if ($response->successful()) {
                return $response->json();
            }
        } catch (\Exception $e) {
            // Log error
        }

        return null;
    }

    protected function formatGoogleBooksResults(array $data): array
    {
        $results = [];

        if (empty($data['items'])) {
            return $results;
        }

        foreach ($data['items'] as $item) {
            $volumeInfo = $item['volumeInfo'] ?? [];
            $saleInfo = $item['saleInfo'] ?? [];
            $accessInfo = $item['accessInfo'] ?? [];

            $isbn = null;
            if (!empty($volumeInfo['industryIdentifiers'])) {
                foreach ($volumeInfo['industryIdentifiers'] as $identifier) {
                    if (in_array($identifier['type'], ['ISBN_13', 'ISBN_10'])) {
                        $isbn = $identifier['identifier'];
                        break;
                    }
                }
            }

            $coverUrl = $volumeInfo['imageLinks']['thumbnail'] ?? null;
            if ($coverUrl) {
                $coverUrl = str_replace('http:', 'https:', $coverUrl);
            }

            $canEmbed = false;
            $embedUrl = null;
            if (!empty($accessInfo['webReaderLink'])) {
                $canEmbed = true;
                $embedUrl = $accessInfo['webReaderLink'];
            } elseif (!empty($accessInfo['pdf']['isAvailable']) && $accessInfo['pdf']['isAvailable']) {
                $canEmbed = true;
                $embedUrl = $accessInfo['pdf']['downloadLink'];
            }

            $results[] = [
                'source' => 'google_books',
                'source_name' => 'Google Books',
                'title' => $volumeInfo['title'] ?? 'Unknown Title',
                'author' => $volumeInfo['authors'][0] ?? 'Unknown Author',
                'isbn' => $isbn,
                'publisher' => $volumeInfo['publisher'] ?? null,
                'publication_year' => $volumeInfo['publishedDate'] ?? null,
                'cover_url' => $coverUrl,
                'description' => $volumeInfo['description'] ?? null,
                'categories' => $volumeInfo['categories'] ?? [],
                'page_count' => $volumeInfo['pageCount'] ?? null,
                'language' => $volumeInfo['language'] ?? null,
                'external_url' => $volumeInfo['infoLink'] ?? null,
                'can_embed' => $canEmbed,
                'embed_url' => $embedUrl,
                'availability' => $saleInfo['saleability'] ?? 'Check Google Books',
                'preview_link' => $volumeInfo['previewLink'] ?? null,
            ];
        }

        return $results;
    }

    public function getHistory(Request $request)
    {
        $history = OnlineBookSearch::where('student_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $history,
        ]);
    }
}
