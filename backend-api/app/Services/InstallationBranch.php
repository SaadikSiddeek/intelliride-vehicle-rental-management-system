<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class InstallationBranch
{
    public function current(): object
    {
        if (Schema::hasTable('installation_settings_tb')) {
            $id = DB::table('installation_settings_tb')->where('ID', 1)->value('branch_id');
            if ($id) return DB::table('branch_tb')->where('ID', $id)->firstOrFail();
        }
        $branches = DB::table('branch_tb')->limit(2)->get();
        if ($branches->count() === 1) return $branches->first();
        throw ValidationException::withMessages(['branch' => $branches->isEmpty() ? 'Run the normal installation seed to initialize Branch Settings.' : 'Multiple historical branches exist. The installation owner must explicitly select the installation branch before continuing. No records have been reassigned.']);
    }

    /** Preserve the account's original read scope alongside the configured installation. */
    public function readableIds(?int $assignedBranch): array
    {
        return array_values(array_unique(array_filter([(int) $this->current()->ID, $assignedBranch])));
    }

    public function initialize(): int
    {
        return DB::transaction(function () {
            if (Schema::hasTable('installation_settings_tb')) {
                $state = DB::table('installation_settings_tb')->where('ID', 1)->lockForUpdate()->first();
                if ($state?->branch_id) return (int) $state->branch_id;
            } elseif (Schema::hasTable('authorization_state_tb')) {
                DB::table('authorization_state_tb')->where('ID', 1)->lockForUpdate()->first();
            }
            $rows = DB::table('branch_tb')->limit(2)->get();
            if ($rows->count() > 1) return (int) $this->current()->ID;
            $id = $rows->isEmpty() ? DB::table('branch_tb')->insertGetId(['branch_name' => 'Installation branch — complete setup', 'branch_code' => 'SETUP', 'status' => 1, 'created_at' => now(), 'updated_at' => now()], 'ID') : $rows->first()->ID;
            if (Schema::hasTable('installation_settings_tb')) DB::table('installation_settings_tb')->where('ID', 1)->update(['branch_id' => $id]);
            return (int) $id;
        });
    }
}
