<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookCopy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class BookCopyController extends Controller
{
    /** Statuses a librarian can set by hand. Borrowed/reserved come from loans and holds. */
    private const EDITABLE_STATUSES = ['available', 'lost', 'damaged', 'withdrawn'];

    public function index($bookId)
    {
        $book = Book::findOrFail($bookId);

        return response()->json([
            'success' => true,
            'data' => [
                'book' => $book->only(['id', 'title', 'author', 'status']),
                'copies' => $book->copies()->with('libraryLocation')->orderBy('id')->get(),
            ],
        ]);
    }

    public function store(Request $request, $bookId)
    {
        $book = Book::findOrFail($bookId);

        $validator = Validator::make($request->all(), [
            'accession_no' => 'nullable|string|max:50|unique:book_copies,accession_no',
            'library_location_id' => 'nullable|exists:library_locations,id',
            'status' => ['nullable', Rule::in(self::EDITABLE_STATUSES)],
            'condition' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $copy = $book->copies()->create([
            'accession_no' => $request->accession_no ?: BookCopy::nextAccessionNo(),
            'library_location_id' => $request->library_location_id ?? $book->library_location_id,
            'status' => $request->status ?? 'available',
            'condition' => $request->condition ?? 'good',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Copy added',
            'data' => $copy->load('libraryLocation'),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $copy = BookCopy::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'accession_no' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('book_copies', 'accession_no')->ignore($copy->id)],
            'library_location_id' => 'sometimes|nullable|exists:library_locations,id',
            'status' => ['sometimes', 'required', Rule::in(self::EDITABLE_STATUSES)],
            'condition' => 'sometimes|nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($request->has('status') && $request->status !== $copy->status && in_array($copy->status, ['borrowed', 'reserved'])) {
            return response()->json([
                'success' => false,
                'message' => "This copy is {$copy->status}. Finish the loan or hold first.",
            ], 422);
        }

        $copy->update($request->only(['accession_no', 'library_location_id', 'status', 'condition']));

        return response()->json([
            'success' => true,
            'message' => 'Copy updated',
            'data' => $copy->load('libraryLocation'),
        ]);
    }
}
