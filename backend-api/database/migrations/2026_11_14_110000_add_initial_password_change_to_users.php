<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users_tb', function (Blueprint $table) {
            // Existing accounts remain unchanged; only the empty-install command opts in.
            $table->boolean('must_change_password')->default(false);
        });
    }

    public function down(): void
    {
        throw new RuntimeException('First-login security state requires reviewed forward recovery.');
    }
};
