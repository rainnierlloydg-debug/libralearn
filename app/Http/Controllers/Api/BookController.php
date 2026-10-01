<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Interest;
use App\Models\LibraryLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class BookController extends Controller
{
    public function index(Request $request)
    {
        $query = Book::with(['libraryLocation', 'categories']);

        // Search
        if ($request->filled('search')) {
            $query->search($request->search);
        }

        // Filters
        if ($request->filled('genre')) {
            $query->where('genre', $request->genre);
        }

        if ($request->filled('subject')) {
            $query->where('subject', $request->subject);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('library_section')) {
            $query->where('library_section', $request->library_section);
        }

        if ($request->filled('author')) {
            $query->where('author', 'LIKE', "%{$request->author}%");
        }

        if ($request->filled('year_from')) {
            $query->whereYear('publication_date', '>=', $request->year_from);
        }

        if ($request->filled('year_to')) {
            $query->whereYear('publication_date', '<=', $request->year_to);
        }

        // Source filter (GSA vs Online)
        if ($request->filled('source')) {
            $query->where('source', $request->source);
        } else {
            // Default to GSA library only for student searches
            if (!$request->user()?->isLibrarian()) {
                $query->where('source', 'gsa');
            }
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'title');
        $sortOrder = $request->get('sort_order', 'asc');
        $allowedSorts = ['title', 'author', 'publication_date', 'created_at', 'status'];
        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $perPage = min($request->get('per_page', 20), 100);
        $books = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $books,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorize('librarian');

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'author' => 'required|string|max:255',
            'isbn' => 'nullable|string|max:20|unique:books,isbn',
            'publisher' => 'nullable|string|max:255',
            'publication_date' => 'nullable|date',
            'edition' => 'nullable|string|max:50',
            'language' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'genre' => 'nullable|string|max:100',
            'subject' => 'nullable|string|max:100',
            'shelf' => 'nullable|string|max:50',
            'library_section' => 'nullable|string|max:100',
            'status' => 'nullable|in:available,borrowed,reserved,overdue,lost,damaged',
            'library_location_id' => 'nullable|exists:library_locations,id',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'exists:interests,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $book = Book::create($request->except('category_ids'));

        if ($request->has('category_ids')) {
            $book->categories()->attach($request->category_ids);
        }

        return response()->json([
            'success' => true,
            'message' => 'Book created successfully',
            'data' => $book->load(['libraryLocation', 'categories']),
        ], 201);
    }

    public function show($id)
    {
        $book = Book::with(['libraryLocation', 'categories'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $book,
        ]);
    }

    public function update(Request $request, $id)
    {
        $this->authorize('librarian');

        $book = Book::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'author' => 'sometimes|string|max:255',
            'isbn' => 'sometimes|string|max:20|unique:books,isbn,' . $id,
            'publisher' => 'nullable|string|max:255',
            'publication_date' => 'nullable|date',
            'edition' => 'nullable|string|max:50',
            'language' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'genre' => 'nullable|string|max:100',
            'subject' => 'nullable|string|max:100',
            'shelf' => 'nullable|string|max:50',
            'library_section' => 'nullable|string|max:100',
            'status' => 'sometimes|in:available,borrowed,reserved,overdue,lost,damaged',
            'library_location_id' => 'nullable|exists:library_locations,id',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'exists:interests,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $book->update($request->except('category_ids'));

        if ($request->has('category_ids')) {
            $book->categories()->sync($request->category_ids);
        }

        return response()->json([
            'success' => true,
            'message' => 'Book updated successfully',
            'data' => $book->load(['libraryLocation', 'categories']),
        ]);
    }

    public function destroy($id)
    {
        $this->authorize('librarian');

        $book = Book::findOrFail($id);
        $book->delete();

        return response()->json([
            'success' => true,
            'message' => 'Book deleted successfully',
        ]);
    }

    public function genres()
    {
        $genres = Interest::genres()->get(['id', 'name', 'description']);

        return response()->json([
            'success' => true,
            'data' => $genres,
        ]);
    }

    public function subjects()
    {
        $subjects = Interest::subjects()->get(['id', 'name', 'description']);

        return response()->json([
            'success' => true,
            'data' => $subjects,
        ]);
    }

    public function uploadCover(Request $request)
    {
        $this->authorize('librarian');

        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $path = $request->file('image')->store('book-covers', 'public');

        return response()->json([
            'success' => true,
            'message' => 'Cover uploaded successfully',
            'path' => $path,
            'url' => Storage::url($path),
        ]);
    }

    public function getAvailableForBorrowing()
    {
        $books = Book::with(['libraryLocation'])
            ->where('status', 'available')
            ->where('source', 'gsa')
            ->orderBy('title')
            ->get(['id', 'title', 'author', 'cover_image', 'genre', 'subject', 'shelf', 'library_section', 'status']);

        return response()->json([
            'success' => true,
            'data' => $books,
        ]);
    }
}