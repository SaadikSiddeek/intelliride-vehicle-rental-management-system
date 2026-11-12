<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Business records and privileged accounts are provisioned explicitly by an authorized operator.
        // Automatic deployment seeding must never create default credentials or alter existing records.
    }
}
