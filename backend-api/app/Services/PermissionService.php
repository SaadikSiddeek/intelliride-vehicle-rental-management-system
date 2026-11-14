<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PermissionService
{
    public function enabled(): bool
    {
        if (! Schema::hasTable('authorization_state_tb')) {
            // A partially damaged installation must not restore legacy allowlists.
            return Schema::hasColumn('users_tb', 'user_type');
        }
        // A damaged/missing singleton fails closed into RBAC, never back to allowlists.
        return ! in_array(DB::table('authorization_state_tb')->where('ID', 1)->value('enabled'), [false, 0, '0'], true);
    }

    public function effective(?User $user): array
    {
        if (! $user || ! $this->enabled()) {
            return [];
        }
        if (! Schema::hasTable('authorization_state_tb') || ! DB::table('authorization_state_tb')->where('ID', 1)->where('enabled', true)->exists()) {
            return [];
        }
        foreach (['permission_tb', 'role_permission_tb', 'user_permission_tb', 'admin_permission_scope_tb'] as $table) {
            if (! Schema::hasTable($table)) {
                return [];
            }
        }
        return $this->resolve((int) $user->getAuthIdentifier(), []);
    }

    private function resolve(int $id, array $visited): array
    {
        if (in_array($id, $visited, true)) {
            return [];
        }
        $visited[] = $id;
        $u = DB::table('users_tb')->where('ID', $id)->first();
        if (! $u || ! $u->status) {
            return [];
        }
        $catalog = DB::table('permission_tb')->pluck('code')->all();
        if ($u->user_type === 'super_admin') {
            return $catalog;
        }
        if (! in_array($u->user_type, ['admin', 'user'], true)) {
            return [];
        }
        $role = DB::table('roles_tb')->where('ID', $u->role_id)->where('status', true)->exists();
        $grants = $role ? DB::table('role_permission_tb')->where('role_id', $u->role_id)->pluck('permission_code')->all() : [];
        $overrides = DB::table('user_permission_tb')->where('user_id', $id)->get();
        $allow = $overrides->where('effect', 'allow')->pluck('permission_code')->all();
        $deny = $overrides->where('effect', 'deny')->pluck('permission_code')->all();
        $effective = array_values(array_diff(array_intersect(array_unique([...$grants, ...$allow]), $catalog), $deny));
        if ($u->user_type === 'admin') {
            $ceiling = DB::table('admin_permission_scope_tb')->where('user_id', $id)->pluck('permission_code')->all();
            return array_values(array_diff(array_intersect($effective, $ceiling), ['roles.manage', 'authorization_audit.view']));
        }
        $effective = array_diff($effective, PermissionCatalog::MANAGEMENT);
        if ($u->managed_by_user_id !== null) {
            $parent = DB::table('users_tb')->where('ID', $u->managed_by_user_id)->first();
            if (! $parent || ! $parent->status || ! in_array($parent->user_type, ['admin', 'super_admin'], true)) {
                return [];
            }
            if ($parent->user_type === 'admin') {
                $delegable = DB::table('admin_permission_scope_tb')->where('user_id', $parent->ID)->where('delegable', true)->pluck('permission_code')->all();
                $effective = array_intersect($effective, $this->resolve($parent->ID, $visited), $delegable);
            }
        }
        return array_values($effective);
    }

    public function can(?User $user, string $permission): bool
    {
        return in_array($permission, $this->effective($user), true);
    }

    public function any(?User $user, array $permissions): bool
    {
        return (bool) array_intersect($permissions, $this->effective($user));
    }

    public function delegable(User $actor): array
    {
        if ($actor->user_type === 'super_admin') {
            return $this->effective($actor);
        }
        if ($actor->user_type !== 'admin') {
            return [];
        }
        return array_values(array_diff(array_intersect($this->effective($actor), DB::table('admin_permission_scope_tb')->where('user_id', $actor->ID)->where('delegable', true)->pluck('permission_code')->all()), PermissionCatalog::MANAGEMENT));
    }

    public function assertManageTarget(User $actor, object $target): void
    {
        abort_unless($actor->user_type === 'super_admin' || ($actor->user_type === 'admin' && $target->user_type === 'user' && (int) $target->managed_by_user_id === (int) $actor->ID && (int) $target->ID !== (int) $actor->ID), 403, 'This account is outside your delegated authority.');
    }

    public function audit(?int $actor, ?int $target, string $action, string $reason, array $before, array $after): void
    {
        // Callers pass only authorization state, never request payloads or credentials.
        DB::table('authorization_audit_tb')->insert(['actor_user_id' => $actor, 'target_user_id' => $target, 'action' => $action, 'reason' => $reason, 'before_state' => json_encode($before, JSON_THROW_ON_ERROR), 'after_state' => json_encode($after, JSON_THROW_ON_ERROR), 'created_at' => now()]);
    }
}
