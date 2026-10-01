<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class BorrowController extends Controller
{
    public function index(Request $request)
    {
        $query = BorrowTransaction::with(['student', 'book', 'approvedBy', 'returnConfirmedBy']);

        // Role-based filtering
        if ($request->user()->isStudent()) {
            $query->where('student_id', $request->user()->id);
        }

        // Filters
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('student_id') && $request->user()->isLibrarian()) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->filled('book_id')) {
            $query->where('book_id', $request->book_id);
        }

        $query->orderBy('created_at', 'desc');

        $perPage = min($request->get('per_page', 20), 100);
        $transactions = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $transactions,
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'book_id' => 'required|exists:books,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $book = Book::findOrFail($request->book_id);

        if ($book->status !== 'available') {
            return response()->json([
                'success' => false,
                'message' => 'This book is not available for borrowing',
            ], 422);
        }

        // Check if student already has a pending/approved request for this book
        $existingRequest = BorrowTransaction::where('student_id', $request->user()->id)
            ->where('book_id', $book->id)
            ->whereIn('status', ['pending', 'approved', 'borrowed'])
            ->exists();

        if ($existingRequest) {
            return response()->json([
                'success' => false,
                'message' => 'You already have an active request for this book',
            ], 422);
        }

        $transaction = BorrowTransaction::create([
            'student_id' => $request->user()->id,
            'book_id' => $book->id,
            'request_date' => now(),
            'status' => 'pending',
        ]);

        // Notify librarians
        $librarians = \App\Models\User::whereIn('role', ['librarian', 'admin'])->get();
        foreach ($librarians as $librarian) {
            Notification::createForUser(
                $librarian->id,
                'New Borrowing Request',
                "{$request->user()->name} requested to borrow \"{$book->title}\"",
                'borrow_request',
                ['transaction_id' => $transaction->id, 'book_id' => $book->id]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Borrowing request submitted successfully',
            'data' => $transaction->load(['student', 'book']),
        ], 201);
    }

    public function approve(Request $request, $id)
    {
        $this->authorize('librarian');

        $transaction = BorrowTransaction::with(['book', 'student'])->findOrFail($id);

        if ($transaction->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This request has already been processed',
            ], 422);
        }

        $book = $transaction->book;

        if ($book->status !== 'available') {
            return response()->json([
                'success' => false,
                'message' => 'Book is no longer available',
            ], 422);
        }

        $loanPeriod = config('library.loan_period_days', 14);
        $dueDate = Carbon::now()->addDays($loanPeriod);

        $transaction->update([
            'approval_date' => now(),
            'borrow_date' => now(),
            'due_date' => $dueDate,
            'status' => 'borrowed',
            'approved_by' => $request->user()->id,
        ]);

        $book->update(['status' => 'borrowed']);

        // Notify student
        Notification::createForUser(
            $transaction->student_id,
            'Borrowing Request Approved',
            "Your request to borrow \"{$book->title}\" has been approved. Due date: {$dueDate->format('M d, Y')}",
            'borrow_approved',
            ['transaction_id' => $transaction->id, 'book_id' => $book->id, 'due_date' => $dueDate->toDateString()]
        );

        return response()->json([
            'success' => true,
            'message' => 'Borrowing request approved',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }

    public function reject(Request $request, $id)
    {
        $this->authorize('librarian');

        $transaction = BorrowTransaction::with(['book', 'student'])->findOrFail($id);

        if ($transaction->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This request has already been processed',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $transaction->update([
            'status' => 'rejected',
            'approved_by' => $request->user()->id,
            'notes' => $request->reason,
        ]);

        // Notify student
        Notification::createForUser(
            $transaction->student_id,
            'Borrowing Request Declined',
            "Your request to borrow \"{$transaction->book->title}\" was declined. " . ($request->reason ? "Reason: {$request->reason}" : ''),
            'borrow_rejected',
            ['transaction_id' => $transaction->id, 'book_id' => $transaction->book_id]
        );

        return response()->json([
            'success' => true,
            'message' => 'Borrowing request rejected',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }

    public function requestReturn(Request $request, $id)
    {
        $transaction = BorrowTransaction::with(['book'])->findOrFail($id);

        // Only the student who borrowed it can request return
        if ($transaction->student_id !== $request->user()->id && !$request->user()->isLibrarian()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        if ($transaction->status !== 'borrowed') {
            return response()->json([
                'success' => false,
                'message' => 'This book is not currently borrowed',
            ], 422);
        }

        $transaction->update([
            'return_request_date' => now(),
            'status' => 'return_requested',
        ]);

        // Notify librarians
        $librarians = \App\Models\User::whereIn('role', ['librarian', 'admin'])->get();
        foreach ($librarians as $librarian) {
            Notification::createForUser(
                $librarian->id,
                'Return Request',
                "{$transaction->student->name} requested to return \"{$transaction->book->title}\"",
                'return_request',
                ['transaction_id' => $transaction->id, 'book_id' => $transaction->book_id]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Return request submitted. Please bring the book to the library.',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }

    public function confirmReturn(Request $request, $id)
    {
        $this->authorize('librarian');

        $transaction = BorrowTransaction::with(['book', 'student'])->findOrFail($id);

        if (!in_array($transaction->status, ['borrowed', 'return_requested', 'overdue'])) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid transaction status for return',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'condition' => 'nullable|in:good,damaged,lost',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $condition = $request->get('condition', 'good');
        $book = $transaction->book;

        if ($condition === 'lost') {
            $book->update(['status' => 'lost']);
            $transaction->update(['status' => 'lost']);
        } elseif ($condition === 'damaged') {
            $book->update(['status' => 'damaged']);
            $transaction->update(['status' => 'damaged']);
        } else {
            $book->update(['status' => 'available']);
            $transaction->update([
                'return_date' => now(),
                'status' => 'returned',
                'return_confirmed_by' => $request->user()->id,
            ]);
        }

        // Notify student
        Notification::createForUser(
            $transaction->student_id,
            'Return Confirmed',
            "Your return of \"{$book->title}\" has been confirmed. " . ($condition !== 'good' ? "Book condition noted as: {$condition}" : 'Thank you!'),
            'return_confirmed',
            ['transaction_id' => $transaction->id, 'book_id' => $book->id, 'condition' => $condition]
        );

        return response()->json([
            'success' => true,
            'message' => 'Return confirmed successfully',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }

    public function extend(Request $request, $id)
    {
        $this->authorize('librarian');

        $transaction = BorrowTransaction::with(['book', 'student'])->findOrFail($id);

        if ($transaction->status !== 'borrowed') {
            return response()->json([
                'success' => false,
                'message' => 'Can only extend currently borrowed books',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'additional_days' => 'required|integer|min:1|max:30',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $additionalDays = $request->additional_days;
        $newDueDate = $transaction->due_date->copy()->addDays($additionalDays);

        $transaction->update(['due_date' => $newDueDate]);

        // Notify student
        Notification::createForUser(
            $transaction->student_id,
            'Due Date Extended',
            "The due date for \"{$transaction->book->title}\" has been extended to {$newDueDate->format('M d, Y')}",
            'due_extended',
            ['transaction_id' => $transaction->id, 'book_id' => $transaction->book_id, 'due_date' => $newDueDate->toDateString()]
        );

        return response()->json([
            'success' => true,
            'message' => 'Due date extended successfully',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }

    public function markOverdue(Request $request, $id)
    {
        $this->authorize('librarian');

        $transaction = BorrowTransaction::with(['book', 'student'])->findOrFail($id);

        if ($transaction->status !== 'borrowed') {
            return response()->json([
                'success' => false,
                'message' => 'Can only mark borrowed books as overdue',
            ], 422);
        }

        $transaction->update(['status' => 'overdue']);
        $transaction->book->update(['status' => 'overdue']);

        // Notify student
        Notification::createForUser(
            $transaction->student_id,
            'Book Overdue',
            "\"{$transaction->book->title}\" is now overdue. Please return it as soon as possible.",
            'overdue',
            ['transaction_id' => $transaction->id, 'book_id' => $transaction->book_id]
        );

        return response()->json([
            'success' => true,
            'message' => 'Book marked as overdue',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }
}