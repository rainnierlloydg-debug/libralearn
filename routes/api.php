<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookController;
use App\Http\Controllers\Api\BorrowController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\RecommendationController;
use App\Http\Controllers\Api\AiCatalogController;
use App\Http\Controllers\Api\OnlineSearchController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\LibraryLocationController;
use App\Http\Controllers\Api\InterestController;
use App\Http\Controllers\Api\StudentAssistantController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);

    // Books
    Route::get('/books', [BookController::class, 'index']);
    Route::get('/books/genres', [BookController::class, 'genres']);
    Route::get('/books/subjects', [BookController::class, 'subjects']);
    Route::get('/books/available', [BookController::class, 'getAvailableForBorrowing']);
    Route::get('/books/{id}', [BookController::class, 'show']);
    Route::post('/books', [BookController::class, 'store'])->middleware('role:librarian,admin');
    Route::put('/books/{id}', [BookController::class, 'update'])->middleware('role:librarian,admin');
    Route::delete('/books/{id}', [BookController::class, 'destroy'])->middleware('role:librarian,admin');
    Route::post('/books/upload-cover', [BookController::class, 'uploadCover'])->middleware('role:librarian,admin');

    // Borrowing
    Route::get('/borrow', [BorrowController::class, 'index']);
    Route::post('/borrow', [BorrowController::class, 'store']);
    Route::post('/borrow/{id}/approve', [BorrowController::class, 'approve'])->middleware('role:librarian,admin');
    Route::post('/borrow/{id}/reject', [BorrowController::class, 'reject'])->middleware('role:librarian,admin');
    Route::post('/borrow/{id}/request-return', [BorrowController::class, 'requestReturn']);
    Route::post('/borrow/{id}/confirm-return', [BorrowController::class, 'confirmReturn'])->middleware('role:librarian,admin');
    Route::post('/borrow/{id}/extend', [BorrowController::class, 'extend'])->middleware('role:librarian,admin');
    Route::post('/borrow/{id}/mark-overdue', [BorrowController::class, 'markOverdue'])->middleware('role:librarian,admin');

    // Reservations
    Route::get('/reservations', [ReservationController::class, 'index']);
    Route::post('/reservations', [ReservationController::class, 'store']);
    Route::post('/reservations/{id}/approve', [ReservationController::class, 'approve'])->middleware('role:librarian,admin');
    Route::post('/reservations/{id}/reject', [ReservationController::class, 'reject'])->middleware('role:librarian,admin');
    Route::post('/reservations/{id}/complete', [ReservationController::class, 'complete'])->middleware('role:librarian,admin');
    Route::post('/reservations/{id}/cancel', [ReservationController::class, 'cancel']);
    Route::post('/reservations/expire-old', [ReservationController::class, 'expireOldReservations'])->middleware('role:librarian,admin');

    // Recommendations
    Route::get('/recommendations', [RecommendationController::class, 'index']);
    Route::post('/recommendations/{bookId}/feedback', [RecommendationController::class, 'feedback']);
    Route::get('/recommendations/{bookId}/feedback', [RecommendationController::class, 'getFeedback']);
    Route::get('/recommendations/interests', [RecommendationController::class, 'getUserInterests']);
    Route::put('/recommendations/interests', [RecommendationController::class, 'updateInterests']);

    // AI Cataloging
    Route::get('/ai-catalog', [AiCatalogController::class, 'index'])->middleware('role:librarian,admin');
    Route::post('/ai-catalog', [AiCatalogController::class, 'store'])->middleware('role:librarian,admin');
    Route::get('/ai-catalog/{id}', [AiCatalogController::class, 'show'])->middleware('role:librarian,admin');
    Route::post('/ai-catalog/{id}/confirm', [AiCatalogController::class, 'confirm'])->middleware('role:librarian,admin');
    Route::post('/ai-catalog/{id}/draft', [AiCatalogController::class, 'saveDraft'])->middleware('role:librarian,admin');
    Route::post('/ai-catalog/{id}/retry', [AiCatalogController::class, 'retry'])->middleware('role:librarian,admin');
    Route::delete('/ai-catalog/{id}', [AiCatalogController::class, 'destroy'])->middleware('role:librarian,admin');

    // Online Search
    Route::post('/online-search', [OnlineSearchController::class, 'search']);
    Route::get('/online-search/history', [OnlineSearchController::class, 'getHistory']);

    // Student assistant
    Route::post('/assistant/chat', [StudentAssistantController::class, 'chat'])
        ->middleware(['role:student', 'throttle:20,1']);

    // Dashboard
    Route::get('/dashboard/student', [DashboardController::class, 'student']);
    Route::get('/dashboard/librarian', [DashboardController::class, 'librarian'])->middleware('role:librarian,admin');

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'getUnreadCount']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // Reports (Librarian only)
    Route::get('/reports/books', [ReportController::class, 'bookReport'])->middleware('role:librarian,admin');
    Route::get('/reports/borrowing', [ReportController::class, 'borrowingReport'])->middleware('role:librarian,admin');
    Route::get('/reports/student-activity', [ReportController::class, 'studentActivityReport'])->middleware('role:librarian,admin');
    Route::get('/reports/ai-cataloging', [ReportController::class, 'aiCatalogingReport'])->middleware('role:librarian,admin');

    // Users (Librarian only)
    Route::get('/users', [UserController::class, 'index'])->middleware('role:librarian,admin');
    Route::post('/users', [UserController::class, 'store'])->middleware('role:librarian,admin');
    Route::get('/users/{id}', [UserController::class, 'show'])->middleware('role:librarian,admin');
    Route::put('/users/{id}', [UserController::class, 'update'])->middleware('role:librarian,admin');
    Route::delete('/users/{id}', [UserController::class, 'destroy'])->middleware('role:librarian,admin');
    Route::get('/users/{id}/details', [UserController::class, 'getDetails'])->middleware('role:librarian,admin');

    // Library Locations
    Route::get('/library-locations', [LibraryLocationController::class, 'index']);
    Route::get('/library-locations/map', [LibraryLocationController::class, 'mapData']);
    Route::get('/library-locations/section/{sectionName}/books', [LibraryLocationController::class, 'getSectionBooks']);
    Route::post('/library-locations', [LibraryLocationController::class, 'store'])->middleware('role:librarian,admin');
    Route::put('/library-locations/{id}', [LibraryLocationController::class, 'update'])->middleware('role:librarian,admin');
    Route::delete('/library-locations/{id}', [LibraryLocationController::class, 'destroy'])->middleware('role:librarian,admin');

    // Interests
    Route::get('/interests', [InterestController::class, 'index']);
    Route::post('/interests', [InterestController::class, 'store'])->middleware('role:librarian,admin');
    Route::put('/interests/{id}', [InterestController::class, 'update'])->middleware('role:librarian,admin');
    Route::delete('/interests/{id}', [InterestController::class, 'destroy'])->middleware('role:librarian,admin');
});
