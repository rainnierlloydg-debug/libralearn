<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Create admin/librarian
        User::firstOrCreate(
            ['email' => 'librarian@gsa.edu'],
            [
                'role' => 'admin',
                'name' => 'Ms. Maria Santos',
                'school_id' => 'LIB-001',
                'email' => 'librarian@gsa.edu',
                'password' => Hash::make('librarian123'),
                'grade_level' => null,
                'section' => null,
                'status' => 'active',
            ]
        );

        // Create additional librarian
        User::firstOrCreate(
            ['email' => 'librarian2@gsa.edu'],
            [
                'role' => 'librarian',
                'name' => 'Mr. Juan Dela Cruz',
                'school_id' => 'LIB-002',
                'email' => 'librarian2@gsa.edu',
                'password' => Hash::make('librarian123'),
                'grade_level' => null,
                'section' => null,
                'status' => 'active',
            ]
        );

        // Create sample students
        $students = [
            ['role' => 'student', 'name' => 'Maria Clara Reyes', 'school_id' => '2024-0001', 'email' => 'maria.reyes@gsa.edu', 'grade_level' => 'Grade 7', 'section' => 'St. Joseph'],
            ['role' => 'student', 'name' => 'Juan Miguel Santos', 'school_id' => '2024-0002', 'email' => 'juan.santos@gsa.edu', 'grade_level' => 'Grade 7', 'section' => 'St. Joseph'],
            ['role' => 'student', 'name' => 'Ana Patricia Cruz', 'school_id' => '2024-0003', 'email' => 'ana.cruz@gsa.edu', 'grade_level' => 'Grade 8', 'section' => 'St. Mary'],
            ['role' => 'student', 'name' => 'Carlos Miguel Garcia', 'school_id' => '2024-0004', 'email' => 'carlos.garcia@gsa.edu', 'grade_level' => 'Grade 8', 'section' => 'St. Mary'],
            ['role' => 'student', 'name' => 'Sofia Isabella Lopez', 'school_id' => '2024-0005', 'email' => 'sofia.lopez@gsa.edu', 'grade_level' => 'Grade 9', 'section' => 'St. Peter'],
            ['role' => 'student', 'name' => 'Gabriel Antonio Torres', 'school_id' => '2024-0006', 'email' => 'gabriel.torres@gsa.edu', 'grade_level' => 'Grade 9', 'section' => 'St. Peter'],
            ['role' => 'student', 'name' => 'Isabella Grace Flores', 'school_id' => '2024-0007', 'email' => 'isabella.flores@gsa.edu', 'grade_level' => 'Grade 10', 'section' => 'St. Paul'],
            ['role' => 'student', 'name' => 'Rafael Jose Mendoza', 'school_id' => '2024-0008', 'email' => 'rafael.mendoza@gsa.edu', 'grade_level' => 'Grade 10', 'section' => 'St. Paul'],
            ['role' => 'student', 'name' => 'Camila Rose Aquino', 'school_id' => '2024-0009', 'email' => 'camila.aquino@gsa.edu', 'grade_level' => 'Grade 11', 'section' => 'STEM-A'],
            ['role' => 'student', 'name' => 'Daniel Miguel Ramos', 'school_id' => '2024-0010', 'email' => 'daniel.ramos@gsa.edu', 'grade_level' => 'Grade 11', 'section' => 'STEM-A'],
        ];

        foreach ($students as $student) {
            User::firstOrCreate(
                ['email' => $student['email']],
                array_merge($student, ['password' => Hash::make('student123'), 'status' => 'active'])
            );
        }
    }
}