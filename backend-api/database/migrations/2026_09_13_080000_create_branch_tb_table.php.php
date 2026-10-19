<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('branch_tb', function (Blueprint $table) {
            $table->id('ID');

            $table->string('branch_name', 100);
            $table->string('branch_code', 50)->unique();
            $table->text('address')->nullable();
            $table->string('contact_number', 20)->nullable();

            $table->unsignedBigInteger('manager_id')->nullable();

            $table->boolean('status')->default(true);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('branch_tb');
    }
};
