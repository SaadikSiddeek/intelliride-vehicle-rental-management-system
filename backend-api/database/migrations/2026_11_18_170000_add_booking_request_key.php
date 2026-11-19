<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_tb', function (Blueprint $t) {
            $t->uuid('request_id')->nullable()->unique();
            $t->string('request_hash', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('booking_tb', function (Blueprint $t) {
            $t->dropUnique(['request_id']);
            $t->dropColumn(['request_id', 'request_hash']);
        });
    }
};
