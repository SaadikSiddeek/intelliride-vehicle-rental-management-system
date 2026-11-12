<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_tb', function (Blueprint $table) {
            $table->bigIncrements('ID');
            $table->foreignId('customer_id')->constrained('customer_tb', 'ID')->restrictOnDelete();
            $table->foreignId('vehicle_id')->constrained('vehicle_tb', 'ID')->restrictOnDelete();
            $table->foreignId('package_id')->constrained('rental_package_tb', 'ID')->restrictOnDelete();
            $table->foreignId('pickup_branch_id')->constrained('branch_tb', 'ID')->restrictOnDelete();
            $table->foreignId('return_branch_id')->constrained('branch_tb', 'ID')->restrictOnDelete();
            // Business wall-clock times in the configured rental timezone.
            $table->dateTime('pickup_at');
            $table->dateTime('expected_return_at');
            $table->string('status', 30)->default('Draft');
            $table->string('payment_status', 20)->default('Unpaid');
            $table->json('pricing_snapshot');
            $table->decimal('subtotal', 14, 2);
            $table->decimal('discount', 14, 2)->default(0);
            $table->decimal('tax', 14, 2)->default(0);
            $table->decimal('total', 14, 2);
            $table->decimal('security_deposit', 14, 2)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by');
            $table->timestamps();
            $table->index(['vehicle_id', 'status', 'pickup_at', 'expected_return_at'], 'booking_availability_index');
        });

        Schema::create('booking_payment_tb', function (Blueprint $table) {
            $table->bigIncrements('ID');
            $table->foreignId('booking_id')->constrained('booking_tb', 'ID')->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            $table->string('method', 20);
            $table->date('paid_on');
            $table->string('reference', 150)->nullable();
            $table->unsignedBigInteger('recorded_by');
            $table->timestamps();
        });

        // Shared availability calendar, used by handover and maintenance in later phases.
        Schema::create('vehicle_unavailability_tb', function (Blueprint $table) {
            $table->bigIncrements('ID');
            $table->foreignId('vehicle_id')->constrained('vehicle_tb', 'ID')->restrictOnDelete();
            $table->foreignId('booking_id')->nullable()->constrained('booking_tb', 'ID')->restrictOnDelete();
            $table->string('kind', 30);
            $table->string('status', 20)->default('Scheduled');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['vehicle_id', 'status', 'starts_at', 'ends_at'], 'vehicle_unavailability_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_unavailability_tb');
        Schema::dropIfExists('booking_payment_tb');
        Schema::dropIfExists('booking_tb');
    }
};
