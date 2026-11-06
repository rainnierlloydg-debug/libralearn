<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * users.status becomes a plain string so it can hold pending and rejected
 * (and works the same on PostgreSQL). Existing values are kept as they are.
 */
return new class extends Migration
{
    public function up(): void
    {
        // PostgreSQL enums are a CHECK constraint that ->change() keeps.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_status_check"');
        }

        Schema::table('users', function (Blueprint $table) {
            // active, inactive, pending, rejected
            $table->string('status', 20)->default('active')->change();
        });
    }

    public function down(): void
    {
        // The old enum has no pending/rejected; those accounts stay locked out as inactive.
        DB::table('users')->whereIn('status', ['pending', 'rejected'])->update(['status' => 'inactive']);

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE "users" ADD CONSTRAINT "users_status_check" CHECK ("status" IN (\'active\', \'inactive\'))');

            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->enum('status', ['active', 'inactive'])->default('active')->change();
        });
    }
};
