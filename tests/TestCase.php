<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Each test creates its own data. Never call real AI providers in tests.
        config(['services.gemini.api_key' => null, 'services.gemini.catalog_api_key' => null, 'services.google_vision.api_key' => null]);
        config(['library.forecasting.enabled' => false]);
        \Illuminate\Support\Facades\Http::preventStrayRequests();
    }
}
