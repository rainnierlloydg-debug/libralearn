<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\LibraryLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class StudentAssistantController extends Controller
{
    public function chat(Request $request)
    {
        $validated = $request->validate([
            'messages' => 'required|array|min:1|max:12',
            'messages.*.role' => 'required|string|in:user,assistant',
            'messages.*.content' => 'required|string|max:2000',
        ]);

        $apiKey = config('services.openai.api_key');
        if (!$apiKey) {
            return response()->json([
                'message' => 'The library assistant is not configured yet. Please contact the librarian.',
            ], 503);
        }

        $books = Book::query()
            ->where('source', 'gsa')
            ->orderBy('title')
            ->limit(20)
            ->get(['title', 'author', 'genre', 'subject', 'status', 'library_section', 'shelf'])
            ->toArray();

        $locations = LibraryLocation::query()
            ->orderBy('section_name')
            ->limit(30)
            ->get(['section_name', 'shelf_number', 'description'])
            ->toArray();

        $systemPrompt = implode("\n", [
            'You are the LibraLearn student library assistant. Answer in the same language as the student, including Filipino when appropriate.',
            'Help only with the GSA library, books, catalog search, borrowing, reservations, saved books, recommendations, and how to use this system. Politely redirect unrelated requests.',
            'Use the supplied catalog and location data as the source of truth. Do not invent book availability, policies, fees, loan periods, opening hours, or locations. If a fact is not present, say you do not have that information and suggest asking the librarian.',
            'The book snapshot may be incomplete. Only call a book available when its status is exactly "available". Distinguish GSA physical books from online search results.',
            'Never ask for passwords, API keys, or other sensitive credentials.',
            'GSA book catalog snapshot: ' . json_encode($books, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'Library locations snapshot: ' . json_encode($locations, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        try {
            $response = Http::withToken($apiKey)
                ->acceptJson()
                ->timeout(30)
                ->post(config('services.openai.api_url'), [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'messages' => array_merge(
                        [['role' => 'system', 'content' => $systemPrompt]],
                        $validated['messages']
                    ),
                    'temperature' => 0.4,
                    'max_tokens' => 500,
                ]);

            if (!$response->successful()) {
                Log::warning('Student assistant OpenAI request failed.', ['status' => $response->status()]);
                $status = $response->status() === 429 ? 429 : 502;

                return response()->json([
                    'message' => $status === 429
                        ? 'The assistant is busy or out of API quota. Please try again later.'
                        : 'The assistant could not connect right now. Please try again later.',
                ], $status);
            }

            $reply = data_get($response->json(), 'choices.0.message.content');
            if (!is_string($reply) || trim($reply) === '') {
                return response()->json([
                    'message' => 'The assistant returned an empty response. Please try again.',
                ], 502);
            }

            return response()->json(['reply' => trim($reply)]);
        } catch (\Throwable $exception) {
            Log::warning('Student assistant request failed.', ['message' => $exception->getMessage()]);

            return response()->json([
                'message' => 'The assistant could not connect right now. Please try again later.',
            ], 502);
        }
    }
}
