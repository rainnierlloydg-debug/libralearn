<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    protected $fillable = [
        'role',
        'name',
        'school_id',
        'email',
        'password',
        'grade_level',
        'section',
        'profile_image',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function isStudent(): bool
    {
        return $this->role === 'student';
    }

    public function isLibrarian(): bool
    {
        return in_array($this->role, ['librarian', 'admin']);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function interests()
    {
        return $this->belongsToMany(Interest::class, 'student_interests', 'student_id', 'interest_id');
    }

    public function borrowedBooks()
    {
        return $this->hasMany(BorrowTransaction::class, 'student_id');
    }

    public function reservations()
    {
        return $this->hasMany(Reservation::class, 'student_id');
    }

    public function savedBooks()
    {
        return $this->hasMany(SavedBook::class, 'student_id');
    }

    public function recommendationFeedback()
    {
        return $this->hasMany(RecommendationFeedback::class, 'student_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'user_id');
    }

    public function approvedTransactions()
    {
        return $this->hasMany(BorrowTransaction::class, 'approved_by');
    }

    public function confirmedReturns()
    {
        return $this->hasMany(BorrowTransaction::class, 'return_confirmed_by');
    }

    public function approvedReservations()
    {
        return $this->hasMany(Reservation::class, 'approved_by');
    }

    public function aiCatalogJobs()
    {
        return $this->hasMany(AiCatalogJob::class, 'reviewed_by');
    }

    public function onlineSearches()
    {
        return $this->hasMany(OnlineBookSearch::class, 'student_id');
    }
}