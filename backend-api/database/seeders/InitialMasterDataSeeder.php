<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class InitialMasterDataSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $branch = app(\App\Services\InstallationBranch::class)->initialize();
            $sets = [
                ['department_tb', 'department_name', ['Administration', 'Operations', 'Customer Service', 'Finance', 'Fleet Management', 'Maintenance'], true],
                ['designation_tb', 'designation_name', ['Branch Manager', 'Rental Officer', 'Customer Service Officer', 'Fleet Officer', 'Finance Officer', 'Maintenance Officer'], true],
                ['fuel_type_tb', 'fuel_type_name', ['Petrol', 'Diesel', 'Hybrid', 'Electric'], false],
                ['transmission_type_tb', 'transmission_name', ['Manual', 'Automatic'], false],
                ['vehicle_category_tb', 'category_name', ['Sedan', 'Hatchback', 'SUV', 'Van'], false],
            ];
            foreach ($sets as [$table, $column, $names, $scoped]) {
                foreach ($names as $name) {
                    $q = DB::table($table)->where($column, $name);
                    if ($scoped) $q->where('branch_id', $branch);
                    if (! $q->exists()) {
                        DB::table($table)->insert([$column => $name, 'status' => true, 'created_at' => now(), 'updated_at' => now(), ...($scoped ? ['branch_id' => $branch] : [])]);
                    }
                }
            }
            // Empty templates deliberately grant nothing until reviewed by Super Admin.
            foreach (['Installation Administrator', 'Rental Officer', 'Finance Officer', 'Fleet Officer'] as $name) {
                if (! DB::table('roles_tb')->where('role_name', $name)->where('branch_id', $branch)->exists()) {
                    DB::table('roles_tb')->insert(['role_name' => $name, 'description' => 'Permission template — review and assign access before use.', 'branch_id' => $branch, 'status' => true, 'created_at' => now(), 'updated_at' => now()]);
                }
            }
        });
    }
}
