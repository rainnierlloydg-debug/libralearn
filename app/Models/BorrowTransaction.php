<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BorrowTransaction extends Model
{
    protected $fillable = [
        'student_id',
        'book_id',
        'request_date',
        'approval_date',
        'borrow_date',
        'due_date',
        'return_request_date',
        'return_date',
        'status',
        'approved_by',
        'return_confirmed_by',
        'notes',
    ];

    protected $casts = [
        'request_date' => 'datetime',
        'approval_date' => 'datetime',
        'borrow_date' => 'datetime',
        'due_date' => 'datetime',
        'return_request_date' => 'datetime',
        'return_date' => 'datetime',
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

    public function returnConfirmedBy()
    {
        return $this->belongsTo(User::class, 'return_confirmed_by');
    }

    public function isOverdue(): bool
    {
        if ($this->status !== 'borrowed' || !$this->due_date) {
            return false;
        }
        return now()->gt($this->due_date);
    }

    public function getDaysOverdueAttribute(): int
    {
        if (!$this->isOverdue()) {
            return 0;
        }
        return now()->diffInDays($this->due_date, false);
    }

    public function getStatusTimelineAttribute(): array
    {
        $timeline = [
            ['step' => 'requested', 'label' => 'Requested', 'date' => $this->request_date, 'completed' => true],
            ['step' => 'approved', 'label' => 'Approved', 'date' => $this->approval_date, 'completed' => !is_null($this->approval_date)],
            ['step' => 'borrowed', 'label' => 'Borrowed', 'date' => $this->borrow_date, 'completed' => !is_null($this->borrow_date)],
            ['step' => 'return_requested', 'label' => 'Return Requested', 'date' => $this->return_request_date, 'completed' => !is_null($this->return_request_date)],
            ['step' => 'returned', 'label' => 'Returned', 'date' => $this->return_date, 'completed' => !is_null($this->return_date)],
        ];
        return $timeline;
    }
}