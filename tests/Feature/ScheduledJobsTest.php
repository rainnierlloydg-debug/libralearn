<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BorrowTransaction;
use App\Models\Notification;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class ScheduledJobsTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        config(['library.timezone' => 'Asia/Manila']);

        // Frozen clock: 2026-10-05 08:00 in Manila (00:00 UTC).
        $this->travelTo(Carbon::parse('2026-10-05 08:00', 'Asia/Manila'));

        $this->student = User::factory()->create(['role' => 'student', 'school_id' => 'S-' . Str::random(6), 'status' => 'active']);
    }

    private function loan(string $dueManila, string $status = 'borrowed'): BorrowTransaction
    {
        $book = Book::create(['title' => 'Book ' . Str::random(4), 'author' => 'A', 'source' => 'gsa']);
        $book->copies()->first()->update(['status' => 'borrowed']);

        return BorrowTransaction::create([
            'student_id' => $this->student->id,
            'book_id' => $book->id,
            'book_copy_id' => $book->copies()->first()->id,
            'borrow_date' => now()->subDays(3),
            'due_date' => Carbon::parse($dueManila, 'Asia/Manila')->utc(),
            'status' => $status,
        ]);
    }

    private function notificationsOfType(string $type): int
    {
        return Notification::where('user_id', $this->student->id)->where('type', $type)->count();
    }

    public function test_mark_overdue_flags_only_past_due_borrowed_loans(): void
    {
        $late = $this->loan('2026-10-04 15:00');
        $notYet = $this->loan('2026-10-05 15:00');
        $returning = $this->loan('2026-10-03 15:00', 'return_requested');

        $this->artisan('library:mark-overdue')->assertSuccessful();

        $this->assertSame('overdue', $late->fresh()->status);
        $this->assertSame('borrowed', $notYet->fresh()->status);
        $this->assertSame('return_requested', $returning->fresh()->status);
        $this->assertSame('borrowed', $late->bookCopy->fresh()->status, 'copy stays borrowed');
        $this->assertSame(1, $this->notificationsOfType('overdue'));

        // Running again does not double-notify.
        $this->artisan('library:mark-overdue')->assertSuccessful();
        $this->assertSame(1, $this->notificationsOfType('overdue'));
    }

    public function test_due_reminder_is_sent_one_day_before_on_school_calendar(): void
    {
        $tomorrowMorning = $this->loan('2026-10-06 07:00'); // 2026-10-05 23:00 UTC, still "tomorrow" in Manila
        $tomorrowAfternoon = $this->loan('2026-10-06 16:00');
        $today = $this->loan('2026-10-05 17:00');
        $dayAfter = $this->loan('2026-10-07 10:00');

        $this->artisan('library:send-due-reminders')->assertSuccessful();

        $this->assertSame(2, $this->notificationsOfType('due_reminder'));
        $this->assertSame('2026-10-06', substr((string) $tomorrowMorning->fresh()->reminded_due_date, 0, 10));
        $this->assertNotNull($tomorrowAfternoon->fresh()->reminded_due_date);
        $this->assertNull($today->fresh()->reminded_due_date);
        $this->assertNull($dayAfter->fresh()->reminded_due_date);
    }

    public function test_due_reminder_is_not_repeated_but_a_renewed_due_date_gets_one(): void
    {
        $loan = $this->loan('2026-10-06 16:00');

        $this->artisan('library:send-due-reminders');
        $this->artisan('library:send-due-reminders');
        $this->assertSame(1, $this->notificationsOfType('due_reminder'));

        // Renewed by one day; the next morning the new due date is tomorrow again.
        $loan->update(['due_date' => $loan->due_date->copy()->addDay()]);
        $this->travelTo(Carbon::parse('2026-10-06 08:00', 'Asia/Manila'));

        $this->artisan('library:send-due-reminders');
        $this->assertSame(2, $this->notificationsOfType('due_reminder'));
    }

    public function test_expire_reservations_releases_held_copy(): void
    {
        $book = Book::create(['title' => 'Held', 'author' => 'A', 'source' => 'gsa']);
        $copy = $book->copies()->first();
        $copy->update(['status' => 'reserved']);

        $expired = Reservation::create([
            'student_id' => $this->student->id, 'book_id' => $book->id, 'book_copy_id' => $copy->id,
            'reservation_date' => now()->subDays(4), 'status' => 'ready_for_pickup', 'pickup_deadline' => now()->subHour(),
        ]);
        $stillValid = Reservation::create([
            'student_id' => $this->student->id, 'book_id' => $book->id,
            'reservation_date' => now(), 'status' => 'ready_for_pickup', 'pickup_deadline' => now()->addDay(),
        ]);

        $this->artisan('library:expire-reservations')->assertSuccessful();

        $this->assertSame('expired', $expired->fresh()->status);
        $this->assertSame('ready_for_pickup', $stillValid->fresh()->status);
        $this->assertSame('available', $copy->fresh()->status);
        $this->assertSame('available', $book->fresh()->status);
        $this->assertSame(1, $this->notificationsOfType('reservation_expired'));
    }

    public function test_jobs_are_scheduled(): void
    {
        $commands = collect(app(Schedule::class)->events())->map(fn ($e) => $e->command)->implode("\n");

        $this->assertStringContainsString('library:mark-overdue', $commands);
        $this->assertStringContainsString('library:send-due-reminders', $commands);
        $this->assertStringContainsString('library:expire-reservations', $commands);
    }
}
