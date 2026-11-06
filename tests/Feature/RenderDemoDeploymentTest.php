<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\User;
use Database\Seeders\SyntheticDemoSeeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RenderDemoDeploymentTest extends TestCase
{
    public function test_production_seeding_requires_explicit_demo_opt_in(): void
    {
        $this->app['env'] = 'production';
        config(['library.demo.enabled' => false]);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('LIBRARY_DEMO_DATA=true');
        $this->app->make(SyntheticDemoSeeder::class)->run();
    }

    public function test_hosted_demo_rejects_missing_or_short_passwords(): void
    {
        $this->app['env'] = 'production';
        config(['library.demo.enabled' => true, 'library.demo.password' => 'short']);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('at least 12 characters');
        $this->app->make(SyntheticDemoSeeder::class)->run();
    }

    public function test_hosted_synthetic_data_supports_staff_and_student_api_flows(): void
    {
        $this->app['env'] = 'production';
        config([
            'library.demo.enabled' => true,
            'library.demo.password' => 'Hosted-Demo-Password-2026!',
            'filesystems.covers_disk' => 's3',
        ]);
        Storage::fake('s3');
        $this->app->make(SyntheticDemoSeeder::class)->run();
        $admin = User::where('email', 'admin@demo.example')->firstOrFail();
        $student = User::where('email', 'student01@demo.example')->firstOrFail();
        $this->assertTrue(Hash::check('Hosted-Demo-Password-2026!', $admin->password));
        $this->assertFalse(Hash::check('Demo12345!', $admin->password));
        $this->assertSame(18, Book::where('isbn', 'like', 'SYN-BOOK-%')->count());
        foreach (Book::all() as $book) {
            Storage::disk('s3')->assertExists($book->cover_image);
        }

        $this->get('/up')->assertOk();
        foreach (['/api/landing/stats', '/api/landing/featured-book', '/api/auth/registration-interests'] as $url) {
            $this->getJson($url)->assertOk()->assertJsonPath('success', true);
        }
        foreach ([[$admin, '/api/auth/librarian/login'], [$student, '/api/auth/login']] as [$user, $url]) {
            Auth::forgetGuards();
            $this->postJson($url, ['login' => $user->email, 'password' => 'Hosted-Demo-Password-2026!'])
                ->assertOk()->assertJsonPath('user.id', $user->id)->assertJsonStructure(['token']);
        }

        Sanctum::actingAs($admin);
        $book = Book::firstOrFail();
        foreach ([
            '/api/auth/me', '/api/books', '/api/books/genres', '/api/books/subjects',
            '/api/books/available', '/api/books/'.$book->id, '/api/books/'.$book->id.'/copies',
            '/api/borrow', '/api/reservations', '/api/ai-catalog', '/api/users', '/api/library-settings',
            '/api/dashboard/librarian', '/api/notifications', '/api/notifications/unread-count',
            '/api/library-locations', '/api/library-locations/map', '/api/interests',
            '/api/reports/books', '/api/reports/borrowing', '/api/reports/student-activity',
            '/api/reports/ai-cataloging', '/api/ai/insights?months=6',
        ] as $url) {
            $this->getJson($url)->assertOk()->assertJsonPath('success', true);
        }

        Sanctum::actingAs($student);
        foreach ([
            '/api/auth/me', '/api/dashboard/student', '/api/books', '/api/borrow', '/api/reservations',
            '/api/saved-books', '/api/recommendations', '/api/recommendations/interests',
            '/api/notifications', '/api/online-search/history', '/api/library-locations/map',
        ] as $url) {
            $this->getJson($url)->assertOk()->assertJsonPath('success', true);
        }
        $this->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/ai/insights')->assertForbidden();
    }
}
