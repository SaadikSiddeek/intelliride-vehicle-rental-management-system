<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        /*
        |--------------------------------------------------------------------------
        | Create Default Branch
        |--------------------------------------------------------------------------
        */

        $branchId = DB::table('branch_tb')->insertGetId([
            'branch_name' => 'Main Branch',
            'branch_code' => 'MAIN',
            'address' => 'IntelliRide Main Branch',
            'contact_number' => null,
            'manager_id' => null,
            'status' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);


        /*
        |--------------------------------------------------------------------------
        | Create Admin Role
        |--------------------------------------------------------------------------
        */

        $adminRoleId = DB::table('roles_tb')->insertGetId([
            'role_name' => 'Admin',
            'description' => 'System Administrator',
            'branch_id' => $branchId,
            'status' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);


        /*
        |--------------------------------------------------------------------------
        | Create Default Admin User
        |--------------------------------------------------------------------------
        */

        DB::table('users_tb')->insert([
            'role_id' => $adminRoleId,
            'branch_id' => $branchId,
            'username' => 'admin',
            'email' => 'admin@intelliride.com',
            'password' => Hash::make('Admin@123'),
            'emp_id' => 'ADMIN001',
            'status' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}