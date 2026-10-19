<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('staff_tb', function (Blueprint $table) {

            $table->id('ID');

            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('branch_id');
            $table->unsignedBigInteger('designation_id');
            $table->unsignedBigInteger('department_id');

            $table->string('emp_code', 50)->unique();

            $table->string('first_name', 100);
            $table->string('last_name', 100);

            $table->string('nic', 50)->nullable();

            $table->string('phone', 20);
            $table->string('email', 150)->nullable();

            $table->text('address')->nullable();

            $table->date('join_date')->nullable();

            $table->string('gender', 20)->nullable();

            $table->boolean('status')->default(true);

            $table->timestamps();


            // User Account
            $table->foreign('user_id')
                ->references('ID')
                ->on('users_tb')
                ->onDelete('set null')
                ->onUpdate('cascade');


            // Branch
            $table->foreign('branch_id')
                ->references('ID')
                ->on('branch_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');


            // Designation
            $table->foreign('designation_id')
                ->references('ID')
                ->on('designation_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');


            // Department
            $table->foreign('department_id')
                ->references('ID')
                ->on('department_tb')
                ->onDelete('restrict')
                ->onUpdate('cascade');

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_tb');
    }
};