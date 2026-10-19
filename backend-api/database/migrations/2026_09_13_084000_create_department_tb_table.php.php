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
        Schema::create('department_tb', function (Blueprint $table) {
            $table->id('ID');
            $table->string('department_name', 100);
            $table->text('description')->nullable();
            $table->unsignedBigInteger('branch_id');
            $table->boolean('status')->default(true);
            $table->timestamps();

            $table->foreign('branch_id')
                ->references('ID')
                ->on('branch_tb')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('department_tb_tables');
    }
};
