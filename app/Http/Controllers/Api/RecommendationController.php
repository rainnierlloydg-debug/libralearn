<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Interest;
use App\Models\RecommendationFeedback;
use App\Models\SavedBook;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RecommendationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $limit = min($request->get('limit', 10), 50);

        // Get user's interests
        $userInterestIds = $user->interests->pluck('id')->toArray();
        $userGenreIds = Interest::whereIn('id', $userInterestIds)->where('type', 'genre')->pluck('id')->toArray();
        $userSubjectIds = Interest::whereIn('id', $userInterestIds)->where('type', 'subject')->pluck('id')->toArray();

        // Get user's borrowing history
        $borrowedBookIds = $user->borrowedBooks()
            ->whereIn('status', ['borrowed', 'returned'])
            ->pluck('book_id')
            ->toArray();

        // Get saved books
        $savedBookIds = $user->savedBooks()->pluck('book_id')->toArray();

        // Get feedback
        $likedBookIds = $user->recommendationFeedback()
            ->where('feedback', 'like')
            ->pluck('book_id')
            ->toArray();

        $dislikedBookIds = $user->recommendationFeedback()
            ->where('feedback', 'not_interested')
            ->pluck('book_id')
            ->toArray();

        // Exclude already borrowed, saved, and disliked books
        $excludeIds = array_unique(array_merge($borrowedBookIds, $savedBookIds, $dislikedBookIds));

        // Build query for available books
        $query = Book::with(['libraryLocation', 'categories'])
            ->where('status', 'available')
            ->where('source', 'gsa')
            ->whereNotIn('id', $excludeIds);

        // If user has interests, prioritize matching books
        if (!empty($userGenreIds) || !empty($userSubjectIds)) {
            $query->where(function ($q) use ($userGenreIds, $userSubjectIds) {
                if (!empty($userGenreIds)) {
                    $q->whereIn('genre', Interest::whereIn('id', $userGenreIds)->pluck('name'));
                }
                if (!empty($userSubjectIds)) {
                    $q->orWhereIn('subject', Interest::whereIn('id', $userSubjectIds)->pluck('name'));
                }
            });
        }

        // Get more books than needed for scoring
        $candidateBooks = $query->limit(100)->get();

        // Score each book
        $scoredBooks = $candidateBooks->map(function ($book) use (
            $userGenreIds,
            $userSubjectIds,
            $borrowedBookIds,
            $savedBookIds,
            $likedBookIds,
            $userInterestIds
        ) {
            $score = 0;
            $reasons = [];

            // Genre match
            $bookGenre = Interest::where('name', $book->genre)->where('type', 'genre')->first();
            if ($bookGenre && in_array($bookGenre->id, $userGenreIds)) {
                $score += 10;
                $reasons[] = "Matches your interest in {$book->genre}";
            }

            // Subject match
            $bookSubject = Interest::where('name', $book->subject)->where('type', 'subject')->first();
            if ($bookSubject && in_array($bookSubject->id, $userSubjectIds)) {
                $score += 8;
                $reasons[] = "Matches your interest in {$book->subject}";
            }

            // Previously liked similar books
            if (in_array($book->id, $likedBookIds)) {
                $score += 15;
                $reasons[] = "Similar to books you liked";
            }

            // Saved similar books (check genre/subject match with saved books)
            $savedBooks = Book::whereIn('id', $savedBookIds)->get(['genre', 'subject']);
            foreach ($savedBooks as $savedBook) {
                if ($savedBook->genre === $book->genre) {
                    $score += 5;
                    $reasons[] = "Similar genre to your saved books";
                    break;
                }
                if ($savedBook->subject === $book->subject) {
                    $score += 3;
                    $reasons[] = "Similar subject to your saved books";
                    break;
                }
            }

            // Borrowing history genre/subject match
            $borrowedBooks = Book::whereIn('id', $borrowedBookIds)->get(['genre', 'subject']);
            foreach ($borrowedBooks as $borrowedBook) {
                if ($borrowedBook->genre === $book->genre) {
                    $score += 3;
                    $reasons[] = "Similar to your borrowed books";
                    break;
                }
                if ($borrowedBook->subject === $book->subject) {
                    $score += 2;
                    $reasons[] = "Similar to your borrowed books";
                    break;
                }
            }

            // Boost newer books slightly
            if ($book->publication_date && $book->publication_date->gt(now()->subYears(5))) {
                $score += 1;
            }

            $book->relevance_score = $score;
            $book->recommendation_reasons = array_unique($reasons);
            return $book;
        })->sortByDesc('relevance_score')
          ->values()
          ->take($limit);

        // Add explanation to each book
        $recommendations = $scoredBooks->map(function ($book) {
            $book->why_recommended = $book->recommendation_reasons && count($book->recommendation_reasons) > 0
                ? implode('; ', $book->recommendation_reasons)
                : 'Popular in your library';
            return $book;
        });

        return response()->json([
            'success' => true,
            'data' => $recommendations,
        ]);
    }

    public function feedback(Request $request, $bookId)
    {
        $validator = Validator::make($request->all(), [
            'feedback' => 'required|in:like,not_interested',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $book = Book::findOrFail($bookId);
        $user = $request->user();

        $feedback = RecommendationFeedback::updateOrCreate(
            ['student_id' => $user->id, 'book_id' => $bookId],
            ['feedback' => $request->feedback]
        );

        return response()->json([
            'success' => true,
            'message' => 'Feedback recorded successfully',
            'data' => $feedback,
        ]);
    }

    public function getFeedback(Request $request, $bookId)
    {
        $feedback = RecommendationFeedback::where('student_id', $request->user()->id)
            ->where('book_id', $bookId)
            ->first();

        return response()->json([
            'success' => true,
            'data' => $feedback,
        ]);
    }

    public function getUserInterests(Request $request)
    {
        $interests = $request->user()->interests;

        return response()->json([
            'success' => true,
            'data' => $interests,
        ]);
    }

    public function updateInterests(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'interest_ids' => 'required|array',
            'interest_ids.*' => 'exists:interests,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $request->user()->interests()->sync($request->interest_ids);

        return response()->json([
            'success' => true,
            'message' => 'Interests updated successfully',
            'data' => $request->user()->load('interests'),
        ]);
    }
}