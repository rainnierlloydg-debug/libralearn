<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class InterestController extends Controller
{
    public function index(Request $request)
    {
        $query = Interest::orderBy('type')->orderBy('name');

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $interests = $query->get();

        return response()->json([
            'success' => true,
            'data' => $interests,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorize('librarian');

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:interests,name',
            'type' => 'required|in:genre,subject',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $interest = Interest::create($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Interest created successfully',
            'data' => $interest,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $this->authorize('librarian');

        $interest = Interest::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100|unique:interests,name,' . $id,
            'type' => 'sometimes|in:genre,subject',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $interest->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Interest updated successfully',
            'data' => $interest,
        ]);
    }

    public function destroy($id)
    {
        $this->authorize('librarian');

        $interest = Interest::findOrFail($id);
        $interest->delete();

        return response()->json([
            'success' => true,
            'message' => 'Interest deleted successfully',
        ]);
    }
}