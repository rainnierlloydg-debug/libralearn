<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Loan rules: renewal tracking and fines on the loan, plus a key/value
 * settings table the librarian can edit (fine_per_day).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::table('borrow_transactions', function (Blueprint $table) {
            $table->unsignedTinyInteger('renewal_count')->default(0)->after('due_date');
            $table->timestamp('renewal_requested_at')->nullable()->after('renewal_count');
            $table->decimal('fine_amount', 8, 2)->nullable()->after('return_date');
            $table->timestamp('fine_paid_at')->nullable()->after('fine_amount');
        });
    }

    public function down(): void
    {
        Schema::table('borrow_transactions', function (Blueprint $table) {
            $table->dropColumn(['renewal_count', 'renewal_requested_at', 'fine_amount', 'fine_paid_at']);
        });

        Schema::dropIfExists('settings');
    }
};
