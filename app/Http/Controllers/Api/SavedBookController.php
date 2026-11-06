<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SavedBook;
use Illuminate\Http\Request;

class SavedBookController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate(['per_page' => 'sometimes|integer|min:1|max:100']);

        return response()->json(['success' => true, 'data' => SavedBook::with('book')
            ->where('student_id', $request->user()->id)->latest()
            ->paginate($validated['per_page'] ?? 50)]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['book_id' => 'required|integer|exists:books,id']);
        $saved = SavedBook::firstOrCreate([
            'student_id' => $request->user()->id,
            'book_id' => $validated['book_id'],
        ]);

        return response()->json(['success' => true, 'data' => $saved], $saved->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request, int $bookId)
    {
        SavedBook::where('student_id', $request->user()->id)->where('book_id', $bookId)->delete();

        return response()->json(['success' => true, 'message' => 'Book removed from saved books.']);
    }
}
