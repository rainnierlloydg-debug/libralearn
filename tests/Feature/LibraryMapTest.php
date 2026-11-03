<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\LibraryLocation;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LibraryMapTest extends TestCase
{
    private function book(array $attributes = []): Book
    {
        return Book::create(array_merge(['title' => 'Library title', 'author' => 'Writer', 'source' => 'gsa'], $attributes));
    }

    public function test_map_uses_catalog_sections_without_seeding_locations(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->book(['library_section' => 'A', 'shelf' => '10']);
        $this->book(['library_section' => 'A', 'shelf' => '2']);
        $this->book(['library_section' => 'A', 'shelf' => '2']);
        $this->book();
        $this->book(['source' => 'online', 'library_section' => 'Online', 'shelf' => '1']);

        $this->getJson('/api/library-locations/map')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.section_name', 'A')
            ->assertJsonPath('data.0.book_count', 3)
            ->assertJsonPath('data.0.shelves.0.shelf_number', '2')
            ->assertJsonPath('data.0.shelves.0.book_count', 2)
            ->assertJsonPath('data.0.shelves.1.shelf_number', '10')
            ->assertJsonPath('unassigned_book_count', 1);
        $this->assertSame(0, LibraryLocation::count());
    }

    public function test_configured_sections_merge_without_duplicate_sections_or_shelves(): void
    {
        Sanctum::actingAs(User::factory()->create());
        LibraryLocation::create(['section_name' => 'A', 'shelf_number' => '1', 'color' => '#123456', 'description' => 'Near the desk']);
        LibraryLocation::create(['section_name' => 'A', 'shelf_number' => '2', 'color' => '#654321']);
        LibraryLocation::create(['section_name' => 'B', 'shelf_number' => '1']);
        $this->book(['library_section' => 'A', 'shelf' => '1']);

        $this->getJson('/api/library-locations/map')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonCount(2, 'data.0.shelves')->assertJsonPath('data.0.book_count', 1)
            ->assertJsonPath('data.0.shelves.0.book_count', 1)
            ->assertJsonPath('data.0.shelves.0.description', 'Near the desk')
            ->assertJsonPath('data.1.book_count', 0);
    }

    public function test_linked_location_and_shelf_work_when_book_labels_are_missing(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $location = LibraryLocation::create(['section_name' => 'Science', 'shelf_number' => 'S-1']);
        $book = $this->book(['library_location_id' => $location->id]);
        $this->getJson('/api/library-locations/map')->assertJsonPath('data.0.book_count', 1)
            ->assertJsonPath('data.0.shelves.0.book_count', 1)->assertJsonPath('unassigned_book_count', 0);
        $this->getJson('/api/library-locations/section/Science/books?shelf=S-1')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $book->id);
    }

    public function test_shelf_filter_excludes_other_shelves_sections_and_online_books(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $wanted = $this->book(['library_section' => 'A', 'shelf' => '1']);
        $this->book(['library_section' => 'A', 'shelf' => '2']);
        $this->book(['library_section' => 'B', 'shelf' => '1']);
        $this->book(['source' => 'online', 'library_section' => 'A', 'shelf' => '1']);
        $this->getJson('/api/library-locations/section/A/books?shelf=1')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $wanted->id);
        $this->getJson('/api/library-locations/section/A/books?shelf=missing')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/library-locations/section/A/books')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_explicit_catalog_section_takes_precedence_over_conflicting_linked_location(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $location = LibraryLocation::create(['section_name' => 'A', 'shelf_number' => '1']);
        $this->book(['library_section' => 'B', 'library_location_id' => $location->id]);
        $this->getJson('/api/library-locations/section/A/books')->assertJsonCount(0, 'data');
        $this->getJson('/api/library-locations/section/B/books')->assertJsonCount(1, 'data');
        $this->getJson('/api/library-locations/section/B/books?shelf=1')->assertJsonCount(0, 'data');
        $map = $this->getJson('/api/library-locations/map')->assertOk();
        $map->assertJsonPath('data.0.book_count', 0)->assertJsonPath('data.1.book_count', 1)
            ->assertJsonCount(0, 'data.1.shelves');
    }

    public function test_map_requires_authentication_and_does_not_invent_empty_locations(): void
    {
        $this->getJson('/api/library-locations/map')->assertUnauthorized();
        $this->getJson('/api/library-locations/section/A/books')->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/library-locations/map')->assertOk()->assertJsonCount(0, 'data')
            ->assertJsonPath('unassigned_book_count', 0);
    }
}
