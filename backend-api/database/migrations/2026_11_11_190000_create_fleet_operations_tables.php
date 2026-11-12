<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_document_tb', function (Blueprint $t) {
            $t->bigIncrements('ID');
            $t->foreignId('vehicle_id')->constrained('vehicle_tb', 'ID')->restrictOnDelete();
            $t->string('document_type', 30);
            $t->string('document_number', 100);
            $t->date('issued_on');
            $t->date('expires_on')->nullable();
            $t->string('path');
            $t->string('current_key', 100)->nullable()->unique();
            $t->foreignId('renewal_of')->nullable()->unique()->constrained('vehicle_document_tb', 'ID')->restrictOnDelete();
            $t->dateTime('superseded_at')->nullable();
            $t->foreignId('uploaded_by')->constrained('users_tb', 'ID')->restrictOnDelete();
            $t->timestamps();
            $t->index(['vehicle_id', 'expires_on']);
        });
        Schema::create('maintenance_tb', function (Blueprint $t) {
            $t->bigIncrements('ID');
            $t->foreignId('vehicle_id')->constrained('vehicle_tb', 'ID')->restrictOnDelete();
            $t->foreignId('availability_block_id')->unique()->constrained('vehicle_unavailability_tb', 'ID')->restrictOnDelete();
            $t->string('service_type', 100);
            $t->dateTime('starts_at');
            $t->dateTime('ends_at');
            $t->string('status', 20);
            $t->text('notes');
            $t->dateTime('completed_at')->nullable();
            $t->foreignId('recorded_by')->constrained('users_tb', 'ID')->restrictOnDelete();
            $t->foreignId('updated_by')->constrained('users_tb', 'ID')->restrictOnDelete();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_tb');
        Schema::dropIfExists('vehicle_document_tb');
    }
};
