<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Reservation extends Model
{
    protected $fillable = [
        'student_id',
        'book_id',
        'book_copy_id',
        'reservation_date',
        'status',
        'approved_date',
        'pickup_deadline',
        'approved_by',
        'notes',
    ];

    protected $casts = [
        'reservation_date' => 'datetime',
        'approved_date' => 'datetime',
        'pickup_deadline' => 'datetime',
        'status' => 'string',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function book()
    {
        return $this->belongsTo(Book::class);
    }

    public function bookCopy()
    {
        return $this->belongsTo(BookCopy::class);
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Expire a held reservation past its pickup deadline: release the
     * copy and tell the student.
     */
    public function expire(): void
    {
        $this->update(['status' => 'expired']);
        $this->releaseHeldCopy();

        Notification::createForUser(
            $this->student_id,
            'Reservation Expired',
            "Your reservation for \"{$this->book->title}\" has expired.",
            'reservation_expired',
            ['reservation_id' => $this->id, 'book_id' => $this->book_id]
        );
    }

    /**
     * Put the copy held for this reservation back on the shelf.
     */
    public function releaseHeldCopy(): void
    {
        $copy = $this->bookCopy;

        if ($copy && $copy->status === 'reserved') {
            $copy->update(['status' => 'available']);

            return;
        }

        // Reservations made before copies existed.
        if (!$copy) {
            $stillOpen = static::where('book_id', $this->book_id)
                ->whereIn('status', ['pending', 'approved', 'ready_for_pickup'])
                ->exists();

            if (!$stillOpen) {
                $this->book->update(['status' => 'available']);
            }
        }
    }

    public function isExpired(): bool
    {
        if ($this->status !== 'ready_for_pickup' || !$this->pickup_deadline) {
            return false;
        }
        return now()->gt($this->pickup_deadline);
    }
}