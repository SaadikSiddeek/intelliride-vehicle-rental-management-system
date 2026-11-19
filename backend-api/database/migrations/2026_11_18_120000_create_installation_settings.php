<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('installation_settings_tb', function (Blueprint $table) {
            $table->unsignedTinyInteger('ID')->primary();
            $table->foreignId('branch_id')->nullable()->constrained('branch_tb', 'ID')->restrictOnDelete();
        });
        $branches = DB::table('branch_tb')->limit(2)->pluck('ID');
        DB::table('installation_settings_tb')->insert(['ID' => 1, 'branch_id' => $branches->count() === 1 ? $branches->first() : null]);
    }

    public function down(): void
    {
        Schema::dropIfExists('installation_settings_tb');
    }
};
