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
        Schema::create('vehicle_model_tb', function (Blueprint $table) {

            $table->id('ID');

            $table->unsignedBigInteger('brand_id');
            $table->unsignedBigInteger('fuel_type_id');
            $table->unsignedBigInteger('transmission_type_id');

            $table->string('model_name', 100);
            $table->year('manufacture_year')->nullable();
            $table->string('engine_capacity', 50)->nullable();

            $table->boolean('status')->default(true);

            $table->timestamps();


            // Brand
            $table->foreign('brand_id')
                ->references('ID')
                ->on('vehicle_brand_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');


            // Fuel Type
            $table->foreign('fuel_type_id')
                ->references('ID')
                ->on('fuel_type_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');


            // Transmission Type
            $table->foreign('transmission_type_id')
                ->references('ID')
                ->on('transmission_type_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vehicle_model_tb');
    }
};
