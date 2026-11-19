<?php

use Illuminate\Database\Migrations\Migration;

// Retired feature migration: retain its applied identity for existing installations.
// Existing archived data is preserved; fresh installs create no outbox table.
return new class extends Migration
{
    public function up(): void {}
    public function down(): void {} // Never erase previously captured records implicitly.
};
