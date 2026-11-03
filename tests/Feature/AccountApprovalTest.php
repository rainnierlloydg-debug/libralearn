<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Interest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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

    private function pendingStudent(): User
    {
        return User::factory()->create([
            'role' => 'student',
            'school_id' => 'GSA-2026-001',
            'email' => 'juan@example.com',
            'password' => Hash::make('secret123'),
            'status' => 'pending',
        ]);
    }

    private function register(): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/auth/register', [
            'name' => 'Juan Dela Cruz',
            'school_id' => 'GSA-2026-001',
            'email' => 'juan@example.com',
            'password' => 'secret123',
        ]);
    }

    public function test_registration_activates_account_without_confirmation_or_optional_fields(): void
    {
        $this->register()
            ->assertCreated()
            ->assertJsonPath('user.status', 'active')
            ->assertJsonStructure(['token']);

        $this->assertDatabaseHas('users', [
            'school_id' => 'GSA-2026-001',
            'email' => 'juan@example.com',
            'status' => 'active',
        ]);
    }

    public function test_registration_accepts_empty_optional_student_details_and_interests(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'New Student', 'school_id' => 'GSA-NEW-001',
            'email' => 'new-student@example.com', 'password' => 'secret123',
            'grade_level' => '', 'section' => '', 'interests' => [], 'profile_image' => '',
        ])->assertCreated()->assertJsonPath('user.status', 'active')->assertJsonCount(0, 'user.interests');
    }

    public function test_registration_interest_options_use_existing_slugs_without_authentication(): void
    {
        $interest = Interest::create(['name' => 'Custom Genre', 'type' => 'genre', 'slug' => 'custom-genre']);
        $this->getJson('/api/auth/registration-interests')->assertOk()
            ->assertJsonPath('data.0.slug', 'custom-genre')
            ->assertJsonPath('data.0.name', 'Custom Genre');
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Reader', 'school_id' => 'GSA-READER-001',
            'email' => 'reader@example.com', 'password' => 'secret123',
            'interests' => ['custom-genre'],
        ])->assertCreated()->assertJsonPath('user.interests.0.slug', 'custom-genre');
        $this->assertDatabaseHas('student_interests', ['student_id' => $response->json('user.id'), 'interest_id' => $interest->id]);
    }

    public function test_duplicate_registration_returns_field_errors_without_creating_another_account(): void
    {
        $this->register()->assertCreated();
        $this->register()->assertUnprocessable()->assertJsonValidationErrors(['email', 'school_id']);
        $this->assertSame(1, User::count());
    }

    public function test_pending_student_cannot_log_in(): void
    {
        $student = $this->pendingStudent();

        $this->app['auth']->shouldUse('web');
        $this->postJson('/api/auth/login', ['login' => $student->school_id, 'password' => 'secret123'])
            ->assertForbidden()
            ->assertJsonPath('message', 'Your account is waiting for librarian approval.');
    }

    public function test_librarian_approves_student_who_can_then_log_in(): void
    {
        $student = $this->pendingStudent();

        Sanctum::actingAs($this->user('librarian'));
        $this->postJson("/api/users/{$student->id}/approve")->assertOk()->assertJsonPath('data.status', 'active');

        $this->assertTrue(Notification::where('user_id', $student->id)->where('type', 'account_approved')->exists());

        $this->app['auth']->shouldUse('web');
        $this->postJson('/api/auth/login', ['login' => $student->school_id, 'password' => 'secret123'])
            ->assertOk()
            ->assertJsonStructure(['token']);
    }

    public function test_librarian_rejects_student_who_still_cannot_log_in(): void
    {
        $student = $this->pendingStudent();

        Sanctum::actingAs($this->user('librarian'));
        $this->postJson("/api/users/{$student->id}/reject")->assertOk()->assertJsonPath('data.status', 'rejected');
        $this->postJson("/api/users/{$student->id}/approve")->assertStatus(422);

        $this->app['auth']->shouldUse('web');
        $this->postJson('/api/auth/login', ['login' => $student->school_id, 'password' => 'secret123'])->assertForbidden();
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
