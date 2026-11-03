<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReservationSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_matches_student_name_school_id_and_title_with_status_filter(): void
    {
        $student = User::factory()->create(['name' => 'Mara Reyes', 'school_id' => '2026-0421', 'role' => 'student', 'status' => 'active']);
        $other = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $book = Book::create(['title' => 'The Lunar Atlas', 'author' => 'A. Writer', 'source' => 'gsa']);
        $unrelated = Book::create(['title' => 'Botany', 'author' => 'B. Writer', 'source' => 'gsa']);
        $match = Reservation::create(['student_id' => $student->id, 'book_id' => $book->id, 'status' => 'pending', 'reservation_date' => now()]);
        Reservation::create(['student_id' => $other->id, 'book_id' => $unrelated->id, 'status' => 'pending', 'reservation_date' => now()]);
        Reservation::create(['student_id' => $student->id, 'book_id' => $book->id, 'status' => 'completed', 'reservation_date' => now()]);
        Sanctum::actingAs(User::factory()->create(['role' => 'librarian', 'status' => 'active']));

        foreach (['Mara Reyes', '2026-0421', 'Lunar Atlas'] as $term) {
            $this->getJson('/api/reservations?' . http_build_query(['search' => $term, 'status' => 'pending']))
                ->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.id', $match->id);
        }

        $this->getJson('/api/reservations?search=NoSuchTitle')->assertOk()->assertJsonPath('data.total', 0);
    }

    public function test_search_only_returns_the_signed_in_students_reservations(): void
    {
        $student = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $other = User::factory()->create(['role' => 'student', 'status' => 'active']);
        $book = Book::create(['title' => 'Shared Search Title', 'author' => 'Author', 'source' => 'gsa']);
        $own = Reservation::create(['student_id' => $student->id, 'book_id' => $book->id, 'status' => 'pending', 'reservation_date' => now()]);
        Reservation::create(['student_id' => $other->id, 'book_id' => $book->id, 'status' => 'pending', 'reservation_date' => now()]);
        Sanctum::actingAs($student);

        $this->getJson('/api/reservations?search=Shared')->assertOk()
            ->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.id', $own->id);
    }
}
