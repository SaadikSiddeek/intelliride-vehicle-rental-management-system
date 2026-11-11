<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_tb', function (Blueprint $table) {
            $table->bigIncrements('ID');

            // Basic details
            $table->string('customer_type', 10);
            $table->string('full_name', 150)->index();

            // Contact details
            $table->string('mobile', 30)->index();
            $table->string('email', 255)->nullable();
            $table->string('address', 500)->nullable();
            $table->string('country', 100)->nullable();

            // NIC or passport details
            $table->string('document_type', 10)->nullable();
            $table->string('document_number', 50)->nullable();
            $table->date('document_expiry')->nullable();

            // Driving licence details
            $table->string('licence_number', 50)->nullable();
            $table->string('licence_country', 100)->nullable();
            $table->date('licence_expiry')->nullable();

            // Emergency contact
            $table->string('emergency_name', 150)->nullable();
            $table->string('emergency_number', 30)->nullable();

            // Internal details
            $table->text('notes')->nullable();
            $table->string('status', 10)->default('Active');
            $table->string('block_reason', 500)->nullable();

            $table->timestamps();
        });

        Schema::create('customer_document_tb', function (Blueprint $table) {
            $table->bigIncrements('ID');

            // Matches the type of customer_tb.ID.
            $table->unsignedBigInteger('customer_id');

            // Examples: nic_front, nic_back, passport, licence_front, licence_back.
            $table->string('kind', 20);

            // Relative path of the image in private storage.
            $table->string('path', 255);

            $table->timestamps();

            // Each customer can have one current image per document slot.
            $table->unique(['customer_id', 'kind']);

            $table->foreign('customer_id')
                ->references('ID')
                ->on('customer_tb')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        // Drop the child table first because it references customer_tb.
        Schema::dropIfExists('customer_document_tb');
        Schema::dropIfExists('customer_tb');
    }
};
