<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_tb', function (Blueprint $table) {
            // IMAGE FUNCTIONALITY:
            // Stores multiple image IDs and relative file paths.
            $table->json('vehicle_image')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_tb', function (Blueprint $table) {
            $table->dropColumn('vehicle_image');
        });
    }
};
