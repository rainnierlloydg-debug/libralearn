<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Interest extends Model
{
    protected $fillable = [
        'name',
        'type',
        'description',
    ];

    protected $casts = [
        'type' => 'string',
    ];

    public function students()
    {
        return $this->belongsToMany(User::class, 'student_interests');
    }

    public function books()
    {
        return $this->belongsToMany(Book::class, 'book_categories');
    }

    public function scopeGenres($query)
    {
        return $query->where('type', 'genre');
    }

    public function scopeSubjects($query)
    {
        return $query->where('type', 'subject');
    }
}