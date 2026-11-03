<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class GeminiClient
{
    public function generate(array $payload, int $timeout = 30, ?string $apiKey = null): Response
    {
        $url = rtrim(config('services.gemini.api_url'), '/') . '/' . config('services.gemini.model') . ':generateContent';

        return Http::acceptJson()->connectTimeout(5)->timeout($timeout)
            ->withHeaders(['X-Goog-Api-Key' => $apiKey ?? config('services.gemini.api_key')])
            ->post($url, $payload);
    }

    public function text(Response $response): string
    {
        $parts = $response->json('candidates.0.content.parts', []);

        return collect(is_array($parts) ? $parts : [])
            ->filter(fn ($part) => is_array($part) && empty($part['thought']) && is_string($part['text'] ?? null))
            ->pluck('text')->implode('');
    }

    public function redact(string $message): string
    {
        $keys = array_filter([
            config('services.gemini.api_key'),
            config('services.gemini.catalog_api_key'),
            config('services.google_vision.api_key'),
            config('services.google_books.api_key'),
        ]);

        return str_replace($keys, '[redacted]', preg_replace('/([?&]key=)[^&\s]+/i', '$1[redacted]', $message));
    }
}
