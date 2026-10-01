<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LibraryLocation extends Model
{
    protected $fillable = [
        'section_name',
        'shelf_number',
        'description',
        'map_position',
        'color',
    ];

    protected $casts = [
        'map_position' => 'array',
    ];

    public function books()
    {
        return $this->hasMany(Book::class);
    }

    public function getFullLocationAttribute(): string
    {
        return "{$this->section_name}, Shelf {$this->shelf_number}";
    }
}