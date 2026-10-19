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
        Schema::create('vehicle_feature_map_tb', function (Blueprint $table) {

            $table->id('ID');

            $table->unsignedBigInteger('vehicle_id');
            $table->unsignedBigInteger('feature_id');

            $table->timestamps();


            $table->foreign('vehicle_id')
                ->references('ID')
                ->on('vehicle_tb')
                ->onDelete('cascade')
                ->onUpdate('cascade');


            $table->foreign('feature_id')
                ->references('ID')
                ->on('vehicle_feature_tb')
                ->onDelete('cascade')
                ->onUpdate('cascade');


            $table->unique(['vehicle_id', 'feature_id']);

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vehicle_feature_map_tb');
    }
};
