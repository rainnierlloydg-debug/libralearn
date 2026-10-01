<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Enum columns become plain strings so MySQL, SQLite and PostgreSQL all
 * behave the same and new status values need no schema change. Allowed
 * values are enforced in the app (validation and model constants).
 *
 * On PostgreSQL, Laravel builds enum() as varchar + a CHECK constraint;
 * ->change() keeps that constraint, so it is dropped explicitly.
 * Data is untouched: every existing value fits the new column.
 */
return new class extends Migration
{
    /** table => [column => [length, default]] */
    private const COLUMNS = [
        'users' => ['role' => [20, 'student'], 'status' => [20, 'active']],
        'interests' => ['type' => [20, null]],
        'books' => ['status' => [20, 'available'], 'source' => [20, 'gsa']],
        'borrow_transactions' => ['status' => [20, 'pending']],
        'reservations' => ['status' => [20, 'pending']],
        'recommendation_feedback' => ['feedback' => [20, null]],
        'ai_catalog_jobs' => ['status' => [20, 'processing']],
    ];

    public function up(): void
    {
        foreach (self::COLUMNS as $table => $columns) {
            foreach ($columns as $column => [$length, $default]) {
                if (DB::getDriverName() === 'pgsql') {
                    DB::statement("ALTER TABLE \"{$table}\" DROP CONSTRAINT IF EXISTS \"{$table}_{$column}_check\"");
                }

                Schema::table($table, function (Blueprint $t) use ($column, $length, $default) {
                    $col = $t->string($column, $length);
                    if ($default !== null) {
                        $col->default($default);
                    }
                    $col->change();
                });
            }
        }
    }

    public function down(): void
    {
        // Intentionally empty: string columns accept every old enum value,
        // and recreating enums would fail on rows using newer values.
    }
};
