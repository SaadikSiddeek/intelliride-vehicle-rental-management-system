<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('branch_tb', 'manager_name')) {
            Schema::table('branch_tb', function (Blueprint $table) {
                $table->string('manager_name', 200)->nullable();
            });
        }
        // Preserve every legacy staff link; backfill names only where no name exists.
        DB::table('branch_tb')->whereNull('manager_name')->whereNotNull('manager_id')
            ->orderBy('ID')->chunkById(100, function ($branches) {
                $staff = DB::table('staff_tb')->whereIn('ID', $branches->pluck('manager_id'))->get(['ID', 'first_name', 'last_name'])->keyBy('ID');
                foreach ($branches as $branch) {
                    $person = $staff->get($branch->manager_id);
                    $name = $person ? trim($person->first_name.' '.$person->last_name) : '';
                    if ($name !== '') {
                        DB::table('branch_tb')->where('ID', $branch->ID)->whereNull('manager_name')
                            ->update(['manager_name' => mb_substr($name, 0, 200)]);
                    }
                }
            }, 'ID');
    }

    public function down(): void
    {
        throw new RuntimeException('Manager names require reviewed forward recovery; no automatic data deletion.');
    }
};
