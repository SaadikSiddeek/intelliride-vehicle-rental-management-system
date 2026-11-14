<?php

namespace Database\Seeders;

use App\Services\PermissionCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PermissionCatalogSeeder extends Seeder
{
    public function run(): void
    {
        foreach (PermissionCatalog::definitions() as $row) {
            DB::table('permission_tb')->updateOrInsert(['code' => $row['code']], $row);
        }
    }
}
