<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function registrationInterests()
    {
        return response()->json([
            'success' => true,
            'data' => Interest::query()->whereNotNull('slug')->where('slug', '!=', '')
                ->orderBy('type')->orderBy('name')->get(['slug', 'name', 'type']),
        ]);
    }

    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'school_id' => 'required|string|max:20|unique:users,school_id',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'grade_level' => 'nullable|string|max:50',
            'section' => 'nullable|string|max:50',
            'interests' => 'nullable|array',
            'interests.*' => 'exists:interests,slug',
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
            'profile_image' => $request->profile_image,
            'status' => 'active',
        ]);

        if ($request->has('interests')) {
            $interestIds = Interest::whereIn('slug', $request->interests)->pluck('id');
            $user->interests()->attach($interestIds);
        }

        $token = $user->createToken('auth_token')->plainTextToken;
        return response()->json([
            'success' => true,
            'message' => 'Registration successful.',
            'user' => $user->load('interests'),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        return $this->loginForPortal($request, false);
    }

    public function librarianLogin(Request $request)
    {
        return $this->loginForPortal($request, true);
    }

    private function loginForPortal(Request $request, bool $staffPortal)
    {
        $validator = Validator::make($request->all(), [
            'login' => 'required|string', // email or school_id
            'password' => 'required|string',
            'remember' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $field = filter_var($request->login, FILTER_VALIDATE_EMAIL) ? 'email' : 'school_id';

        $failureMessage = null;
        $guard = Auth::guard('web');
        $allowedRoles = $staffPortal ? ['librarian', 'admin'] : ['student'];
        $credentials = [$field => $request->login, 'password' => $request->password];

        // Verify credentials and portal eligibility before creating a session or remember cookie.
        $authenticated = $guard->attemptWhen($credentials, function (User $user) use ($allowedRoles, $staffPortal, &$failureMessage) {
            if (!in_array($user->role, $allowedRoles, true)) {
                $failureMessage = $staffPortal
                    ? 'Student accounts must sign in through Student Login.'
                    : 'Librarian and admin accounts must sign in through Librarian Login.';
                return false;
            }

            if ($user->status !== 'active') {
                $messages = [
                    'pending' => 'Your account is waiting for librarian approval.',
                    'rejected' => 'Your registration was not approved. Please contact the librarian.',
                ];
                $failureMessage = $messages[$user->status] ?? 'Account is inactive. Please contact the librarian.';
                return false;
            }

            return true;
        }, $request->boolean('remember'));

        if (!$authenticated) {
            return response()->json([
                'success' => false,
                'message' => $failureMessage ?? 'Invalid credentials',
            ], $failureMessage ? 403 : 401);
        }

        $user = $guard->user();

        $token = $user->createToken('auth_token', ['*'], $request->remember ? now()->addDays(30) : now()->addHours(24))->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'user' => $user->load('interests'),
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully',
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'success' => true,
            'user' => $request->user()->load('interests'),
        ]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|string|email|max:255|unique:users,email,' . $user->id,
            'grade_level' => 'nullable|string|max:50',
            'section' => 'nullable|string|max:50',
            'profile_image' => 'nullable|string',
            'interests' => 'nullable|array',
            'interests.*' => 'exists:interests,slug',
            'current_password' => 'nullable|string',
            'new_password' => 'nullable|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($request->filled('current_password') && $request->filled('new_password')) {
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Current password is incorrect',
                ], 422);
            }
            $user->password = Hash::make($request->new_password);
        }

        $user->fill($request->only(['name', 'email', 'grade_level', 'section', 'profile_image']));
        $user->save();

        if ($request->has('interests')) {
            $interestIds = Interest::whereIn('slug', $request->interests)->pluck('id');
            $user->interests()->sync($interestIds);
        }

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => $user->load('interests'),
        ]);
    }
}
