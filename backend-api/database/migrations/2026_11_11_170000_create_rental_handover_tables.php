<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_tb', function (Blueprint $table) {
            $table->bigIncrements('ID');
            $table->foreignId('booking_id')->unique()->constrained('booking_tb', 'ID')->restrictOnDelete();
            $table->foreignId('vehicle_id')->constrained('vehicle_tb', 'ID')->restrictOnDelete();
            $table->foreignId('customer_id')->constrained('customer_tb', 'ID')->restrictOnDelete();
            $table->foreignId('pickup_branch_id')->constrained('branch_tb', 'ID')->restrictOnDelete();
            $table->foreignId('availability_block_id')->unique()->constrained('vehicle_unavailability_tb', 'ID')->restrictOnDelete();
            $table->foreignId('handed_over_by')->constrained('users_tb', 'ID')->restrictOnDelete();
            $table->foreignId('handover_staff_id')->nullable()->constrained('staff_tb', 'ID')->restrictOnDelete();
            $table->string('handover_staff_name', 220);
            $table->dateTime('actual_pickup_at');
            $table->unsignedInteger('starting_odometer');
            $table->decimal('pickup_fuel_litres', 8, 3);
            $table->string('driver_name', 150);
            $table->string('driver_document_number', 50);
            $table->string('driver_licence_number', 50);
            $table->date('driver_licence_expiry');
            $table->boolean('identity_verified');
            $table->boolean('licence_verified');
            $table->text('existing_damage')->nullable();
            $table->text('condition_notes');
            $table->string('agreement_reference', 150);
            $table->dateTime('agreement_accepted_at');
            $table->json('pricing_snapshot');
            $table->json('rental_snapshot');
            $table->string('status', 25)->default('Active');
            $table->timestamps();
            $table->index(['vehicle_id', 'status']);
        });
        Schema::create('rental_deposit_tb', function (Blueprint $table) {
            $table->bigIncrements('ID');
            $table->foreignId('rental_id')->constrained('rental_tb', 'ID')->restrictOnDelete();
            $table->string('entry_type', 20);
            $table->decimal('amount', 14, 2);
            $table->string('method', 20)->nullable();
            $table->string('reference', 150)->nullable();
            $table->text('reason');
            $table->foreignId('recorded_by')->constrained('users_tb', 'ID')->restrictOnDelete();
            $table->timestamps();
        });
        Schema::create('rental_photo_tb', function (Blueprint $table) {
            $table->bigIncrements('ID');
            $table->foreignId('rental_id')->constrained('rental_tb', 'ID')->restrictOnDelete();
            $table->string('stage', 20);
            $table->string('path');
            $table->foreignId('uploaded_by')->constrained('users_tb', 'ID')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_photo_tb');
        Schema::dropIfExists('rental_deposit_tb');
        Schema::dropIfExists('rental_tb');
    }
};
