<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\Notification;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function student(Request $request)
    {
        $user = $request->user();

        // Current borrowed books
        $borrowedBooks = BorrowTransaction::with('book.libraryLocation')
            ->where('student_id', $user->id)
            ->where('status', 'borrowed')
            ->orderBy('due_date')
            ->get();

        // Upcoming due dates (within 7 days)
        $upcomingDue = $borrowedBooks->filter(function ($t) {
            return $t->due_date && $t->due_date->diffInDays(now(), false) <= 7 && !$t->isOverdue();
        })->values();

        // Overdue books
        $overdueBooks = $borrowedBooks->filter(function ($t) {
            return $t->isOverdue();
        })->values();

        // Reservations
        $reservations = Reservation::with('book.libraryLocation')
            ->where('student_id', $user->id)
            ->whereIn('status', ['pending', 'approved', 'ready_for_pickup'])
            ->orderBy('created_at', 'desc')
            ->get();

        // Saved books
        $savedBooks = $user->savedBooks()->with('book.libraryLocation')->latest()->limit(5)->get();

        // Recent notifications
        $notifications = Notification::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        // Recommendations
        $recommendations = $this->getRecommendations($user, 5);

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $user->load('interests'),
                'borrowed_books' => $borrowedBooks,
                'upcoming_due' => $upcomingDue,
                'overdue_books' => $overdueBooks,
                'reservations' => $reservations,
                'saved_books' => $savedBooks,
                'notifications' => $notifications,
                'recommendations' => $recommendations,
                'stats' => [
                    'currently_borrowed' => $borrowedBooks->count(),
                    'overdue_count' => $overdueBooks->count(),
                    'pending_reservations' => $reservations->where('status', 'pending')->count(),
                    'ready_for_pickup' => $reservations->where('status', 'ready_for_pickup')->count(),
                    'unread_notifications' => $notifications->where('read_status', false)->count(),
                ],
            ],
        ]);
    }

    public function librarian(Request $request)
    {
        $this->authorize('librarian');

        // Statistics
        $stats = [
            'total_books' => Book::where('source', 'gsa')->count(),
            'available_books' => Book::where('source', 'gsa')->where('status', 'available')->count(),
            'borrowed_books' => Book::where('source', 'gsa')->where('status', 'borrowed')->count(),
            'reserved_books' => Book::where('source', 'gsa')->where('status', 'reserved')->count(),
            'overdue_books' => Book::where('source', 'gsa')->where('status', 'overdue')->count(),
            'lost_books' => Book::where('source', 'gsa')->where('status', 'lost')->count(),
            'damaged_books' => Book::where('source', 'gsa')->where('status', 'damaged')->count(),
            'registered_students' => User::where('role', 'student')->where('status', 'active')->count(),
            'pending_borrow_requests' => BorrowTransaction::where('status', 'pending')->count(),
            'pending_reservations' => Reservation::where('status', 'pending')->count(),
            'pending_return_confirmations' => BorrowTransaction::where('status', 'return_requested')->count(),
        ];

        // Recent books added
        $recentBooks = Book::where('source', 'gsa')
            ->with('libraryLocation')
            ->latest()
            ->limit(10)
            ->get();

        // Overdue transactions
        $overdueTransactions = BorrowTransaction::with(['student', 'book'])
            ->where('status', 'overdue')
            ->orderBy('due_date')
            ->limit(10)
            ->get();

        // Pending borrow requests
        $pendingBorrows = BorrowTransaction::with(['student', 'book'])
            ->where('status', 'pending')
            ->orderBy('request_date')
            ->limit(10)
            ->get();

        // Pending reservations
        $pendingReservations = Reservation::with(['student', 'book'])
            ->where('status', 'pending')
            ->orderBy('reservation_date')
            ->limit(10)
            ->get();

        // Books by genre (for chart)
        $booksByGenre = Book::where('source', 'gsa')
            ->selectRaw('genre, count(*) as count')
            ->groupBy('genre')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        // Borrowing trend (last 30 days)
        $borrowingTrend = BorrowTransaction::where('borrow_date', '>=', Carbon::now()->subDays(30))
            ->selectRaw('DATE(borrow_date) as date, count(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Most borrowed books
        $mostBorrowed = Book::where('source', 'gsa')
            ->withCount(['borrowTransactions as borrow_count' => function ($q) {
                $q->whereIn('status', ['borrowed', 'returned']);
            }])
            ->orderByDesc('borrow_count')
            ->limit(10)
            ->get(['id', 'title', 'author', 'cover_image', 'borrow_count']);

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'recent_books' => $recentBooks,
                'overdue_transactions' => $overdueTransactions,
                'pending_borrows' => $pendingBorrows,
                'pending_reservations' => $pendingReservations,
                'books_by_genre' => $booksByGenre,
                'borrowing_trend' => $borrowingTrend,
                'most_borrowed' => $mostBorrowed,
            ],
        ]);
    }

    protected function getRecommendations($user, $limit = 5)
    {
        $userInterestIds = $user->interests->pluck('id')->toArray();
        $userGenreIds = \App\Models\Interest::whereIn('id', $userInterestIds)->where('type', 'genre')->pluck('id')->toArray();
        $userSubjectIds = \App\Models\Interest::whereIn('id', $userInterestIds)->where('type', 'subject')->pluck('id')->toArray();

        $borrowedBookIds = $user->borrowedBooks()
            ->whereIn('status', ['borrowed', 'returned'])
            ->pluck('book_id')
            ->toArray();

        $savedBookIds = $user->savedBooks()->pluck('book_id')->toArray();
        $dislikedBookIds = $user->recommendationFeedback()
            ->where('feedback', 'not_interested')
            ->pluck('book_id')
            ->toArray();

        $excludeIds = array_unique(array_merge($borrowedBookIds, $savedBookIds, $dislikedBookIds));

        $query = Book::with(['libraryLocation'])
            ->where('status', 'available')
            ->where('source', 'gsa')
            ->whereNotIn('id', $excludeIds);

        if (!empty($userGenreIds) || !empty($userSubjectIds)) {
            $query->where(function ($q) use ($userGenreIds, $userSubjectIds) {
                if (!empty($userGenreIds)) {
                    $q->whereIn('genre', \App\Models\Interest::whereIn('id', $userGenreIds)->pluck('name'));
                }
                if (!empty($userSubjectIds)) {
                    $q->orWhereIn('subject', \App\Models\Interest::whereIn('id', $userSubjectIds)->pluck('name'));
                }
            });
        }

        return $query->limit($limit)->get();
    }
}