<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Librarian-editable key/value settings.
 */
class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    public static function getValue(string $key, mixed $default = null): mixed
    {
        return static::where('key', $key)->value('value') ?? $default;
    }

    public static function setValue(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    /**
     * Fine per overdue day in pesos. The settings table wins; the
     * LIBRARY_FINE_PER_DAY env value is only the starting default.
     */
    public static function finePerDay(): float
    {
        return (float) static::getValue('fine_per_day', config('library.fine_per_day') ?? 0);
    }
}
