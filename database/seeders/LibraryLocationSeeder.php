<?php

namespace Database\Seeders;

use App\Models\LibraryLocation;
use Illuminate\Database\Seeder;

class LibraryLocationSeeder extends Seeder
{
    public function run(): void
    {
        $locations = [
            // Fiction Section
            ['section_name' => 'Fiction', 'shelf_number' => 'F-01', 'description' => 'Fiction A-F', 'color' => '#E0E7FF', 'map_position' => ['x' => 100, 'y' => 100, 'width' => 200, 'height' => 150]],
            ['section_name' => 'Fiction', 'shelf_number' => 'F-02', 'description' => 'Fiction G-L', 'color' => '#E0E7FF', 'map_position' => ['x' => 300, 'y' => 100, 'width' => 200, 'height' => 150]],
            ['section_name' => 'Fiction', 'shelf_number' => 'F-03', 'description' => 'Fiction M-R', 'color' => '#E0E7FF', 'map_position' => ['x' => 500, 'y' => 100, 'width' => 200, 'height' => 150]],
            ['section_name' => 'Fiction', 'shelf_number' => 'F-04', 'description' => 'Fiction S-Z', 'color' => '#E0E7FF', 'map_position' => ['x' => 700, 'y' => 100, 'width' => 200, 'height' => 150]],

            // Science Section
            ['section_name' => 'Science', 'shelf_number' => 'S-01', 'description' => 'Physics', 'color' => '#DBEAFE', 'map_position' => ['x' => 100, 'y' => 300, 'width' => 200, 'height' => 150]],
            ['section_name' => 'Science', 'shelf_number' => 'S-02', 'description' => 'Chemistry', 'color' => '#DBEAFE', 'map_position' => ['x' => 300, 'y' => 300, 'width' => 200, 'height' => 150]],
            ['section_name' => 'Science', 'shelf_number' => 'S-03', 'description' => 'Biology', 'color' => '#DBEAFE', 'map_position' => ['x' => 500, 'y' => 300, 'width' => 200, 'height' => 150]],
            ['section_name' => 'Science', 'shelf_number' => 'S-04', 'description' => 'Earth Science', 'color' => '#DBEAFE', 'map_position' => ['x' => 700, 'y' => 300, 'width' => 200, 'height' => 150]],

            // Mathematics Section
            ['section_name' => 'Mathematics', 'shelf_number' => 'M-01', 'description' => 'Algebra & Geometry', 'color' => '#FEF3C7', 'map_position' => ['x' => 100, 'y' => 500, 'width' => 200, 'height' => 150]],
            ['section_name' => 'Mathematics', 'shelf_number' => 'M-02', 'description' => 'Calculus & Statistics', 'color' => '#FEF3C7', 'map_position' => ['x' => 300, 'y' => 500, 'width' => 200, 'height' => 150]],

            // English Section
            ['section_name' => 'English', 'shelf_number' => 'E-01', 'description' => 'Literature & Grammar', 'color' => '#FCE7F3', 'map_position' => ['x' => 500, 'y' => 500, 'width' => 200, 'height' => 150]],
            ['section_name' => 'English', 'shelf_number' => 'E-02', 'description' => 'Writing & Composition', 'color' => '#FCE7F3', 'map_position' => ['x' => 700, 'y' => 500, 'width' => 200, 'height' => 150]],

            // Filipino Section
            ['section_name' => 'Filipino', 'shelf_number' => 'FL-01', 'description' => 'Panitikan & Gramatika', 'color' => '#FED7AA', 'map_position' => ['x' => 100, 'y' => 700, 'width' => 200, 'height' => 150]],
            ['section_name' => 'Filipino', 'shelf_number' => 'FL-02', 'description' => 'Komunikasyon', 'color' => '#FED7AA', 'map_position' => ['x' => 300, 'y' => 700, 'width' => 200, 'height' => 150]],

            // History Section
            ['section_name' => 'History', 'shelf_number' => 'H-01', 'description' => 'Philippine History', 'color' => '#EDE9FE', 'map_position' => ['x' => 500, 'y' => 700, 'width' => 200, 'height' => 150]],
            ['section_name' => 'History', 'shelf_number' => 'H-02', 'description' => 'World History', 'color' => '#EDE9FE', 'map_position' => ['x' => 700, 'y' => 700, 'width' => 200, 'height' => 150]],

            // Reference Section
            ['section_name' => 'Reference', 'shelf_number' => 'R-01', 'description' => 'Encyclopedias', 'color' => '#F3F4F6', 'map_position' => ['x' => 100, 'y' => 900, 'width' => 200, 'height' => 150]],
            ['section_name' => 'Reference', 'shelf_number' => 'R-02', 'description' => 'Dictionaries & Almanacs', 'color' => '#F3F4F6', 'map_position' => ['x' => 300, 'y' => 900, 'width' => 200, 'height' => 150]],

            // Others
            ['section_name' => 'Others', 'shelf_number' => 'O-01', 'description' => 'Multidisciplinary', 'color' => '#F1F5F9', 'map_position' => ['x' => 500, 'y' => 900, 'width' => 200, 'height' => 150]],
            ['section_name' => 'Others', 'shelf_number' => 'O-02', 'description' => 'Periodicals & Magazines', 'color' => '#F1F5F9', 'map_position' => ['x' => 700, 'y' => 900, 'width' => 200, 'height' => 150]],
        ];

        foreach ($locations as $location) {
            LibraryLocation::firstOrCreate(
                ['section_name' => $location['section_name'], 'shelf_number' => $location['shelf_number']],
                $location
            );
        }
    }
}