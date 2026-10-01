<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Reservation extends Model
{
    protected $fillable = [
        'student_id',
        'book_id',
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

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isExpired(): bool
    {
        if ($this->status !== 'ready_for_pickup' || !$this->pickup_deadline) {
            return false;
        }
        return now()->gt($this->pickup_deadline);
    }
}