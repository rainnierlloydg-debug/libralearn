<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\Notification;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class BorrowController extends Controller
{
    /** Loans where the student physically has the book. */
    private const OUT_STATUSES = ['borrowed', 'return_requested', 'overdue'];

    /** Out loans plus requests still waiting on the librarian. */
    private const OPEN_STATUSES = ['pending', 'approved', 'borrowed', 'return_requested', 'overdue'];

    public function index(Request $request)
    {
        $query = BorrowTransaction::with(['student', 'book', 'bookCopy', 'approvedBy', 'returnConfirmedBy']);

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

        if ($request->boolean('renewal_requested')) {
            $query->whereNotNull('renewal_requested_at')->where('status', 'borrowed');
        }

        if ($request->boolean('fine_unpaid')) {
            $query->where('fine_amount', '>', 0)->whereNull('fine_paid_at');
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

        if (!$book->firstAvailableCopy()) {
            return response()->json([
                'success' => false,
                'message' => 'This book is not available for borrowing',
            ], 422);
        }

        $maxLoans = (int) config('library.max_active_loans', 3);
        if ($this->activeLoanCount($request->user()->id, self::OPEN_STATUSES) >= $maxLoans) {
            return response()->json([
                'success' => false,
                'message' => "You can have at most {$maxLoans} active loans and requests",
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

        // The librarian may pick the copy being handed out; otherwise use the first one on the shelf.
        $copy = $request->filled('book_copy_id')
            ? $book->copies()->where('status', 'available')->find($request->book_copy_id)
            : $book->firstAvailableCopy();

        if (!$copy) {
            return response()->json([
                'success' => false,
                'message' => 'Book is no longer available',
            ], 422);
        }

        $maxLoans = (int) config('library.max_active_loans', 3);
        if ($this->activeLoanCount($transaction->student_id, self::OUT_STATUSES) >= $maxLoans) {
            return response()->json([
                'success' => false,
                'message' => "Student already has {$maxLoans} books out",
            ], 422);
        }

        $loanPeriod = config('library.loan_days', 3);
        $dueDate = Carbon::now()->addDays($loanPeriod);

        $transaction->update([
            'book_copy_id' => $copy->id,
            'approval_date' => now(),
            'borrow_date' => now(),
            'due_date' => $dueDate,
            'status' => 'borrowed',
            'approved_by' => $request->user()->id,
        ]);

        $copy->update(['status' => 'borrowed']);

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
        $copy = $transaction->bookCopy;

        // The copy carries the physical state; books.status follows from it.
        $setStatus = function (string $status) use ($book, $copy, $condition) {
            if ($copy) {
                $copy->update(['status' => $status, 'condition' => $condition]);
            } else {
                $book->update(['status' => $status]);
            }
        };

        // Late fine is stored on the loan when the book physically comes back.
        $fine = $condition === 'lost' ? null : $this->lateFine($transaction);

        if ($condition === 'lost') {
            $setStatus('lost');
            $transaction->update(['status' => 'lost']);
        } elseif ($condition === 'damaged') {
            $setStatus('damaged');
            $transaction->update(['status' => 'damaged', 'fine_amount' => $fine]);
        } else {
            $setStatus('available');
            $transaction->update([
                'return_date' => now(),
                'status' => 'returned',
                'return_confirmed_by' => $request->user()->id,
                'fine_amount' => $fine,
            ]);
        }

        // Notify student
        Notification::createForUser(
            $transaction->student_id,
            'Return Confirmed',
            "Your return of \"{$book->title}\" has been confirmed. " . ($condition !== 'good' ? "Book condition noted as: {$condition}" : 'Thank you!')
                . ($fine > 0 ? ' Late fine: PHP ' . number_format($fine, 2) . '.' : ''),
            'return_confirmed',
            ['transaction_id' => $transaction->id, 'book_id' => $book->id, 'condition' => $condition]
        );

        return response()->json([
            'success' => true,
            'message' => 'Return confirmed successfully',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }

    /**
     * Student asks for a renewal. The librarian approves it with renew().
     */
    public function requestRenewal(Request $request, $id)
    {
        $transaction = BorrowTransaction::with(['book', 'student'])->findOrFail($id);

        if ($transaction->student_id !== $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        if ($error = $this->renewalBlocker($transaction)) {
            return response()->json(['success' => false, 'message' => $error], 422);
        }

        if ($transaction->renewal_requested_at) {
            return response()->json([
                'success' => false,
                'message' => 'A renewal request is already waiting for the librarian',
            ], 422);
        }

        $transaction->update(['renewal_requested_at' => now()]);

        $librarians = \App\Models\User::whereIn('role', ['librarian', 'admin'])->get();
        foreach ($librarians as $librarian) {
            Notification::createForUser(
                $librarian->id,
                'Renewal Request',
                "{$transaction->student->name} asked to renew \"{$transaction->book->title}\"",
                'renewal_request',
                ['transaction_id' => $transaction->id, 'book_id' => $transaction->book_id]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Renewal request sent to the librarian',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }

    /**
     * Librarian approves a renewal: +renewal_days, at most max_renewals per loan.
     */
    public function renew(Request $request, $id)
    {
        $this->authorize('librarian');

        $transaction = BorrowTransaction::with(['book', 'student'])->findOrFail($id);

        if ($error = $this->renewalBlocker($transaction)) {
            return response()->json(['success' => false, 'message' => $error], 422);
        }

        $newDueDate = $transaction->due_date->copy()->addDays((int) config('library.renewal_days', 1));

        $transaction->update([
            'due_date' => $newDueDate,
            'renewal_count' => $transaction->renewal_count + 1,
            'renewal_requested_at' => null,
        ]);

        Notification::createForUser(
            $transaction->student_id,
            'Loan Renewed',
            "Your loan of \"{$transaction->book->title}\" was renewed. New due date: {$newDueDate->format('M d, Y')}",
            'due_extended',
            ['transaction_id' => $transaction->id, 'book_id' => $transaction->book_id, 'due_date' => $newDueDate->toDateString()]
        );

        return response()->json([
            'success' => true,
            'message' => 'Loan renewed',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }

    public function rejectRenewal(Request $request, $id)
    {
        $this->authorize('librarian');

        $transaction = BorrowTransaction::with(['book'])->findOrFail($id);

        if (!$transaction->renewal_requested_at) {
            return response()->json([
                'success' => false,
                'message' => 'There is no renewal request on this loan',
            ], 422);
        }

        $transaction->update(['renewal_requested_at' => null]);

        Notification::createForUser(
            $transaction->student_id,
            'Renewal Declined',
            "Your renewal request for \"{$transaction->book->title}\" was declined. Please return it by {$transaction->due_date->format('M d, Y')}.",
            'renewal_rejected',
            ['transaction_id' => $transaction->id, 'book_id' => $transaction->book_id]
        );

        return response()->json([
            'success' => true,
            'message' => 'Renewal declined',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }

    /**
     * Older librarian "extend" action. It now follows the renewal rules.
     */
    public function extend(Request $request, $id)
    {
        return $this->renew($request, $id);
    }

    public function markFinePaid(Request $request, $id)
    {
        $this->authorize('librarian');

        $transaction = BorrowTransaction::with(['student', 'book'])->findOrFail($id);

        if (!($transaction->fine_amount > 0)) {
            return response()->json([
                'success' => false,
                'message' => 'This loan has no fine',
            ], 422);
        }

        if ($transaction->fine_paid_at) {
            return response()->json([
                'success' => false,
                'message' => 'This fine is already paid',
            ], 422);
        }

        $transaction->update(['fine_paid_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Fine marked as paid',
            'data' => $transaction,
        ]);
    }

    private function renewalBlocker(BorrowTransaction $transaction): ?string
    {
        if ($transaction->status !== 'borrowed' || !$transaction->due_date) {
            return 'Only books currently on loan can be renewed';
        }

        if ($transaction->due_date->isPast()) {
            return 'Overdue loans cannot be renewed. Please return the book';
        }

        $max = (int) config('library.max_renewals', 1);
        if ($transaction->renewal_count >= $max) {
            return "This loan has already been renewed {$max} time(s)";
        }

        return null;
    }

    private function activeLoanCount(int $studentId, array $statuses): int
    {
        return BorrowTransaction::where('student_id', $studentId)->whereIn('status', $statuses)->count();
    }

    /**
     * Whole days past the due date times the librarian's fine_per_day.
     */
    private function lateFine(BorrowTransaction $transaction): float
    {
        if (!$transaction->due_date) {
            return 0;
        }

        // Count days on the school calendar, same as the due-date reminders.
        $tz = config('library.timezone', 'Asia/Manila');
        $daysLate = (int) $transaction->due_date->copy()->setTimezone($tz)->startOfDay()
            ->diffInDays(now($tz)->startOfDay(), false);

        return $daysLate > 0 ? round($daysLate * Setting::finePerDay(), 2) : 0;
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

        $transaction->markOverdue();

        return response()->json([
            'success' => true,
            'message' => 'Book marked as overdue',
            'data' => $transaction->load(['student', 'book']),
        ]);
    }
}