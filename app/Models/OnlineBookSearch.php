<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OnlineBookSearch extends Model
{
    protected $fillable = [
        'student_id',
        'query',
        'source',
        'results',
    ];

    protected $casts = [
        'results' => 'array',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}