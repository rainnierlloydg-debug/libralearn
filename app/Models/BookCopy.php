<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookCopy extends Model
{
    public const STATUSES = ['available', 'borrowed', 'reserved', 'lost', 'damaged', 'withdrawn'];

    /** Copies that can still circulate (now or after the current loan). */
    public const CIRCULATING = ['available', 'borrowed', 'reserved'];

    protected $fillable = [
        'book_id',
        'accession_no',
        'library_location_id',
        'status',
        'condition',
    ];

    protected static function booted(): void
    {
        static::saved(fn (BookCopy $copy) => $copy->book?->syncStatusFromCopies());
        static::deleted(fn (BookCopy $copy) => $copy->book?->syncStatusFromCopies());
    }

    public function book()
    {
        return $this->belongsTo(Book::class);
    }

    public function libraryLocation()
    {
        return $this->belongsTo(LibraryLocation::class);
    }

    public function borrowTransactions()
    {
        return $this->hasMany(BorrowTransaction::class);
    }

    public function reservations()
    {
        return $this->hasMany(Reservation::class);
    }

    /**
     * Next free accession number in the GSA-000001 series.
     */
    public static function nextAccessionNo(): string
    {
        $n = (int) static::max('id') + 1;

        while (static::where('accession_no', $no = sprintf('GSA-%06d', $n))->exists()) {
            $n++;
        }

        return $no;
    }
}
