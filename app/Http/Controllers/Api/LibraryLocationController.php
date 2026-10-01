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
        $sections = LibraryLocation::select('section_name', 'color')
            ->distinct('section_name')
            ->get()
            ->map(function ($section) {
                $shelves = LibraryLocation::where('section_name', $section->section_name)
                    ->orderBy('shelf_number')
                    ->get(['id', 'section_name', 'shelf_number', 'description', 'map_position']);

                return [
                    'section_name' => $section->section_name,
                    'color' => $section->color ?? '#E0E7FF',
                    'shelves' => $shelves,
                    'book_count' => Book::where('library_section', $section->section_name)
                        ->where('source', 'gsa')
                        ->count(),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $sections,
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
        $books = Book::where('library_section', $sectionName)
            ->where('source', 'gsa')
            ->with('libraryLocation')
            ->orderBy('shelf')
            ->orderBy('title')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $books,
        ]);
    }
}