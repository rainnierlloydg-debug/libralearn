<?php

namespace Database\Seeders;

use App\Models\Interest;
use Illuminate\Database\Seeder;

class InterestSeeder extends Seeder
{
    public function run(): void
    {
        $genres = [
            ['name' => 'Fiction', 'type' => 'genre', 'description' => 'Imaginative narratives and stories'],
            ['name' => 'Fantasy', 'type' => 'genre', 'description' => 'Magical and supernatural elements'],
            ['name' => 'Science Fiction', 'type' => 'genre', 'description' => 'Futuristic and technological themes'],
            ['name' => 'Mystery', 'type' => 'genre', 'description' => 'Crime, puzzles, and suspense'],
            ['name' => 'Romance', 'type' => 'genre', 'description' => 'Love stories and relationships'],
            ['name' => 'Adventure', 'type' => 'genre', 'description' => 'Exciting journeys and quests'],
            ['name' => 'Horror', 'type' => 'genre', 'description' => 'Fear and supernatural terror'],
            ['name' => 'Thriller', 'type' => 'genre', 'description' => 'Suspense and excitement'],
            ['name' => 'Biography', 'type' => 'genre', 'description' => 'Life stories of real people'],
            ['name' => 'Autobiography', 'type' => 'genre', 'description' => 'Self-written life stories'],
            ['name' => 'Poetry', 'type' => 'genre', 'description' => 'Verse and poetic expression'],
            ['name' => 'Drama', 'type' => 'genre', 'description' => 'Plays and theatrical works'],
            ['name' => 'Historical Fiction', 'type' => 'genre', 'description' => 'Fiction set in historical periods'],
            ['name' => 'Graphic Novel', 'type' => 'genre', 'description' => 'Illustrated narratives'],
            ['name' => 'Young Adult', 'type' => 'genre', 'description' => 'Stories for teenage readers'],
            ['name' => 'Children\'s Literature', 'type' => 'genre', 'description' => 'Books for young readers'],
            ['name' => 'Short Stories', 'type' => 'genre', 'description' => 'Brief fictional narratives'],
            ['name' => 'Mythology', 'type' => 'genre', 'description' => 'Myths and legends'],
            ['name' => 'Fairy Tales', 'type' => 'genre', 'description' => 'Traditional folk tales'],
            ['name' => 'Dystopian', 'type' => 'genre', 'description' => 'Dark future societies'],
        ];

        $subjects = [
            ['name' => 'Mathematics', 'type' => 'subject', 'description' => 'Numbers, algebra, geometry, calculus'],
            ['name' => 'Science', 'type' => 'subject', 'description' => 'Physics, chemistry, biology, earth science'],
            ['name' => 'English', 'type' => 'subject', 'description' => 'Language, literature, writing, grammar'],
            ['name' => 'Filipino', 'type' => 'subject', 'description' => 'Philippine language and literature'],
            ['name' => 'History', 'type' => 'subject', 'description' => 'World history, Philippine history'],
            ['name' => 'Social Studies', 'type' => 'subject', 'description' => 'Society, culture, geography, civics'],
            ['name' => 'Technology', 'type' => 'subject', 'description' => 'Computer science, IT, engineering'],
            ['name' => 'Arts', 'type' => 'subject', 'description' => 'Visual arts, music, theater, dance'],
            ['name' => 'Physical Education', 'type' => 'subject', 'description' => 'Sports, fitness, health'],
            ['name' => 'Values Education', 'type' => 'subject', 'description' => 'Ethics, character development'],
            ['name' => 'Economics', 'type' => 'subject', 'description' => 'Microeconomics, macroeconomics'],
            ['name' => 'Psychology', 'type' => 'subject', 'description' => 'Human behavior and mind'],
            ['name' => 'Philosophy', 'type' => 'subject', 'description' => 'Logic, ethics, metaphysics'],
            ['name' => 'Religion', 'type' => 'subject', 'description' => 'Theology, comparative religion'],
            ['name' => 'Reference', 'type' => 'subject', 'description' => 'Encyclopedias, dictionaries, almanacs'],
        ];

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

        foreach ($genres as $genre) {
            Interest::firstOrCreate(
                ['name' => $genre['name'], 'type' => 'genre'],
                ['description' => $genre['description'], 'slug' => $slugMap[$genre['name']]]
            );
        }

        foreach ($subjects as $subject) {
            Interest::firstOrCreate(
                ['name' => $subject['name'], 'type' => 'subject'],
                ['description' => $subject['description'], 'slug' => $slugMap[$subject['name']]]
            );
        }
    }
}