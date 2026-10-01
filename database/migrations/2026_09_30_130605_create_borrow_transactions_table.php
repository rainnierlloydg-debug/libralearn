<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('borrow_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('book_id')->constrained('books')->onDelete('cascade');
            $table->timestamp('request_date')->nullable();
            $table->timestamp('approval_date')->nullable();
            $table->timestamp('borrow_date')->nullable();
            $table->timestamp('due_date')->nullable();
            $table->timestamp('return_request_date')->nullable();
            $table->timestamp('return_date')->nullable();
            $table->enum('status', ['pending', 'approved', 'borrowed', 'return_requested', 'returned', 'rejected', 'overdue', 'lost', 'damaged'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('return_confirmed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->index(['student_id', 'status']);
            $table->index(['book_id', 'status']);
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('borrow_transactions');
    }
};