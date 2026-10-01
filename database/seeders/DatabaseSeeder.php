<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            InterestSeeder::class,
            LibraryLocationSeeder::class,
            UserSeeder::class,
            BookSeeder::class,
        ]);
    }
}