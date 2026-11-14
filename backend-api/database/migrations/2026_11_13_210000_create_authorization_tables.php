<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('authorization_state_tb', function (Blueprint $t) {
            $t->unsignedInteger('ID')->primary();
            $t->boolean('enabled')->default(false);
            $t->timestamps();
        });
        DB::table('authorization_state_tb')->insert(['ID' => 1, 'enabled' => false, 'created_at' => now(), 'updated_at' => now()]);
        // Install the inactive state first so existing sessions retain legacy access during additive DDL.
        Schema::table('users_tb', function (Blueprint $t) {
            $t->string('user_type', 20)->default('user');
            $t->unsignedBigInteger('managed_by_user_id')->nullable()->index();
            $t->foreign('managed_by_user_id')->references('ID')->on('users_tb')->restrictOnDelete();
        });
        Schema::create('permission_tb', function (Blueprint $t) {
            $t->string('code', 100)->primary();
            $t->string('group_name', 50);
            $t->string('module_name', 60);
            $t->string('action_name', 50);
        });
        Schema::create('role_permission_tb', function (Blueprint $t) {
            $t->unsignedBigInteger('role_id');
            $t->string('permission_code', 100);
            $t->primary(['role_id', 'permission_code']);
            $t->foreign('role_id')->references('ID')->on('roles_tb')->restrictOnDelete();
            $t->foreign('permission_code')->references('code')->on('permission_tb')->restrictOnDelete();
        });
        Schema::create('user_permission_tb', function (Blueprint $t) {
            $t->unsignedBigInteger('user_id');
            $t->string('permission_code', 100);
            $t->string('effect', 5);
            $t->primary(['user_id', 'permission_code']);
            $t->foreign('user_id')->references('ID')->on('users_tb')->restrictOnDelete();
            $t->foreign('permission_code')->references('code')->on('permission_tb')->restrictOnDelete();
        });
        Schema::create('admin_permission_scope_tb', function (Blueprint $t) {
            $t->unsignedBigInteger('user_id');
            $t->string('permission_code', 100);
            $t->boolean('delegable')->default(false);
            $t->primary(['user_id', 'permission_code']);
            $t->foreign('user_id')->references('ID')->on('users_tb')->restrictOnDelete();
            $t->foreign('permission_code')->references('code')->on('permission_tb')->restrictOnDelete();
        });
        Schema::create('authorization_audit_tb', function (Blueprint $t) {
            $t->id('ID');
            $t->unsignedBigInteger('actor_user_id')->nullable()->index();
            $t->unsignedBigInteger('target_user_id')->nullable()->index();
            $t->string('action', 60);
            $t->string('reason', 500);
            $t->json('before_state');
            $t->json('after_state');
            $t->timestamp('created_at');
        });
    }

    public function down(): void
    {
        // Automatic rollback must never erase an active authorization installation.
        throw new RuntimeException('Authorization data requires an explicitly reviewed forward recovery plan.');
    }
};
