<?php

$geminiModel = env('GEMINI_MODEL') ?: 'gemini-3.5-flash-lite';
// Gemini 1.5 models were shut down. Keep older installations functional.
if (str_starts_with($geminiModel, 'gemini-1.5-')) {
    $geminiModel = 'gemini-3.5-flash-lite';
}

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Google Cloud Vision TEXT_DETECTION for book-cover OCR (backend only).
    'google_vision' => [
        'api_key' => env('GOOGLE_CLOUD_VISION_API_KEY'),
        'api_url' => env('GOOGLE_CLOUD_VISION_API_URL') ?: 'https://vision.googleapis.com/v1/images:annotate',
    ],

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        'catalog_api_key' => env('GEMINI_CATALOG_API_KEY'),
        'api_url' => env('GEMINI_API_URL') ?: 'https://generativelanguage.googleapis.com/v1beta/models',
        'model' => $geminiModel,
    ],

    'open_library' => [
        'api_url' => env('OPEN_LIBRARY_API_URL', 'https://openlibrary.org/search.json'),
    ],

    'google_books' => [
        'api_key' => env('GOOGLE_BOOKS_API_KEY'),
        'api_url' => env('GOOGLE_BOOKS_API_URL', 'https://www.googleapis.com/books/v1/volumes'),
    ],

];
