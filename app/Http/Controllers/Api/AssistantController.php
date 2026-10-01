<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\LibraryLocation;
use App\Models\Reservation;
use App\Models\User;
use App\Services\Ai\AssistantKnowledge;
use App\Services\Ai\LibraryDemandService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Help chatbot for LibraLearn. Explains how to use the web app, answers
 * catalog questions from live data, and knows the signed-in user's own
 * loans. Librarians also get queue counts and the demand-insight summary.
 *
 * Students only ever see their own records; no other student's data is
 * placed in the prompt.
 */
class AssistantController extends Controller
{
    private const STOP_WORDS = [
        'the', 'and', 'for', 'with', 'book', 'books', 'libro', 'mga', 'ang', 'ng', 'sa', 'may', 'ba', 'po',
        'where', 'what', 'how', 'can', 'is', 'are', 'do', 'does', 'have', 'you', 'about', 'find', 'available',
        'paano', 'saan', 'ano', 'meron', 'nasaan', 'hanap', 'search', 'borrow', 'reserve', 'please', 'want',
    ];

    public function chat(Request $request, LibraryDemandService $demand)
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

        $user = $request->user();
        $lastQuestion = collect($validated['messages'])->where('role', 'user')->last()['content'] ?? '';

        $systemPrompt = $this->systemPrompt($user, $lastQuestion, $demand);

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
                    'temperature' => 0.3,
                    'max_tokens' => 600,
                ]);

            if (!$response->successful()) {
                Log::warning('Assistant OpenAI request failed.', ['status' => $response->status()]);
                $status = $response->status() === 429 ? 429 : 502;

                return response()->json([
                    'message' => $status === 429
                        ? 'The assistant is busy or out of API quota. Please try again later.'
                        : 'The assistant could not connect right now. Please try again later.',
                ], $status);
            }

            $reply = data_get($response->json(), 'choices.0.message.content');
            if (!is_string($reply) || trim($reply) === '') {
                return response()->json(['message' => 'The assistant returned an empty response. Please try again.'], 502);
            }

            return response()->json(['reply' => trim($reply)]);
        } catch (\Throwable $exception) {
            Log::warning('Assistant request failed.', ['message' => $exception->getMessage()]);

            return response()->json(['message' => 'The assistant could not connect right now. Please try again later.'], 502);
        }
    }

    private function systemPrompt(User $user, string $question, LibraryDemandService $demand): string
    {
        $isLibrarian = $user->isLibrarian();
        $school = config('library.school_name');
        $json = fn ($data) => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $lines = [
            "You are the LibraLearn help assistant for the {$school} (GSA) library.",
            $isLibrarian
                ? 'You are talking to a librarian. Help them run the library inside LibraLearn: catalog work, circulation queues, students, reports, and the AI Insights page.'
                : 'You are talking to a Junior or Senior High School student. Use simple words and short steps.',
            'Reply in the language the user writes in (English, Filipino, or Taglish).',
            'Your job: explain how to use LibraLearn step by step, using the page names and button labels below, and answer questions about GSA books from the data below.',
            'Stay on library and LibraLearn topics. Politely redirect anything else.',
            'Treat the data blocks as the only source of truth. Never invent books, availability, shelves, dates, fines, or policies. If something is missing, say so and suggest asking the librarian.',
            'Call a GSA book available only when its status is exactly "available". Online search results are never physical GSA books.',
            'When you point to a page, give its name and path, for example "My Books (/my-books)".',
            'Keep answers under 150 words unless the user asks for detail. Use numbered steps for how-to answers. No markdown headings.',
            'Never ask for passwords, API keys, or other credentials.',
            '',
            'LIBRARY RULES:',
            ...array_map(fn ($r) => '- ' . $r, AssistantKnowledge::rules()),
            '',
            'HOW TO USE LIBRALEARN:',
            ...array_map(fn ($r) => '- ' . $r, $isLibrarian ? AssistantKnowledge::librarianGuide() : AssistantKnowledge::studentGuide()),
            '',
            'USER: ' . $json([
                'name' => $user->name,
                'role' => $user->role,
                'grade_level' => $isLibrarian ? null : $user->grade_level,
            ]),
        ];

        if ($isLibrarian) {
            $lines[] = 'CIRCULATION QUEUES RIGHT NOW: ' . $json($this->librarianQueues());
            $lines[] = 'DEMAND INSIGHTS (from AI Insights page): ' . $json($this->insightDigest($demand));
        } else {
            $lines[] = "THIS STUDENT'S OWN RECORDS: " . $json($this->studentRecords($user));
        }

        $lines[] = 'CATALOG MATCHES FOR THE QUESTION: ' . $json($this->catalogMatches($question));
        $lines[] = 'LIBRARY SECTIONS: ' . $json($this->sections());

        return implode("\n", $lines);
    }

    private function studentRecords(User $user): array
    {
        $loans = BorrowTransaction::with('book:id,title,author')
            ->where('student_id', $user->id)
            ->whereIn('status', ['pending', 'approved', 'borrowed', 'return_requested', 'overdue'])
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn ($t) => [
                'title' => $t->book?->title,
                'status' => $t->status,
                'requested' => $t->request_date?->toDateString(),
                'due' => $t->due_date?->toDateString(),
                'days_left' => $t->due_date ? (int) now()->startOfDay()->diffInDays($t->due_date->copy()->startOfDay(), false) : null,
            ]);

        $reservations = Reservation::with('book:id,title')
            ->where('student_id', $user->id)
            ->whereIn('status', ['pending', 'approved', 'ready_for_pickup'])
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn ($r) => [
                'title' => $r->book?->title,
                'status' => $r->status,
                'pickup_deadline' => $r->pickup_deadline?->toDateString(),
            ]);

        $active = $loans->whereIn('status', ['borrowed', 'return_requested', 'overdue'])->count();

        return [
            'today' => now()->toDateString(),
            'active_loans' => $active,
            'loan_slots_left' => max(0, (int) config('library.max_active_loans') - $active),
            'loans_and_requests' => $loans->values(),
            'reservations' => $reservations->values(),
            'interests' => $user->interests()->pluck('name'),
        ];
    }

    private function librarianQueues(): array
    {
        return [
            'pending_borrow_requests' => BorrowTransaction::where('status', 'pending')->count(),
            'pending_return_confirmations' => BorrowTransaction::where('status', 'return_requested')->count(),
            'overdue_loans' => BorrowTransaction::where(function ($q) {
                $q->where('status', 'overdue')
                  ->orWhere(fn ($q2) => $q2->where('status', 'borrowed')->where('due_date', '<', now()));
            })->count(),
            'pending_reservations' => Reservation::where('status', 'pending')->count(),
            'pending_student_accounts' => User::where('role', 'student')->where('status', 'pending')->count(),
        ];
    }

    private function insightDigest(LibraryDemandService $demand): array
    {
        $months = (int) config('library.insights.default_months', 6);
        $analysis = Cache::remember(
            "library_insights:analysis:{$months}:" . now()->format('Y-m-d'),
            now()->addMinutes(config('library.insights.cache_minutes', 30)),
            fn () => $demand->analyze($months)
        );

        return [
            'period' => $analysis['window'],
            'summary' => $analysis['summary'],
            'top_books' => array_map(fn ($b) => ['title' => $b['title'], 'loans' => $b['window_loans'], 'trend' => $b['trend']], array_slice($analysis['top_books'], 0, 5)),
            'needs_more_copies' => array_map(fn ($b) => [
                'title' => $b['title'],
                'current_copies' => $b['current_copies'],
                'add' => $b['additional_copies'],
                'priority' => $b['priority'],
                'why' => $b['reasons'],
            ], array_slice($analysis['copy_recommendations'], 0, 5)),
            'top_genres' => array_slice(array_column($analysis['categories']['genre'], 'name'), 0, 3),
        ];
    }

    /** Keyword lookup so the assistant sees books related to the question. */
    private function catalogMatches(string $question): array
    {
        $terms = collect(preg_split('/[^\p{L}\p{N}\-]+/u', Str::lower($question)))
            ->filter(fn ($t) => mb_strlen($t) >= 3 && !in_array($t, self::STOP_WORDS, true))
            ->unique()
            ->take(6);

        $columns = ['id', 'title', 'author', 'genre', 'subject', 'status', 'library_section', 'shelf', 'isbn'];

        $query = Book::query()->where('source', 'gsa');
        if ($terms->isNotEmpty()) {
            $query->where(function ($q) use ($terms) {
                foreach ($terms as $term) {
                    $q->orWhere(fn ($inner) => $inner->search($term));
                }
            });
        } else {
            // Generic question: show a few available books as examples.
            $query->where('status', 'available')->latest();
        }

        return $query->limit(8)->get($columns)->map(fn ($b) => [
            'title' => $b->title,
            'author' => $b->author,
            'genre' => $b->genre,
            'subject' => $b->subject,
            'status' => $b->status,
            'location' => trim(($b->library_section ?? '') . ', shelf ' . ($b->shelf ?? '?'), ', '),
            'page' => '/books/' . $b->id,
        ])->all();
    }

    private function sections(): array
    {
        return LibraryLocation::query()
            ->orderBy('section_name')
            ->limit(30)
            ->get(['section_name', 'shelf_number', 'description'])
            ->toArray();
    }
}
