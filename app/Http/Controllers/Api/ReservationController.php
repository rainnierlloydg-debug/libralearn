<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Notification;
use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class ReservationController extends Controller
{
    public function index(Request $request)
    {
        $query = Reservation::with(['student', 'book', 'approvedBy']);

        if ($request->user()->isStudent()) {
            $query->where('student_id', $request->user()->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $query->orderBy('created_at', 'desc');

        $perPage = min($request->get('per_page', 20), 100);
        $reservations = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $reservations,
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

        if (!in_array($book->status, ['borrowed', 'reserved', 'overdue'])) {
            return response()->json([
                'success' => false,
                'message' => 'This book is available for immediate borrowing',
            ], 422);
        }

        // Check if student already has a reservation for this book
        $existingReservation = Reservation::where('student_id', $request->user()->id)
            ->where('book_id', $book->id)
            ->whereIn('status', ['pending', 'approved', 'ready_for_pickup'])
            ->exists();

        if ($existingReservation) {
            return response()->json([
                'success' => false,
                'message' => 'You already have an active reservation for this book',
            ], 422);
        }

        $reservation = Reservation::create([
            'student_id' => $request->user()->id,
            'book_id' => $book->id,
            'reservation_date' => now(),
            'status' => 'pending',
        ]);

        // Notify librarians
        $librarians = \App\Models\User::whereIn('role', ['librarian', 'admin'])->get();
        foreach ($librarians as $librarian) {
            Notification::createForUser(
                $librarian->id,
                'New Reservation Request',
                "{$request->user()->name} reserved \"{$book->title}\"",
                'reservation_request',
                ['reservation_id' => $reservation->id, 'book_id' => $book->id]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Reservation request submitted successfully',
            'data' => $reservation->load(['student', 'book']),
        ], 201);
    }

    public function approve(Request $request, $id)
    {
        $this->authorize('librarian');

        $reservation = Reservation::with(['book', 'student'])->findOrFail($id);

        if ($reservation->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This reservation has already been processed',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'pickup_deadline_days' => 'nullable|integer|min:1|max:14',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $pickupDays = $request->get('pickup_deadline_days', 3);
        $pickupDeadline = Carbon::now()->addDays($pickupDays);

        $reservation->update([
            'status' => 'ready_for_pickup',
            'approved_date' => now(),
            'pickup_deadline' => $pickupDeadline,
            'approved_by' => $request->user()->id,
        ]);

        $reservation->book->update(['status' => 'reserved']);

        // Notify student
        Notification::createForUser(
            $reservation->student_id,
            'Reservation Ready for Pickup',
            "Your reservation for \"{$reservation->book->title}\" is ready for pickup. Please collect it by {$pickupDeadline->format('M d, Y')}.",
            'reservation_ready',
            ['reservation_id' => $reservation->id, 'book_id' => $reservation->book_id, 'pickup_deadline' => $pickupDeadline->toDateString()]
        );

        return response()->json([
            'success' => true,
            'message' => 'Reservation approved and ready for pickup',
            'data' => $reservation->load(['student', 'book']),
        ]);
    }

    public function reject(Request $request, $id)
    {
        $this->authorize('librarian');

        $reservation = Reservation::with(['book', 'student'])->findOrFail($id);

        if ($reservation->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This reservation has already been processed',
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

        $reservation->update([
            'status' => 'cancelled',
            'approved_by' => $request->user()->id,
            'notes' => $request->reason,
        ]);

        // Notify student
        Notification::createForUser(
            $reservation->student_id,
            'Reservation Declined',
            "Your reservation for \"{$reservation->book->title}\" was declined. " . ($request->reason ? "Reason: {$request->reason}" : ''),
            'reservation_rejected',
            ['reservation_id' => $reservation->id, 'book_id' => $reservation->book_id]
        );

        return response()->json([
            'success' => true,
            'message' => 'Reservation rejected',
            'data' => $reservation->load(['student', 'book']),
        ]);
    }

    public function complete(Request $request, $id)
    {
        $this->authorize('librarian');

        $reservation = Reservation::with(['book', 'student'])->findOrFail($id);

        if ($reservation->status !== 'ready_for_pickup') {
            return response()->json([
                'success' => false,
                'message' => 'Reservation is not ready for pickup',
            ], 422);
        }

        $reservation->update([
            'status' => 'completed',
        ]);

        $reservation->book->update(['status' => 'borrowed']);

        // Create a borrow transaction for this
        $loanPeriod = config('library.loan_period_days', 14);
        $dueDate = Carbon::now()->addDays($loanPeriod);

        $transaction = \App\Models\BorrowTransaction::create([
            'student_id' => $reservation->student_id,
            'book_id' => $reservation->book_id,
            'request_date' => $reservation->reservation_date,
            'approval_date' => $reservation->approved_date,
            'borrow_date' => now(),
            'due_date' => $dueDate,
            'status' => 'borrowed',
            'approved_by' => $reservation->approved_by,
        ]);

        // Notify student
        Notification::createForUser(
            $reservation->student_id,
            'Reservation Completed',
            "Your reservation for \"{$reservation->book->title}\" has been completed. Due date: {$dueDate->format('M d, Y')}",
            'reservation_completed',
            ['reservation_id' => $reservation->id, 'book_id' => $reservation->book_id, 'transaction_id' => $transaction->id]
        );

        return response()->json([
            'success' => true,
            'message' => 'Reservation completed and book borrowed',
            'data' => $reservation->load(['student', 'book']),
        ]);
    }

    public function cancel(Request $request, $id)
    {
        $reservation = Reservation::with(['book'])->findOrFail($id);

        // Student can cancel their own reservation, librarian can cancel any
        if ($reservation->student_id !== $request->user()->id && !$request->user()->isLibrarian()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        if (!in_array($reservation->status, ['pending', 'approved', 'ready_for_pickup'])) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot cancel reservation in current status',
            ], 422);
        }

        $reservation->update(['status' => 'cancelled']);

        // If it was the only reservation, update book status
        $otherReservations = Reservation::where('book_id', $reservation->book_id)
            ->whereIn('status', ['pending', 'approved', 'ready_for_pickup'])
            ->exists();

        if (!$otherReservations) {
            $reservation->book->update(['status' => 'available']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Reservation cancelled',
            'data' => $reservation->load(['student', 'book']),
        ]);
    }

    public function expireOldReservations()
    {
        $this->authorize('librarian');

        $expiredReservations = Reservation::where('status', 'ready_for_pickup')
            ->where('pickup_deadline', '<', now())
            ->get();

        foreach ($expiredReservations as $reservation) {
            $reservation->update(['status' => 'expired']);

            $otherReservations = Reservation::where('book_id', $reservation->book_id)
                ->whereIn('status', ['pending', 'approved', 'ready_for_pickup'])
                ->exists();

            if (!$otherReservations) {
                $reservation->book->update(['status' => 'available']);
            }

            // Notify student
            Notification::createForUser(
                $reservation->student_id,
                'Reservation Expired',
                "Your reservation for \"{$reservation->book->title}\" has expired.",
                'reservation_expired',
                ['reservation_id' => $reservation->id, 'book_id' => $reservation->book_id]
            );
        }

        return response()->json([
            'success' => true,
            'message' => "Expired {$expiredReservations->count()} reservations",
            'data' => $expiredReservations->count(),
        ]);
    }
}