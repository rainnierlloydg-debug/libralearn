<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('books', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('author');
            $table->string('isbn')->nullable()->unique();
            $table->string('publisher')->nullable();
            $table->date('publication_date')->nullable();
            $table->string('edition')->nullable();
            $table->string('language')->default('English');
            $table->text('description')->nullable();
            $table->string('cover_image')->nullable();
            $table->string('genre')->nullable();
            $table->string('subject')->nullable();
            $table->string('shelf')->nullable();
            $table->string('library_section')->nullable();
            $table->enum('status', ['available', 'borrowed', 'reserved', 'overdue', 'lost', 'damaged'])->default('available');
            $table->enum('source', ['gsa', 'online'])->default('gsa');
            $table->foreignId('library_location_id')->nullable()->constrained('library_locations')->onDelete('set null');
            $table->timestamps();
            
            $table->index(['title', 'author']);
            $table->index('isbn');
            $table->index('genre');
            $table->index('subject');
            $table->index('status');
            $table->index('library_section');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('books');
    }
};