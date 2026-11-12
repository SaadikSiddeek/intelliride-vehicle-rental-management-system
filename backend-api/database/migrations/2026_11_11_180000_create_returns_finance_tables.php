<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_return_tb', function (Blueprint $t) {
            $t->bigIncrements('ID');
            $t->foreignId('rental_id')->unique()->constrained('rental_tb', 'ID')->restrictOnDelete();
            $t->dateTime('actual_return_at');
            $t->unsignedInteger('ending_odometer');
            $t->decimal('return_fuel_litres', 8, 3);
            $t->text('condition_notes');
            $t->text('new_damage')->nullable();
            $t->decimal('damage_estimate', 14, 2)->default(0);
            $t->decimal('damage_charge', 14, 2)->default(0);
            $t->text('damage_reason')->nullable();
            $t->string('vehicle_after_return', 30)->default('Inspection Required');
            $t->boolean('apply_deposit')->default(false);
            $t->string('status', 25)->default('Draft Assessment');
            $t->unsignedInteger('revision')->default(1);
            $t->foreignId('received_by')->constrained('users_tb', 'ID')->restrictOnDelete();
            $t->foreignId('receiving_staff_id')->nullable()->constrained('staff_tb', 'ID')->restrictOnDelete();
            $t->string('receiving_staff_name', 220);
            $t->foreignId('reviewed_by')->nullable()->constrained('users_tb', 'ID')->restrictOnDelete();
            $t->text('review_notes')->nullable();
            $t->dateTime('finalized_at')->nullable();
            $t->json('final_snapshot')->nullable();
            $t->timestamps();
        });
        Schema::create('invoice_tb', function (Blueprint $t) {
            $t->bigIncrements('ID');
            $t->foreignId('rental_id')->unique()->constrained('rental_tb', 'ID')->restrictOnDelete();
            $t->foreignId('booking_id')->constrained('booking_tb', 'ID')->restrictOnDelete();
            $t->foreignId('return_id')->unique()->constrained('rental_return_tb', 'ID')->restrictOnDelete();
            $t->date('issued_on');
            $t->string('status', 20)->default('Issued');
            $t->decimal('subtotal', 14, 2);
            $t->decimal('discount', 14, 2);
            $t->decimal('tax', 14, 2);
            $t->decimal('additional_charges', 14, 2);
            $t->decimal('total', 14, 2);
            $t->decimal('booking_advance_amount', 14, 2);
            $t->json('snapshot');
            $t->foreignId('issued_by')->constrained('users_tb', 'ID')->restrictOnDelete();
            $t->timestamps();
        });
        Schema::create('invoice_payment_tb', function (Blueprint $t) {
            $t->bigIncrements('ID');
            $t->foreignId('invoice_id')->constrained('invoice_tb', 'ID')->restrictOnDelete();
            $t->uuid('request_id')->unique();
            $t->decimal('amount', 14, 2);
            $t->string('method', 20);
            $t->string('reference', 150)->nullable();
            $t->date('paid_on');
            $t->foreignId('recorded_by')->constrained('users_tb', 'ID')->restrictOnDelete();
            $t->timestamps();
        });
        Schema::table('rental_deposit_tb', function (Blueprint $t) {
            $t->foreignId('invoice_id')->nullable()->constrained('invoice_tb', 'ID')->restrictOnDelete();
            $t->string('settlement_key', 100)->nullable()->unique();
        });
        Schema::create('rental_return_audit_tb', function (Blueprint $t) {
            $t->bigIncrements('ID');
            $t->foreignId('return_id')->constrained('rental_return_tb', 'ID')->restrictOnDelete();
            $t->unsignedInteger('revision');
            $t->string('action', 30);
            $t->json('snapshot');
            $t->foreignId('recorded_by')->constrained('users_tb', 'ID')->restrictOnDelete();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_return_audit_tb');
        Schema::table('rental_deposit_tb', function (Blueprint $t) {
            $t->dropConstrainedForeignId('invoice_id');
            $t->dropUnique(['settlement_key']);
            $t->dropColumn('settlement_key');
        });
        Schema::dropIfExists('invoice_payment_tb');
        Schema::dropIfExists('invoice_tb');
        Schema::dropIfExists('rental_return_tb');
    }
};
