<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('interests', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('name');
        });

        // Populate slugs for existing interests
        $interests = DB::table('interests')->get();
        $slugMap = [
            'Fiction' => 'genre-fiction',
            'Fantasy' => 'genre-fantasy',
            'Science Fiction' => 'genre-sci-fi',
            'Mystery' => 'genre-mystery',
            'Romance' => 'genre-romance',
            'Adventure' => 'genre-adventure',
            'Horror' => 'genre-horror',
            'Thriller' => 'genre-thriller',
            'Biography' => 'genre-biography',
            'Autobiography' => 'genre-autobiography',
            'Poetry' => 'genre-poetry',
            'Drama' => 'genre-drama',
            'Historical Fiction' => 'genre-historical',
            'Graphic Novel' => 'genre-graphic',
            'Young Adult' => 'genre-ya',
            'Children\'s Literature' => 'genre-childrens',
            'Short Stories' => 'genre-short-stories',
            'Mythology' => 'genre-mythology',
            'Fairy Tales' => 'genre-fairy-tales',
            'Dystopian' => 'genre-dystopian',
            'Mathematics' => 'subject-math',
            'Science' => 'subject-science',
            'English' => 'subject-english',
            'Filipino' => 'subject-filipino',
            'History' => 'subject-history',
            'Social Studies' => 'subject-social',
            'Technology' => 'subject-tech',
            'Arts' => 'subject-arts',
            'Physical Education' => 'subject-pe',
            'Values Education' => 'subject-values',
            'Economics' => 'subject-economics',
            'Psychology' => 'subject-psychology',
            'Philosophy' => 'subject-philosophy',
            'Religion' => 'subject-religion',
            'Reference' => 'subject-reference',
        ];

        foreach ($interests as $interest) {
            $slug = $slugMap[$interest->name] ?? Str::slug($interest->name);
            DB::table('interests')->where('id', $interest->id)->update(['slug' => $slug]);
        }

        Schema::table('interests', function (Blueprint $table) {
            $table->string('slug')->unique()->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('interests', function (Blueprint $table) {
            $table->dropColumn('slug');
        });
    }
};
