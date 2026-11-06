<?php

namespace Tests\Feature;

use App\Models\BorrowTransaction;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HostedDemoStartupTest extends TestCase
{
    public function test_restarts_skip_the_initialized_dataset_and_preserve_workflow_changes(): void
    {
        Storage::fake('public');
        config(['library.demo.enabled' => true, 'filesystems.covers_disk' => 'public']);
        $this->artisan('library:seed-demo')->assertSuccessful();
        $this->assertSame(25, User::count());
        $loan = BorrowTransaction::where('status', 'borrowed')->firstOrFail();
        $loan->update(['status' => 'returned', 'return_date' => now()]);
        $counts = [User::count(), BorrowTransaction::count()];

        $this->artisan('library:seed-demo')
            ->expectsOutputToContain('already initialized')
            ->assertSuccessful();
        $this->assertSame($counts, [User::count(), BorrowTransaction::count()]);
        $this->assertSame('returned', $loan->fresh()->status);
    }

    public function test_startup_does_not_seed_without_demo_opt_in(): void
    {
        config(['library.demo.enabled' => false]);
        $this->artisan('library:seed-demo')->assertSuccessful();
        $this->assertSame(0, User::count());
    }
}
