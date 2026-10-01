<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_catalog_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('uploaded_image');
            $table->text('extracted_text')->nullable();
            $table->json('extracted_metadata')->nullable();
            $table->json('open_library_result')->nullable();
            $table->json('google_books_result')->nullable();
            $table->json('final_metadata')->nullable();
            $table->decimal('confidence', 5, 2)->nullable(); // percentage
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->enum('status', ['processing', 'needs_review', 'draft', 'confirmed', 'failed'])->default('processing');
            $table->text('error_message')->nullable();
            $table->timestamps();
            
            $table->index('status');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_catalog_jobs');
    }
};