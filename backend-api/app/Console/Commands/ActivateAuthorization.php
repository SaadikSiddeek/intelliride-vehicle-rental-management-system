<?php

namespace App\Console\Commands;

use App\Services\PermissionCatalog;
use App\Services\PermissionService;
use Database\Seeders\PermissionCatalogSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class ActivateAuthorization extends Command
{
    protected $signature = 'intelliride:rbac-activate {plan : Local reviewed JSON path; never credentials} {--apply : Apply after interactive confirmation; default is preview}';
    protected $description = 'Preview an explicit mapping of EVERY existing account, then optionally activate database RBAC';

    public function handle(PermissionService $p): int
    {
        if (! Schema::hasTable('authorization_state_tb') || $p->enabled()) {
            $this->error('Requires the additive schema in inactive migration mode.');
            return self::FAILURE;
        }
        try {
            $plan = json_decode(file_get_contents($this->argument('plan')), true, 64, JSON_THROW_ON_ERROR);
            if (! is_array($plan) || array_diff(array_keys($plan), ['reason', 'accounts'])) {
                throw new \RuntimeException('Only reason and accounts are accepted. Never include credentials in a permission plan.');
            }
            foreach ($plan['accounts'] ?? [] as $account) {
                if (! is_array($account) || array_diff(array_keys($account), ['id', 'expected_username', 'expected_email', 'expected_emp_id', 'user_type', 'managed_by_user_id', 'allow', 'deny', 'access', 'delegable'])) {
                    throw new \RuntimeException('Unknown account-plan fields are forbidden.');
                }
            }
            validator($plan, ['reason' => 'required|string|max:500', 'accounts' => 'required|array|min:1', 'accounts.*.id' => 'required|integer|distinct|exists:users_tb,ID', 'accounts.*.expected_username' => 'required|string|max:100', 'accounts.*.expected_email' => 'required|email|max:150', 'accounts.*.expected_emp_id' => 'present|nullable|string|max:50', 'accounts.*.allow.*' => 'required|string', 'accounts.*.deny.*' => 'required|string', 'accounts.*.access.*' => 'required|string', 'accounts.*.delegable.*' => 'required|string', 'accounts.*.user_type' => ['required', Rule::in(['super_admin', 'admin', 'user'])], 'accounts.*.managed_by_user_id' => 'nullable|integer|exists:users_tb,ID', 'accounts.*.allow' => 'present|array', 'accounts.*.deny' => 'present|array', 'accounts.*.access' => 'present|array', 'accounts.*.delegable' => 'present|array'])->validate();
            $ids = DB::table('users_tb')->pluck('ID')->map(fn ($id) => (int) $id)->sort()->values()->all();
            $mapped = array_column($plan['accounts'], 'id');
            sort($mapped);
            if ($ids !== $mapped || count(array_filter($plan['accounts'], fn ($a) => $a['user_type'] === 'super_admin')) !== 1) {
                throw new \RuntimeException('Map every existing account exactly once and explicitly select exactly one Super Admin.');
            }
            $catalog = array_column(PermissionCatalog::definitions(), 'code');
            $accounts = array_column($plan['accounts'], null, 'id');
            foreach ($accounts as $a) {
                $identity = DB::table('users_tb')->where('ID', $a['id'])->first();
                if ($identity->username !== $a['expected_username'] || $identity->email !== $a['expected_email'] || $identity->emp_id !== $a['expected_emp_id']) {
                    throw new \RuntimeException('Account identity does not match the reviewed mapping.');
                }
                foreach (['allow', 'deny', 'access', 'delegable'] as $key) {
                    if (count($a[$key]) !== count(array_unique($a[$key])) || array_diff($a[$key], $catalog)) {
                        throw new \RuntimeException('Unknown or duplicate permission code.');
                    }
                }
                if (array_intersect($a['allow'], $a['deny']) || array_diff($a['delegable'], $a['access'])) {
                    throw new \RuntimeException('Conflicting grants or delegation outside access ceiling.');
                }
                if ($a['user_type'] !== 'admin' && ($a['access'] || $a['delegable'])) {
                    throw new \RuntimeException('Only Admin accounts may have ceilings.');
                }
                if ($a['user_type'] === 'super_admin' && ! DB::table('users_tb')->where('ID', $a['id'])->where('status', true)->exists()) {
                    throw new \RuntimeException('The selected Super Admin must already be active.');
                }
                if (! empty($a['managed_by_user_id']) && ($a['user_type'] !== 'user' || $a['managed_by_user_id'] === $a['id'] || ! in_array($accounts[$a['managed_by_user_id']]['user_type'], ['admin', 'super_admin'], true))) {
                    throw new \RuntimeException('Invalid management hierarchy.');
                }
            }
            $this->info('Validated explicit account mapping. Existing role templates start without grants; only reviewed per-account grants and ceilings become effective. Passwords and business records are untouched.');
            $this->table(['Account ID', 'Type', 'Managed by', 'Grants', 'Restrictions'], array_map(fn ($a) => [$a['id'], $a['user_type'], $a['managed_by_user_id'] ?? 'Super Admin', count($a['allow']), count($a['deny'])], $accounts));
            if (! $this->option('apply')) {
                $this->info('PREVIEW ONLY. Back up the database and review each mapping before --apply.');
                return self::SUCCESS;
            }
            if (! $this->input->isInteractive() || ! $this->confirm('Activate this reviewed mapping, replacing allowlist authority and revoking all existing tokens?', false)) {
                return self::FAILURE;
            }
            DB::transaction(function () use ($p, $plan, $accounts, $ids) {
                DB::table('authorization_state_tb')->where('ID', 1)->lockForUpdate()->first();
                if ($p->enabled() || DB::table('users_tb')->orderBy('ID')->pluck('ID')->map(fn ($id) => (int) $id)->all() !== $ids) {
                    throw new \RuntimeException('Installation changed during review. Re-run preview.');
                }
                (new PermissionCatalogSeeder)->run();
                if (DB::table('role_permission_tb')->exists() || DB::table('user_permission_tb')->exists() || DB::table('admin_permission_scope_tb')->exists()) {
                    throw new \RuntimeException('Existing permission assignments require a separate reviewed transition.');
                }
                foreach ($accounts as $a) {
                    $identity = DB::table('users_tb')->where('ID', $a['id'])->lockForUpdate()->first();
                    if (! $identity || $identity->username !== $a['expected_username'] || $identity->email !== $a['expected_email'] || $identity->emp_id !== $a['expected_emp_id'] || ($a['user_type'] === 'super_admin' && ! $identity->status)) {
                        throw new \RuntimeException('Account identity changed during review.');
                    }
                    $old = (object) ['user_type' => $identity->user_type, 'managed_by_user_id' => $identity->managed_by_user_id];
                    DB::table('users_tb')->where('ID', $a['id'])->update(['user_type' => $a['user_type'], 'managed_by_user_id' => $a['managed_by_user_id'] ?? null, 'updated_at' => now()]);
                    foreach (['allow', 'deny'] as $effect) {
                        foreach ($a[$effect] as $code) {
                            DB::table('user_permission_tb')->insert(['user_id' => $a['id'], 'permission_code' => $code, 'effect' => $effect]);
                        }
                    }
                    foreach ($a['access'] as $code) {
                        DB::table('admin_permission_scope_tb')->insert(['user_id' => $a['id'], 'permission_code' => $code, 'delegable' => in_array($code, $a['delegable'], true)]);
                    }
                    $p->audit(null, $a['id'], 'authorization_activated', $plan['reason'], (array) $old, array_intersect_key($a, array_flip(['id', 'user_type', 'managed_by_user_id', 'allow', 'deny', 'access', 'delegable'])));
                }
                DB::table('personal_access_tokens')->delete();
                DB::table('authorization_state_tb')->where('ID', 1)->update(['enabled' => true, 'updated_at' => now()]);
            });
            $this->info('Activated. All users must sign in again. Verify access before reopening normal operations.');
            return self::SUCCESS;
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->error('Mapping validation failed for: '.implode(', ', array_keys($e->errors())).'. No changes applied.');
            return self::FAILURE;
        } catch (\Throwable $e) {
            $this->error('Activation refused. Check the plan, mapping and installation state. No partial changes were applied.');
            return self::FAILURE;
        }
    }
}
