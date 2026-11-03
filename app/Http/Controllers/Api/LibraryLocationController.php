<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\LibraryLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LibraryLocationController extends Controller
{
    public function index(Request $request)
    {
        $locations = LibraryLocation::withCount('books')
            ->orderBy('section_name')
            ->orderBy('shelf_number')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $locations,
        ]);
    }

    public function mapData(Request $request)
    {
        $locations = LibraryLocation::orderBy('section_name')->orderBy('shelf_number')->get();
        $locationsById = $locations->keyBy('id');
        $sections = [];
        $unassigned = 0;

        $addSection = function (string $name, ?string $color = null) use (&$sections) {
            if (!isset($sections[$name])) {
                $sections[$name] = ['section_name' => $name, 'color' => $color ?: '#3f6f87', 'shelves' => [], 'book_count' => 0];
            }
        };
        foreach ($locations as $location) {
            $name = trim($location->section_name);
            if ($name === '') continue;
            $addSection($name, $location->color);
            $number = trim((string) $location->shelf_number);
            $sections[$name]['shelves'][$number] = [
                'id' => $location->id, 'shelf_number' => $number,
                'description' => $location->description, 'map_position' => $location->map_position,
                'book_count' => 0,
            ];
        }
        $books = Book::where('source', 'gsa')->get(['id', 'library_section', 'shelf', 'library_location_id']);
        foreach ($books as $book) {
            $location = $locationsById->get($book->library_location_id);
            $name = trim((string) $book->library_section) ?: trim((string) $location?->section_name);
            if ($name === '') {
                $unassigned++;
                continue;
            }
            $addSection($name);
            $sections[$name]['book_count']++;
            $number = trim((string) $book->shelf);
            if ($number === '' && trim((string) $location?->section_name) === $name) {
                $number = trim((string) $location?->shelf_number);
            }
            if ($number === '') continue;
            if (!isset($sections[$name]['shelves'][$number])) {
                $sections[$name]['shelves'][$number] = [
                    'id' => null, 'shelf_number' => $number, 'description' => null,
                    'map_position' => null, 'book_count' => 0,
                ];
            }
            $sections[$name]['shelves'][$number]['book_count']++;
        }
        $sections = collect($sections)->sortBy('section_name', SORT_NATURAL)->map(function ($section) {
            $section['shelves'] = collect($section['shelves'])->sortBy('shelf_number', SORT_NATURAL)->values();
            return $section;
        })->values();

        return response()->json([
            'success' => true,
            'data' => $sections,
            'unassigned_book_count' => $unassigned,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorize('librarian');

        $validator = Validator::make($request->all(), [
            'section_name' => 'required|string|max:100',
            'shelf_number' => 'required|string|max:50',
            'description' => 'nullable|string',
            'map_position' => 'nullable|array',
            'color' => 'nullable|string|max:7',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $location = LibraryLocation::create($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Library location created successfully',
            'data' => $location,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $this->authorize('librarian');

        $location = LibraryLocation::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'section_name' => 'sometimes|string|max:100',
            'shelf_number' => 'sometimes|string|max:50',
            'description' => 'nullable|string',
            'map_position' => 'nullable|array',
            'color' => 'nullable|string|max:7',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $location->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Library location updated successfully',
            'data' => $location,
        ]);
    }

    public function destroy($id)
    {
        $this->authorize('librarian');

        $location = LibraryLocation::findOrFail($id);
        $location->delete();

        return response()->json([
            'success' => true,
            'message' => 'Library location deleted successfully',
        ]);
    }

    public function getSectionBooks(Request $request, $sectionName)
    {
        $books = Book::where('source', 'gsa')
            ->where(function ($query) use ($sectionName) {
                $query->whereRaw('TRIM(library_section) = ?', [$sectionName])
                    ->orWhere(function ($fallback) use ($sectionName) {
                        $fallback->where(fn ($empty) => $empty->whereNull('library_section')->orWhereRaw("TRIM(library_section) = ''"))
                            ->whereHas('libraryLocation', fn ($location) => $location->whereRaw('TRIM(section_name) = ?', [$sectionName]));
                    });
            })
            ->with('libraryLocation')
            ->orderBy('shelf')
            ->orderBy('title')
            ->get();

        if ($request->filled('shelf')) {
            $books = $books->filter(function ($book) use ($request, $sectionName) {
                $number = trim((string) $book->shelf);
                if ($number === '' && trim((string) $book->libraryLocation?->section_name) === $sectionName) {
                    $number = trim((string) $book->libraryLocation?->shelf_number);
                }
                return $number === trim((string) $request->query('shelf'));
            })->values();
        }

        return response()->json([
            'success' => true,
            'data' => $books,
        ]);
    }
}
