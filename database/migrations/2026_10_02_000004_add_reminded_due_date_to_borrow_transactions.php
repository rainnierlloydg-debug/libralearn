<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The due date a reminder was last sent for, so the daily job sends one
 * reminder per due date (a renewal moves the date and earns a new one).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('borrow_transactions', function (Blueprint $table) {
            $table->date('reminded_due_date')->nullable()->after('due_date');
        });
    }

    public function down(): void
    {
        Schema::table('borrow_transactions', function (Blueprint $table) {
            $table->dropColumn('reminded_due_date');
        });
    }
};
