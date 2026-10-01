<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BorrowTransaction;
use App\Models\Notification;
use App\Models\RecommendationFeedback;
use App\Models\Reservation;
use App\Models\SavedBook;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('librarian');

        $query = User::where('role', 'student');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('school_id', 'LIKE', "%{$search}%")
                  ->orWhere('email', 'LIKE', "%{$search}%");
            });
        }

        if ($request->filled('grade_level')) {
            $query->where('grade_level', $request->grade_level);
        }

        if ($request->filled('section')) {
            $query->where('section', $request->section);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $query->withCount(['borrowedBooks', 'reservations', 'savedBooks']);
        $query->orderBy('name');

        $perPage = min($request->get('per_page', 20), 100);
        $students = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $students,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorize('librarian');

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'school_id' => 'required|string|max:20|unique:users,school_id',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'grade_level' => 'nullable|string|max:50',
            'section' => 'nullable|string|max:50',
            'status' => 'nullable|in:active,inactive',
            'profile_image' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = User::create([
            'role' => 'student',
            'name' => $request->name,
            'school_id' => $request->school_id,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'grade_level' => $request->grade_level,
            'section' => $request->section,
            'status' => $request->status ?? 'active',
            'profile_image' => $request->profile_image,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Student created successfully',
            'data' => $user,
        ], 201);
    }

    public function show($id)
    {
        $this->authorize('librarian');

        $user = User::with(['interests'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }

    public function update(Request $request, $id)
    {
        $this->authorize('librarian');

        $user = User::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'school_id' => 'sometimes|string|max:20|unique:users,school_id,' . $id,
            'email' => 'sometimes|string|email|max:255|unique:users,email,' . $id,
            'grade_level' => 'nullable|string|max:50',
            'section' => 'nullable|string|max:50',
            'status' => 'sometimes|in:active,inactive',
            'profile_image' => 'nullable|string',
            'password' => 'nullable|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user->fill($request->only(['name', 'school_id', 'email', 'grade_level', 'section', 'status', 'profile_image']));

        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }

        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Student updated successfully',
            'data' => $user->load('interests'),
        ]);
    }

    public function destroy($id)
    {
        $this->authorize('librarian');

        $user = User::findOrFail($id);

        if ($user->id === request()->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete your own account',
            ], 422);
        }

        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'Student deleted successfully',
        ]);
    }

    public function getDetails(Request $request, $id)
    {
        $this->authorize('librarian');

        $user = User::with(['interests'])->findOrFail($id);

        // Borrowing history
        $borrowingHistory = BorrowTransaction::with('book')
            ->where('student_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        // Reservations
        $reservations = Reservation::with('book')
            ->where('student_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        // Overdue books
        $overdueBooks = BorrowTransaction::with('book')
            ->where('student_id', $id)
            ->where('status', 'overdue')
            ->get();

        // Reading interests
        $interests = $user->interests;

        // Recommendation activity
        $recommendationActivity = RecommendationFeedback::with('book')
            ->where('student_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        // Saved books
        $savedBooks = SavedBook::with('book')
            ->where('student_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'student' => $user,
                'borrowing_history' => $borrowingHistory,
                'reservations' => $reservations,
                'overdue_books' => $overdueBooks,
                'interests' => $interests,
                'recommendation_activity' => $recommendationActivity,
                'saved_books' => $savedBooks,
            ],
        ]);
    }
}