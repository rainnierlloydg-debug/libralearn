<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiCatalogJob extends Model
{
    protected $fillable = [
        'uploaded_image',
        'extracted_text',
        'extracted_metadata',
        'open_library_result',
        'google_books_result',
        'final_metadata',
        'confidence',
        'reviewed_by',
        'status',
        'error_message',
    ];

    protected $casts = [
        'extracted_metadata' => 'array',
        'open_library_result' => 'array',
        'google_books_result' => 'array',
        'final_metadata' => 'array',
        'confidence' => 'decimal:2',
    ];

    public function reviewedBy()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function isComplete(): bool
    {
        return in_array($this->status, ['confirmed', 'failed']);
    }
}