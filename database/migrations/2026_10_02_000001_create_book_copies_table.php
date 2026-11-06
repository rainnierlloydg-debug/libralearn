<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Physical copies with accession numbers. Loans and reservations point at
 * the copy they used. books.status is kept and synced from the copies.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('book_copies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('book_id')->constrained('books')->onDelete('cascade');
            $table->string('accession_no')->unique();
            $table->foreignId('library_location_id')->nullable()->constrained('library_locations')->onDelete('set null');
            // available, borrowed, reserved, lost, damaged, withdrawn
            $table->string('status', 20)->default('available');
            $table->string('condition')->nullable();
            $table->timestamps();

            $table->index(['book_id', 'status']);
        });

        Schema::table('borrow_transactions', function (Blueprint $table) {
            $table->foreignId('book_copy_id')->nullable()->after('book_id')->constrained('book_copies')->onDelete('set null');
        });

        Schema::table('reservations', function (Blueprint $table) {
            $table->foreignId('book_copy_id')->nullable()->after('book_id')->constrained('book_copies')->onDelete('set null');
        });

        $this->backfill();
    }

    /**
     * One copy per existing library book, with a generated accession number.
     * The copy takes the book's current status; existing loans and
     * reservations are linked to it.
     */
    private function backfill(): void
    {
        $copyStatus = [
            'available' => 'available',
            'borrowed' => 'borrowed',
            'overdue' => 'borrowed',
            'reserved' => 'reserved',
            'lost' => 'lost',
            'damaged' => 'damaged',
        ];

        $next = 1;

        DB::table('books')->where('source', '!=', 'online')->orderBy('id')->each(function ($book) use (&$next, $copyStatus) {
            $now = now();
            $copyId = DB::table('book_copies')->insertGetId([
                'book_id' => $book->id,
                'accession_no' => sprintf('GSA-%06d', $next++),
                'library_location_id' => $book->library_location_id,
                'status' => $copyStatus[$book->status] ?? 'available',
                'condition' => $book->status === 'damaged' ? 'damaged' : 'good',
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('borrow_transactions')->where('book_id', $book->id)->update(['book_copy_id' => $copyId]);
            DB::table('reservations')->where('book_id', $book->id)->update(['book_copy_id' => $copyId]);
        });

        // Overdue now lives on the loan; the book itself is just out.
        DB::table('books')->where('source', '!=', 'online')->where('status', 'overdue')->update(['status' => 'borrowed']);
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('book_copy_id');
        });

        Schema::table('borrow_transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('book_copy_id');
        });

        Schema::dropIfExists('book_copies');
    }
};
