<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('title');
            $table->text('message');
            $table->string('type'); // borrowing_approved, reservation_approved, due_reminder, overdue, return_confirmed, etc.
            $table->boolean('read_status')->default(false);
            $table->json('data')->nullable(); // additional data like book_id, transaction_id, etc.
            $table->timestamps();
            
            $table->index(['user_id', 'read_status']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};