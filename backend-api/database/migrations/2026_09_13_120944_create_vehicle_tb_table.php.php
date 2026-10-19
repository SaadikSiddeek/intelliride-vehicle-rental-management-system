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
        Schema::create('vehicle_tb', function (Blueprint $table) {

            $table->id('ID');

            $table->unsignedBigInteger('branch_id');
            $table->unsignedBigInteger('category_id');
            $table->unsignedBigInteger('brand_id');
            $table->unsignedBigInteger('model_id');
            $table->unsignedBigInteger('fuel_type_id');
            $table->unsignedBigInteger('transmission_type_id');

            $table->string('vehicle_number', 50)->unique();

            $table->year('manufacture_year')->nullable();

            $table->string('color', 50)->nullable();

            $table->string('engine_number', 100)->nullable();
            $table->string('chassis_number', 100)->nullable();

            $table->integer('mileage')->default(0);

            $table->integer('seating_capacity')->nullable();

            // Rental Rates
            $table->decimal('daily_rate', 12, 2)->default(0);
            $table->decimal('weekly_rate', 12, 2)->default(0);
            $table->decimal('monthly_rate', 12, 2)->default(0);

            // Purchase Details
            $table->date('purchase_date')->nullable();
            $table->decimal('purchase_price', 12, 2)->nullable();

            // Documents
            $table->date('insurance_expiry_date')->nullable();
            $table->date('registration_expiry_date')->nullable();

            // Vehicle Status
            $table->string('status', 30)->default('Available');

            $table->timestamps();


            // Branch
            $table->foreign('branch_id')
                ->references('ID')
                ->on('branch_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');


            // Category
            $table->foreign('category_id')
                ->references('ID')
                ->on('vehicle_category_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');


            // Brand
            $table->foreign('brand_id')
                ->references('ID')
                ->on('vehicle_brand_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');


            // Model
            $table->foreign('model_id')
                ->references('ID')
                ->on('vehicle_model_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');


            // Fuel Type
            $table->foreign('fuel_type_id')
                ->references('ID')
                ->on('fuel_type_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');


            // Transmission
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
        Schema::dropIfExists('vehicle_tb');
    }
};
