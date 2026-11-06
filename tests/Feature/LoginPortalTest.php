<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LoginPortalTest extends TestCase
{
    public static function portalCases(): array
    {
        $cases = [];
        foreach (['student', 'librarian', 'admin'] as $role) {
            foreach (['student' => '/api/auth/login', 'staff' => '/api/auth/librarian/login'] as $portal => $endpoint) {
                foreach (['email', 'school_id'] as $identifier) {
                    $allowed = ($role === 'student') === ($portal === 'student');
                    $cases["{$role} via {$portal} using {$identifier}"] = [$role, $endpoint, $identifier, $allowed];
                }
            }
        }
        return $cases;
    }

    #[DataProvider('portalCases')]
    public function test_each_portal_accepts_only_its_own_account_roles(string $role, string $endpoint, string $identifier, bool $allowed): void
    {
        $user = User::factory()->create(['role' => $role, 'status' => 'active', 'password' => 'test-password']);
        $rememberToken = $user->remember_token;
        $response = $this->postJson($endpoint, [
            'login' => $user->{$identifier}, 'password' => 'test-password', 'remember' => true,
        ]);

        if ($allowed) {
            $response->assertOk()->assertJsonPath('user.role', $role)->assertJsonStructure(['token']);
            $this->assertAuthenticatedAs($user, 'web');
            $this->assertSame(1, $user->tokens()->count());
        } else {
            $response->assertForbidden()->assertJsonPath('success', false)->assertJsonMissingPath('token');
            $response->assertJsonPath('message', $role === 'student'
                ? 'Student accounts must sign in through Student Login.'
                : 'Librarian and admin accounts must sign in through Librarian Login.');
            $this->assertGuest('web');
            $this->assertSame(0, $user->tokens()->count());
            $this->assertSame($rememberToken, $user->fresh()->remember_token);
            $response->assertCookieMissing(Auth::guard('web')->getRecallerName());
        }
    }

    public function test_request_fields_cannot_override_the_portal_role_check(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'password' => 'test-password']);
        $this->postJson('/api/auth/login', [
            'login' => $admin->email, 'password' => 'test-password',
            'portal' => 'librarian', 'role' => 'student',
        ])->assertForbidden()->assertJsonMissingPath('token');
        $student = User::factory()->create(['role' => 'student', 'status' => 'active', 'password' => 'test-password']);
        $this->postJson('/api/auth/librarian/login', [
            'login' => $student->email, 'password' => 'test-password',
            'portal' => 'student', 'role' => 'admin',
        ])->assertForbidden()->assertJsonMissingPath('token');
        $this->assertGuest('web');
        $this->assertSame(0, $admin->tokens()->count());
        $this->assertSame(0, $student->tokens()->count());
    }

    public function test_wrong_password_does_not_reveal_role_or_create_authentication(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active', 'password' => 'test-password']);
        foreach (['/api/auth/login', '/api/auth/librarian/login'] as $endpoint) {
            $this->postJson($endpoint, ['login' => $admin->email, 'password' => 'incorrect-password'])
                ->assertUnauthorized()->assertJsonPath('message', 'Invalid credentials')->assertJsonMissingPath('token');
        }
        $this->assertGuest('web');
        $this->assertSame(0, $admin->tokens()->count());
    }

    public function test_inactive_staff_cannot_sign_in_through_the_correct_portal(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'inactive', 'password' => 'test-password']);
        $this->postJson('/api/auth/librarian/login', ['login' => $admin->email, 'password' => 'test-password'])
            ->assertForbidden()->assertJsonMissingPath('token');
        $this->assertGuest('web');
        $this->assertSame(0, $admin->tokens()->count());
    }
}
