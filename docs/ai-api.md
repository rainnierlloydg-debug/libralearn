# Chatbot and book-cover identification API

The Laravel backend keeps provider credentials off the frontend. Both endpoints
require a Sanctum bearer token. Students sign in at `POST /api/auth/login`;
librarians and admins sign in at `POST /api/auth/librarian/login`. Each endpoint
rejects accounts belonging to the other portal, even with a correct password.

## Configure the provider

Set `GEMINI_API_KEY` in your local or hosted backend environment. Optional
`GEMINI_MODEL` overrides the default `gemini-3.5-flash-lite`. Optional
`GEMINI_API_URL` overrides `https://generativelanguage.googleapis.com/v1beta/models`.
Blank optional values use the defaults. After changing configuration, run
`php artisan config:clear` locally or rebuild the configuration cache in production.

Gemini handles both conversation and book-cover image understanding. Optional
`GEMINI_CATALOG_API_KEY` supplies a separate key for cataloging; otherwise it uses
`GEMINI_API_KEY`. Chatbot and insight narration continue to use `GEMINI_API_KEY`.
Optional
`GOOGLE_CLOUD_VISION_API_KEY` adds OCR. Open Library and Google Books fill in missing
book details; `GOOGLE_BOOKS_API_KEY` is optional. The old `OPENAI_*` settings do not
configure these endpoints. Never put provider keys in a `VITE_*` variable.

Provider references: [Gemini models](https://ai.google.dev/gemini-api/docs/models)
and [image understanding](https://ai.google.dev/gemini-api/docs/image-understanding).
Existing `gemini-1.5-*` model settings automatically use the current default,
because [Google shut down Gemini 1.5](https://ai.google.dev/gemini-api/docs/changelog).

## Chatbot

`POST /api/assistant/chat`, JSON request, limit 20 requests per minute per user:

```json
{
  "messages": [{"role": "user", "content": "How do I borrow a book?"}]
}
```

Send 1–12 messages, with roles `user` or `assistant` and at most 2,000 characters
per message. The last message must be a user question. Response:

```json
{"reply": "Open Search Library and choose an available book..."}
```

The assistant receives library guides, matching catalog entries, and the signed-in
student's own loans and reservations. Librarians receive circulation totals and
demand insights. Responses: 401 unauthenticated, 422 invalid input, 429 rate/quota
limit, 503 missing provider key, or 502 provider failure/empty response.

## Identify a book cover

`POST /api/ai/identify-image`, multipart form field `image`, librarian/admin only,
limit 10 requests per minute. JPEG, PNG, or WebP; maximum 5 MB. This is also
available at `POST /api/ai-catalog` for the existing frontend.

Example request using curl (replace placeholders locally):

```sh
curl -X POST http://localhost:8000/api/ai/identify-image \
  -H "Authorization: Bearer YOUR_LOGIN_TOKEN" \
  -H "Accept: application/json" \
  -F "image=@book-cover.jpg"
```

The 201 response contains `success` and `data`: a catalog job with `id`, `status`,
`extracted_text`, `extracted_metadata`, `final_metadata`, and `confidence`.
Processing is synchronous and can take roughly a minute when several providers
are contacted. Inspect `data.status`; `needs_review` means metadata is ready for
human review, while `failed` means processing failed. Undetected fields are marked
`Not detected`. Without AI keys, the job still permits manual metadata entry.

Review a job at `GET /api/ai-catalog/{id}`. Confirm corrected metadata at
`POST /api/ai-catalog/{id}/confirm` with a real `title` and `author`; this creates
the library book. Identification alone does not add a book to the catalog.
Use `POST /api/ai-catalog/{id}/draft` or `/retry` to save or retry.

For public local uploads, run `php artisan storage:link` during initial setup.
Production cover storage uses the existing `COVERS_DISK` configuration.

## Verify locally

```sh
npm test
npm run lint
cd frontend
npm run build
```

On Windows PowerShell with script execution disabled, use `npm.cmd`.
Automated tests fake provider responses and do not spend API quota. A live smoke
test requires your own valid provider key and enabled quota.
