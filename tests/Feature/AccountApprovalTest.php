<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountApprovalTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $status = 'active'): User
    {
        return User::factory()->create([
            'role' => $role,
            'school_id' => strtoupper($role) . '-' . Str::random(6),
            'status' => $status,
        ]);
    }

    private function register(): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/auth/register', [
            'name' => 'Juan Dela Cruz',
            'school_id' => 'GSA-2026-001',
            'email' => 'juan@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);
    }

    public function test_registration_starts_pending_without_token(): void
    {
        $librarian = $this->user('librarian');

        $this->register()
            ->assertCreated()
            ->assertJsonPath('pending', true)
            ->assertJsonPath('token', null)
            ->assertJsonPath('user.status', 'pending');

        $this->assertTrue(Notification::where('user_id', $librarian->id)->where('type', 'registration_pending')->exists());
    }

    public function test_pending_student_cannot_log_in(): void
    {
        $this->register();

        $this->app['auth']->shouldUse('web');
        $this->postJson('/api/auth/login', ['login' => 'GSA-2026-001', 'password' => 'secret123'])
            ->assertForbidden()
            ->assertJsonPath('message', 'Your account is waiting for librarian approval.');
    }

    public function test_librarian_approves_student_who_can_then_log_in(): void
    {
        $this->register();
        $student = User::where('school_id', 'GSA-2026-001')->first();

        Sanctum::actingAs($this->user('librarian'));
        $this->postJson("/api/users/{$student->id}/approve")->assertOk()->assertJsonPath('data.status', 'active');

        $this->assertTrue(Notification::where('user_id', $student->id)->where('type', 'account_approved')->exists());

        $this->app['auth']->shouldUse('web');
        $this->postJson('/api/auth/login', ['login' => 'GSA-2026-001', 'password' => 'secret123'])
            ->assertOk()
            ->assertJsonStructure(['token']);
    }

    public function test_librarian_rejects_student_who_still_cannot_log_in(): void
    {
        $this->register();
        $student = User::where('school_id', 'GSA-2026-001')->first();

        Sanctum::actingAs($this->user('librarian'));
        $this->postJson("/api/users/{$student->id}/reject")->assertOk()->assertJsonPath('data.status', 'rejected');
        $this->postJson("/api/users/{$student->id}/approve")->assertStatus(422);

        $this->app['auth']->shouldUse('web');
        $this->postJson('/api/auth/login', ['login' => 'GSA-2026-001', 'password' => 'secret123'])->assertForbidden();
    }

    public function test_only_pending_students_can_be_approved(): void
    {
        $active = $this->user('student');
        Sanctum::actingAs($this->user('librarian'));

        $this->postJson("/api/users/{$active->id}/approve")->assertStatus(422);
    }

    public function test_students_cannot_approve_accounts(): void
    {
        $pending = $this->user('student', 'pending');
        Sanctum::actingAs($this->user('student'));

        $this->postJson("/api/users/{$pending->id}/approve")->assertForbidden();
    }

    public function test_editing_pending_student_keeps_status_and_cannot_activate(): void
    {
        $pending = $this->user('student', 'pending');
        Sanctum::actingAs($this->user('librarian'));

        $this->putJson("/api/users/{$pending->id}", ['name' => 'Renamed', 'status' => 'pending'])->assertOk();
        $this->putJson("/api/users/{$pending->id}", ['status' => 'active'])->assertOk();

        $this->assertSame('Renamed', $pending->fresh()->name);
        $this->assertSame('pending', $pending->fresh()->status);
        $this->assertFalse(Notification::where('user_id', $pending->id)->exists());
    }

    public function test_status_migration_rolls_back_with_pending_users(): void
    {
        $pending = $this->user('student', 'pending');
        $migration = require database_path('migrations/2026_10_02_000003_allow_pending_user_status.php');

        $migration->down();
        $this->assertSame('inactive', $pending->fresh()->status);

        $migration->up();
        $this->assertSame('inactive', $pending->fresh()->status);
    }

    public function test_pending_filter_on_students_list(): void
    {
        $this->user('student', 'pending');
        $this->user('student');
        Sanctum::actingAs($this->user('librarian'));

        $this->getJson('/api/users?status=pending')->assertOk()->assertJsonPath('data.total', 1);
    }
}
