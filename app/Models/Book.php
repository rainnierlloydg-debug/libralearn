<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Book extends Model
{
    protected $fillable = [
        'title',
        'author',
        'isbn',
        'publisher',
        'publication_date',
        'edition',
        'language',
        'description',
        'cover_image',
        'genre',
        'subject',
        'shelf',
        'library_section',
        'status',
        'source',
        'library_location_id',
    ];

    protected $casts = [
        'publication_date' => 'date',
        'status' => 'string',
        'source' => 'string',
    ];

    public function libraryLocation()
    {
        return $this->belongsTo(LibraryLocation::class);
    }

    public function categories()
    {
        return $this->belongsToMany(Interest::class, 'book_categories');
    }

    public function borrowTransactions()
    {
        return $this->hasMany(BorrowTransaction::class);
    }

    public function reservations()
    {
        return $this->hasMany(Reservation::class);
    }

    public function savedBooks()
    {
        return $this->hasMany(SavedBook::class);
    }

    public function recommendationFeedback()
    {
        return $this->hasMany(RecommendationFeedback::class);
    }

    public function getStatusBadgeAttribute(): array
    {
        $badges = [
            'available' => ['bg' => 'bg-green-100', 'text' => 'text-green-800', 'icon' => 'check-circle', 'label' => 'Available'],
            'borrowed' => ['bg' => 'bg-blue-100', 'text' => 'text-blue-800', 'icon' => 'book-open', 'label' => 'Borrowed'],
            'reserved' => ['bg' => 'bg-yellow-100', 'text' => 'text-yellow-800', 'icon' => 'bookmark', 'label' => 'Reserved'],
            'overdue' => ['bg' => 'bg-red-100', 'text' => 'text-red-800', 'icon' => 'alert-circle', 'label' => 'Overdue'],
            'lost' => ['bg' => 'bg-gray-100', 'text' => 'text-gray-700', 'icon' => 'help-circle', 'label' => 'Lost'],
            'damaged' => ['bg' => 'bg-orange-100', 'text' => 'text-orange-800', 'icon' => 'tool', 'label' => 'Damaged'],
        ];
        return $badges[$this->status] ?? ['bg' => 'bg-gray-100', 'text' => 'text-gray-700', 'icon' => 'help-circle', 'label' => 'Unknown'];
    }

    public function getSourceBadgeAttribute(): array
    {
        if ($this->source === 'gsa') {
            return ['bg' => 'bg-indigo-100', 'text' => 'text-indigo-800', 'icon' => 'building-2', 'label' => 'GSA Library'];
        }
        return ['bg' => 'bg-teal-100', 'text' => 'text-teal-800', 'icon' => 'globe', 'label' => 'Online Source'];
    }

    public function scopeAvailable($query)
    {
        return $query->where('status', 'available');
    }

    public function scopeSearch($query, string $term)
    {
        return $query->where(function ($q) use ($term) {
            $q->where('title', 'LIKE', "%{$term}%")
              ->orWhere('author', 'LIKE', "%{$term}%")
              ->orWhere('isbn', 'LIKE', "%{$term}%")
              ->orWhere('genre', 'LIKE', "%{$term}%")
              ->orWhere('subject', 'LIKE', "%{$term}%")
              ->orWhere('description', 'LIKE', "%{$term}%");
        });
    }
}