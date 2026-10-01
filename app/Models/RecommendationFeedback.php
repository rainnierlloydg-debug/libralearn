<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecommendationFeedback extends Model
{
    protected $fillable = [
        'student_id',
        'book_id',
        'feedback',
    ];

    protected $casts = [
        'feedback' => 'string',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function book()
    {
        return $this->belongsTo(Book::class);
    }
}