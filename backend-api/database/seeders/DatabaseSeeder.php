<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Reference data only. Owner credentials require the private interactive command.
        DB::transaction(function () {
            // Serialize with other normal seeding/initialization processes.
            $state = DB::table('authorization_state_tb')->where('ID', 1)->lockForUpdate()->first();
            if (! $state) {
                throw new \RuntimeException('Review/apply migrations and repair missing authorization state before seeding.');
            }
            $this->call([
                InitialMasterDataSeeder::class,
                PermissionCatalogSeeder::class,
            ]);
        });
    }
}
