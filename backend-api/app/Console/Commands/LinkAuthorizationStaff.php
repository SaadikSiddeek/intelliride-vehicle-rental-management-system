<?php

namespace App\Console\Commands;

use App\Services\PermissionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class LinkAuthorizationStaff extends Command
{
    protected $signature = 'intelliride:rbac-link-staff {user} {staff}';
    protected $description = 'Explicit installation-console employee association for a Super Admin; no credentials are changed';

    public function handle(PermissionService $p): int
    {
        if (! $p->enabled() || ! $this->input->isInteractive()) {
            $this->error('An active RBAC installation and interactive console are required.');
            return self::FAILURE;
        }
        $user = DB::table('users_tb')->where('ID', $this->argument('user'))->where('user_type', 'super_admin')->where('status', true)->first();
        $staff = DB::table('staff_tb')->where('ID', $this->argument('staff'))->where('status', true)->first();
        if (! $user || ! $staff || DB::table('users_tb')->where('ID', '!=', $user?->ID)->where('emp_id', (string) $staff?->ID)->exists()) {
            $this->error('Select one active Super Admin and an active employee not linked to another account.');
            return self::FAILURE;
        }
        $reason = $this->ask('Reason for the verified employee association');
        if (! is_string($reason) || ! trim($reason) || mb_strlen($reason) > 500 || ! $this->confirm('Link these explicitly selected account/employee IDs and revoke this account’s existing tokens?', false)) {
            return self::FAILURE;
        }
        DB::transaction(function () use ($p, $user, $staff, $reason) {
            DB::table('authorization_state_tb')->where('ID', 1)->lockForUpdate()->first();
            if (! DB::table('users_tb')->where('ID', $user->ID)->where('user_type', 'super_admin')->where('status', true)->exists()
                || ! DB::table('staff_tb')->where('ID', $staff->ID)->where('status', true)->exists()
                || DB::table('users_tb')->where('ID', '!=', $user->ID)->where('emp_id', (string) $staff->ID)->exists()) {
                throw new \RuntimeException('The verified employee association changed during review. Nothing changed; review again.');
            }
            DB::table('users_tb')->where('ID', $user->ID)->update(['emp_id' => (string) $staff->ID, 'branch_id' => $staff->branch_id, 'updated_at' => now()]);
            DB::table('personal_access_tokens')->where('tokenable_type', \App\Models\User::class)->where('tokenable_id', $user->ID)->delete();
            $p->audit(null, $user->ID, 'installation_employee_link', $reason, ['emp_id' => $user->emp_id], ['emp_id' => $staff->ID]);
        });
        $this->info('Employee association saved. Sign in again.');
        return self::SUCCESS;
    }
}
