<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $now = now();

            // Create the default branch only if it does not exist.
            $branchId = DB::table('branch_tb')
                ->where('branch_code', 'MAIN')
                ->value('ID');

            if ($branchId === null) {
                $branchId = DB::table('branch_tb')->insertGetId([
                    'branch_name' => 'Main Branch',
                    'branch_code' => 'MAIN',
                    'address' => 'IntelliRide Main Branch',
                    'contact_number' => null,
                    'manager_id' => null,
                    'status' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ], 'ID');
            }

            // Create the branch's Admin role only if it does not exist.
            $adminRoleId = DB::table('roles_tb')
                ->where('role_name', 'Admin')
                ->where('branch_id', $branchId)
                ->value('ID');

            if ($adminRoleId === null) {
                $adminRoleId = DB::table('roles_tb')->insertGetId([
                    'role_name' => 'Admin',
                    'description' => 'System Administrator',
                    'branch_id' => $branchId,
                    'status' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ], 'ID');
            }

            // Preserve an existing admin account and its password.
            $adminExists = DB::table('users_tb')
                ->where(function ($query) {
                    $query->where('username', 'admin')
                        ->orWhere('email', 'admin@intelliride.com')
                        ->orWhere('emp_id', 'ADMIN001');
                })
                ->exists();

            if (! $adminExists) {
                DB::table('users_tb')->insert([
                    'role_id' => $adminRoleId,
                    'branch_id' => $branchId,
                    'username' => 'admin',
                    'email' => 'admin@intelliride.com',
                    'password' => Hash::make('Admin@123'),
                    'emp_id' => 'ADMIN001',
                    'status' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });
    }
}
