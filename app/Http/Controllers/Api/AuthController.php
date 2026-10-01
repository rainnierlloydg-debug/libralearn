<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'school_id' => 'required|string|max:20|unique:users,school_id',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'grade_level' => 'nullable|string|max:50',
            'section' => 'nullable|string|max:50',
            'interests' => 'nullable|array',
            'interests.*' => 'exists:interests,id',
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
            $user->interests()->attach($request->interests);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Registration successful',
            'user' => $user->load('interests'),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
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

        if (!Auth::attempt([$field => $request->login, 'password' => $request->password], $request->remember)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials',
            ], 401);
        }

        $user = Auth::user();
        
        if ($user->status !== 'active') {
            Auth::logout();
            return response()->json([
                'success' => false,
                'message' => 'Account is inactive. Please contact the librarian.',
            ], 403);
        }

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
            'interests.*' => 'exists:interests,id',
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
            $user->interests()->sync($request->interests);
        }

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => $user->load('interests'),
        ]);
    }
}