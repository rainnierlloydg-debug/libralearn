<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiCatalogJob;
use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\Interest;
use App\Models\RecommendationFeedback;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ReportController extends Controller
{
    public function bookReport(Request $request)
    {
        $this->authorize('librarian');

        $query = Book::where('source', 'gsa');

        if ($request->filled('genre')) {
            $query->where('genre', $request->genre);
        }

        if ($request->filled('subject')) {
            $query->where('subject', $request->subject);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('year_from')) {
            $query->whereYear('publication_date', '>=', $request->year_from);
        }

        if ($request->filled('year_to')) {
            $query->whereYear('publication_date', '<=', $request->year_to);
        }

        $books = $query->with('libraryLocation')->paginate(50);

        // Summary stats
        $summary = [
            'total' => Book::where('source', 'gsa')->count(),
            'by_genre' => Book::where('source', 'gsa')
                ->selectRaw('genre, count(*) as count')
                ->groupBy('genre')
                ->orderByDesc('count')
                ->get(),
            'by_subject' => Book::where('source', 'gsa')
                ->selectRaw('subject, count(*) as count')
                ->groupBy('subject')
                ->orderByDesc('count')
                ->get(),
            'by_status' => Book::where('source', 'gsa')
                ->selectRaw('status, count(*) as count')
                ->groupBy('status')
                ->orderByDesc('count')
                ->get(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'books' => $books,
                'summary' => $summary,
            ],
        ]);
    }

    public function borrowingReport(Request $request)
    {
        $this->authorize('librarian');

        $dateFrom = $request->get('date_from', Carbon::now()->subMonth()->toDateString());
        $dateTo = $request->get('date_to', Carbon::now()->toDateString());

        $query = BorrowTransaction::with(['student', 'book'])
            ->whereBetween('borrow_date', [$dateFrom, $dateTo]);

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $transactions = $query->orderBy('borrow_date', 'desc')->paginate(50);

        // Summary
        $summary = [
            'total_transactions' => BorrowTransaction::whereBetween('borrow_date', [$dateFrom, $dateTo])->count(),
            'by_status' => BorrowTransaction::whereBetween('borrow_date', [$dateFrom, $dateTo])
                ->selectRaw('status, count(*) as count')
                ->groupBy('status')
                ->get(),
            'most_borrowed' => Book::where('source', 'gsa')
                ->withCount(['borrowTransactions as borrow_count' => function ($q) use ($dateFrom, $dateTo) {
                    $q->whereBetween('borrow_date', [$dateFrom, $dateTo]);
                }])
                ->orderByDesc('borrow_count')
                ->limit(10)
                ->get(['id', 'title', 'author', 'cover_image', 'borrow_count']),
            'borrowing_frequency' => BorrowTransaction::whereBetween('borrow_date', [$dateFrom, $dateTo])
                ->selectRaw('DATE(borrow_date) as date, count(*) as count')
                ->groupBy('date')
                ->orderBy('date')
                ->get(),
            'current_borrowed' => BorrowTransaction::where('status', 'borrowed')
                ->with(['student', 'book'])
                ->get(),
            'overdue_transactions' => BorrowTransaction::where('status', 'overdue')
                ->with(['student', 'book'])
                ->get(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'transactions' => $transactions,
                'summary' => $summary,
            ],
        ]);
    }

    public function studentActivityReport(Request $request)
    {
        $this->authorize('librarian');

        $dateFrom = $request->get('date_from', Carbon::now()->subMonth()->toDateString());
        $dateTo = $request->get('date_to', Carbon::now()->toDateString());

        // Active students (those with activity in period)
        $activeStudents = User::where('role', 'student')
            ->whereHas('borrowedBooks', function ($q) use ($dateFrom, $dateTo) {
                $q->whereBetween('borrow_date', [$dateFrom, $dateTo]);
            })
            ->orWhereHas('reservations', function ($q) use ($dateFrom, $dateTo) {
                $q->whereBetween('reservation_date', [$dateFrom, $dateTo]);
            })
            ->orWhereHas('savedBooks', function ($q) use ($dateFrom, $dateTo) {
                $q->whereBetween('created_at', [$dateFrom, $dateTo]);
            })
            ->withCount(['borrowedBooks', 'reservations', 'savedBooks'])
            ->get();

        // Most selected interests
        $topInterests = Interest::withCount(['students as student_count' => function ($q) use ($dateFrom, $dateTo) {
            $q->whereBetween('student_interests.created_at', [$dateFrom, $dateTo]);
        }])
            ->orderByDesc('student_count')
            ->limit(10)
            ->get();

        // Most saved books
        $mostSaved = Book::where('source', 'gsa')
            ->withCount(['savedBooks as save_count' => function ($q) use ($dateFrom, $dateTo) {
                $q->whereBetween('saved_books.created_at', [$dateFrom, $dateTo]);
            }])
            ->orderByDesc('save_count')
            ->limit(10)
            ->get(['id', 'title', 'author', 'cover_image', 'save_count']);

        // Recommendation interactions
        $recommendationInteractions = RecommendationFeedback::whereBetween('created_at', [$dateFrom, $dateTo])
            ->selectRaw('feedback, count(*) as count')
            ->groupBy('feedback')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'active_students' => $activeStudents,
                'top_interests' => $topInterests,
                'most_saved' => $mostSaved,
                'recommendation_interactions' => $recommendationInteractions,
            ],
        ]);
    }

    public function aiCatalogingReport(Request $request)
    {
        $this->authorize('librarian');

        $dateFrom = $request->get('date_from', Carbon::now()->subMonth()->toDateString());
        $dateTo = $request->get('date_to', Carbon::now()->toDateString());

        $query = AiCatalogJob::whereBetween('created_at', [$dateFrom, $dateTo]);

        $jobs = $query->orderBy('created_at', 'desc')->paginate(50);

        $summary = [
            'total_processed' => AiCatalogJob::whereBetween('created_at', [$dateFrom, $dateTo])->count(),
            'by_status' => AiCatalogJob::whereBetween('created_at', [$dateFrom, $dateTo])
                ->selectRaw('status, count(*) as count')
                ->groupBy('status')
                ->get(),
            'successful_identification' => AiCatalogJob::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'confirmed')
                ->count(),
            'requiring_manual_correction' => AiCatalogJob::whereBetween('created_at', [$dateFrom, $dateTo])
                ->whereIn('status', ['needs_review', 'draft'])
                ->count(),
            'failed' => AiCatalogJob::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'failed')
                ->count(),
            'avg_confidence' => AiCatalogJob::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', '!=', 'failed')
                ->avg('confidence'),
            'correction_details' => AiCatalogJob::whereBetween('created_at', [$dateFrom, $dateTo])
                ->where('status', 'confirmed')
                ->with('reviewedBy')
                ->get(['id', 'extracted_metadata', 'final_metadata', 'confidence', 'reviewed_by', 'created_at']),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'jobs' => $jobs,
                'summary' => $summary,
            ],
        ]);
    }
}