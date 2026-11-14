<?php

namespace App\Console\Commands;

use App\Services\PermissionService;
use Database\Seeders\InitialMasterDataSeeder;
use Database\Seeders\PermissionCatalogSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class InitializeAuthorization extends Command
{
    protected $signature = 'intelliride:rbac-initialize';
    protected $description = 'Initialize an EMPTY installation interactively; never reset or promote an existing account';

    public function handle(PermissionService $p): int
    {
        if (! Schema::hasTable('authorization_state_tb') || ! DB::table('authorization_state_tb')->where('ID', 1)->exists()) {
            $this->error('Apply and review the additive authorization migration first.');
            return self::FAILURE;
        }
        $existing = DB::table('users_tb')->where('user_type', 'super_admin')->count();
        if ($existing === 1) {
            if (! $p->enabled() || ! DB::table('users_tb')->where('user_type', 'super_admin')->where('status', true)->exists()) {
                $this->error('A Super Admin already exists but installation authority requires private review. Nothing changed.');
                return self::FAILURE;
            }
            $this->info('Already initialized. No account, password or permissions changed.');
            return self::SUCCESS;
        }
        if ($existing > 1 || DB::table('users_tb')->exists()) {
            $this->error('Existing accounts require an explicit reviewed activation plan. Nothing changed.');
            return self::FAILURE;
        }
        if (! Schema::hasColumn('users_tb', 'must_change_password')) {
            $this->error('Apply the first-login password migration before initializing. Nothing changed.');
            return self::FAILURE;
        }
        if (! $this->input->isInteractive()) {
            $this->error('Interactive terminal required; no default credential is supported.');
            return self::FAILURE;
        }
        $email = $this->ask('Installation Super Admin email');
        $name = $this->ask('Installation Super Admin username');
        // fallback=false prevents echo when a hidden prompt is not available.
        $password = $this->secret('Strong password (at least 12 characters)', false);
        $confirmation = $this->secret('Confirm password', false);
        $valid = validator(['email' => $email, 'username' => $name, 'password' => $password, 'password_confirmation' => $confirmation], ['email' => 'required|email|max:150', 'username' => 'required|string|max:100', 'password' => ['required', 'string', 'min:12', 'confirmed', new \App\Rules\InstallationPassword]]);
        if ($valid->fails()) {
            $this->error('Invalid account details or password confirmation. Nothing changed.');
            return self::FAILURE;
        }
        if (! $this->confirm('Initialize this EMPTY database with one Super Admin and essential master records?', false)) {
            return self::FAILURE;
        }
        DB::transaction(function () use ($p, $email, $name, $password) {
            DB::table('authorization_state_tb')->where('ID', 1)->lockForUpdate()->first();
            if (DB::table('users_tb')->exists()) {
                throw new \RuntimeException('Accounts appeared during installation. Nothing changed.');
            }
            (new InitialMasterDataSeeder)->run();
            (new PermissionCatalogSeeder)->run();
            $role = DB::table('roles_tb')->where('role_name', 'Installation Administrator')->first();
            $id = DB::table('users_tb')->insertGetId(['role_id' => $role->ID, 'branch_id' => $role->branch_id, 'username' => $name, 'email' => $email, 'password' => Hash::make($password), 'user_type' => 'super_admin', 'must_change_password' => true, 'status' => true, 'created_at' => now(), 'updated_at' => now()], 'ID');
            DB::table('authorization_state_tb')->where('ID', 1)->update(['enabled' => true, 'updated_at' => now()]);
            $p->audit(null, $id, 'installation_initialized', 'Explicit interactive empty-installation setup', [], ['user_type' => 'super_admin', 'rbac' => true]);
        });
        unset($password, $confirmation);
        $this->info('Initialized. Complete company/branch details and register/link the real employee before any handover. No employee or ordinary Admin was invented.');
        return self::SUCCESS;
    }
}
