<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('library_locations', function (Blueprint $table) {
            $table->id();
            $table->string('section_name');
            $table->string('shelf_number');
            $table->text('description')->nullable();
            $table->json('map_position')->nullable(); // {x, y, width, height} for map rendering
            $table->string('color')->nullable(); // hex color for map visualization
            $table->timestamps();
            
            $table->unique(['section_name', 'shelf_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('library_locations');
    }
};