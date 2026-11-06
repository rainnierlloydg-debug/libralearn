<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DeploymentConfigTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_check_route_responds(): void
    {
        $this->get('/up')->assertOk();
    }

    public function test_cors_allows_the_configured_frontend_origin(): void
    {
        config(['cors.allowed_origins' => ['https://libralearn.vercel.app']]);

        $this->withHeaders([
            'Origin' => 'https://libralearn.vercel.app',
            'Access-Control-Request-Method' => 'POST',
        ])->options('/api/auth/login')
            ->assertHeader('Access-Control-Allow-Origin', 'https://libralearn.vercel.app');

        $this->withHeaders([
            'Origin' => 'https://evil.example',
            'Access-Control-Request-Method' => 'POST',
        ])->options('/api/auth/login')
            ->assertHeader('Access-Control-Allow-Origin', 'https://libralearn.vercel.app'); // not the requesting origin, so the browser blocks it
    }

    public function test_queue_worker_tables_exist(): void
    {
        $this->assertTrue(Schema::hasTable('jobs'));
        $this->assertTrue(Schema::hasTable('failed_jobs'));
    }
}
