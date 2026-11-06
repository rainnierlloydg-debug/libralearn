<?php

namespace Database\Seeders;

use App\Models\Book;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/** Attach bundled illustrations to matching titles that have no cover. */
class BookCoverSeeder extends Seeder
{
    public function run(): void
    {
        if (!app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('Bundled library covers can only be seeded in local/testing environments.');
        }

        $manifest = json_decode(file_get_contents(database_path('assets/book-covers/manifest.json')), true, flags: JSON_THROW_ON_ERROR);
        $disk = Storage::disk(config('filesystems.covers_disk', 'public'));
        $count = DB::transaction(function () use ($manifest, $disk) {
            $count = 0;
            foreach ($manifest as $cover) {
                $books = Book::where('title', $cover['title'])->where('author', $cover['author'])
                    ->where(fn ($query) => $query->whereNull('cover_image')->orWhere('cover_image', ''));
                if (!(clone $books)->exists()) {
                    continue;
                }
                $source = database_path('assets/book-covers/'.$cover['file']);
                if (!is_file($source)) {
                    throw new \RuntimeException('Missing bundled cover: '.$cover['file']);
                }
                $path = 'book-covers/synthetic/'.$cover['file'];
                if (!$disk->put($path, file_get_contents($source))) {
                    throw new \RuntimeException('Could not save bundled cover: '.$cover['file']);
                }
                $count += $books->update(['cover_image' => $path]);
            }

            return $count;
        });

        $this->command?->info('Attached '.$count.' book covers.');
    }
}
