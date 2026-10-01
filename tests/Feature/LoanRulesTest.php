<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\Notification;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LoanRulesTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private User $librarian;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'library.loan_days' => 3,
            'library.max_active_loans' => 3,
            'library.max_renewals' => 1,
            'library.renewal_days' => 1,
            'library.fine_per_day' => null,
        ]);

        $this->student = $this->user('student');
        $this->librarian = $this->user('librarian');
    }

    private function user(string $role): User
    {
        return User::factory()->create([
            'role' => $role,
            'school_id' => strtoupper($role) . '-' . Str::random(6),
            'status' => 'active',
        ]);
    }

    private function book(): Book
    {
        return Book::create(['title' => 'Book ' . Str::random(5), 'author' => 'Author', 'source' => 'gsa']);
    }

    /** Request and approve a loan; returns the transaction. */
    private function borrow(?Book $book = null): BorrowTransaction
    {
        $book ??= $this->book();
        Sanctum::actingAs($this->student);
        $id = $this->postJson('/api/borrow', ['book_id' => $book->id])->assertCreated()->json('data.id');
        Sanctum::actingAs($this->librarian);
        $this->postJson("/api/borrow/{$id}/approve")->assertOk();

        return BorrowTransaction::find($id);
    }

    public function test_approval_sets_three_day_loan(): void
    {
        $this->travelTo(now()->setTime(9, 0));
        $loan = $this->borrow();

        $this->assertTrue($loan->due_date->isSameDay(now()->addDays(3)));
    }

    public function test_student_cannot_exceed_three_active_loans(): void
    {
        $this->borrow();
        $this->borrow();
        $this->borrow();

        Sanctum::actingAs($this->student);
        $this->postJson('/api/borrow', ['book_id' => $this->book()->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'You can have at most 3 active loans and requests');
    }

    public function test_pending_requests_count_toward_the_limit(): void
    {
        Sanctum::actingAs($this->student);
        foreach (range(1, 3) as $i) {
            $this->postJson('/api/borrow', ['book_id' => $this->book()->id])->assertCreated();
        }

        $this->postJson('/api/borrow', ['book_id' => $this->book()->id])->assertStatus(422);
    }

    public function test_approve_blocks_when_student_already_has_three_out(): void
    {
        // Three loans out already, created directly to bypass the request cap.
        foreach (range(1, 3) as $i) {
            BorrowTransaction::create(['student_id' => $this->student->id, 'book_id' => $this->book()->id, 'status' => 'borrowed', 'due_date' => now()->addDay()]);
        }
        $pending = BorrowTransaction::create(['student_id' => $this->student->id, 'book_id' => $this->book()->id, 'status' => 'pending', 'request_date' => now()]);

        Sanctum::actingAs($this->librarian);
        $this->postJson("/api/borrow/{$pending->id}/approve")->assertStatus(422);
    }

    public function test_student_renew_request_and_librarian_approval(): void
    {
        $loan = $this->borrow();
        $due = $loan->due_date->copy();

        Sanctum::actingAs($this->student);
        $this->postJson("/api/borrow/{$loan->id}/renew-request")->assertOk();
        $this->postJson("/api/borrow/{$loan->id}/renew-request")->assertStatus(422);
        $this->assertTrue(Notification::where('user_id', $this->librarian->id)->where('type', 'renewal_request')->exists());

        Sanctum::actingAs($this->librarian);
        $this->getJson('/api/borrow?renewal_requested=1')->assertJsonCount(1, 'data.data');
        $this->postJson("/api/borrow/{$loan->id}/renew")->assertOk();

        $loan->refresh();
        $this->assertSame(1, $loan->renewal_count);
        $this->assertNull($loan->renewal_requested_at);
        $this->assertTrue($loan->due_date->eq($due->addDay()));
    }

    public function test_only_one_renewal_per_loan(): void
    {
        $loan = $this->borrow();

        Sanctum::actingAs($this->librarian);
        $this->postJson("/api/borrow/{$loan->id}/renew")->assertOk();
        $this->postJson("/api/borrow/{$loan->id}/renew")->assertStatus(422);
        $this->postJson("/api/borrow/{$loan->id}/extend", ['additional_days' => 14])->assertStatus(422);

        Sanctum::actingAs($this->student);
        $this->postJson("/api/borrow/{$loan->id}/renew-request")->assertStatus(422);
    }

    public function test_renewal_can_be_declined(): void
    {
        $loan = $this->borrow();
        Sanctum::actingAs($this->student);
        $this->postJson("/api/borrow/{$loan->id}/renew-request")->assertOk();

        Sanctum::actingAs($this->librarian);
        $this->postJson("/api/borrow/{$loan->id}/renew-reject")->assertOk();

        $this->assertNull($loan->fresh()->renewal_requested_at);
        $this->assertSame(0, $loan->fresh()->renewal_count);
    }

    public function test_student_cannot_renew_someone_elses_loan(): void
    {
        $loan = $this->borrow();
        Sanctum::actingAs($this->user('student'));

        $this->postJson("/api/borrow/{$loan->id}/renew-request")->assertForbidden();
    }

    public function test_overdue_return_stores_fine_and_librarian_marks_it_paid(): void
    {
        Setting::setValue('fine_per_day', '5');
        $loan = $this->borrow();

        $this->travelTo($loan->due_date->copy()->addDays(2)->setTime(10, 0));
        Sanctum::actingAs($this->librarian);
        $this->postJson("/api/borrow/{$loan->id}/confirm-return", ['condition' => 'good'])->assertOk();

        $this->assertEquals(10.00, (float) $loan->fresh()->fine_amount);
        $this->getJson('/api/borrow?fine_unpaid=1')->assertJsonCount(1, 'data.data');

        $this->postJson("/api/borrow/{$loan->id}/fine-paid")->assertOk();
        $this->assertNotNull($loan->fresh()->fine_paid_at);
        $this->postJson("/api/borrow/{$loan->id}/fine-paid")->assertStatus(422);
        $this->getJson('/api/borrow?fine_unpaid=1')->assertJsonCount(0, 'data.data');
    }

    public function test_on_time_return_has_no_fine(): void
    {
        Setting::setValue('fine_per_day', '5');
        $loan = $this->borrow();

        Sanctum::actingAs($this->librarian);
        $this->postJson("/api/borrow/{$loan->id}/confirm-return")->assertOk();

        $this->assertEquals(0, (float) $loan->fresh()->fine_amount);
        $this->postJson("/api/borrow/{$loan->id}/fine-paid")->assertStatus(422);
    }

    public function test_librarian_edits_fine_per_day_setting(): void
    {
        Sanctum::actingAs($this->librarian);

        $this->getJson('/api/library-settings')->assertOk()->assertJsonPath('data.fine_per_day', 0);
        $this->putJson('/api/library-settings', ['fine_per_day' => -1])->assertStatus(422);
        $this->putJson('/api/library-settings', ['fine_per_day' => 2.5])->assertOk()->assertJsonPath('data.fine_per_day', 2.5);
        $this->assertSame(2.5, Setting::finePerDay());

        Sanctum::actingAs($this->student);
        $this->getJson('/api/library-settings')->assertForbidden();
    }
}
