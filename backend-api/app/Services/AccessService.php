<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class AccessService
{
    private function assigned(?User $user, array $ids): bool
    {
        return $user?->status && in_array((string) $user->getAuthIdentifier(), array_map('strval', $ids), true);
    }

    private function role(?User $user, array $names): bool
    {
        if (! $user?->status || ! $user->role_id || ! $names) {
            return false;
        }
        $name = DB::table('roles_tb')->where('ID', $user->role_id)->value('role_name');

        return $name !== null && in_array(mb_strtolower(trim($name)), array_map(static fn ($v) => mb_strtolower(trim($v)), $names), true);
    }

    public function operations(?User $user): bool
    {
        if (app(PermissionService::class)->enabled()) {
            return (bool) app(PermissionService::class)->effective($user);
        }
        return $this->assigned($user, config('access.operations_users') ?? config('customer_access.users', [])) || $this->role($user, config('access.operations_roles', []));
    }

    public function customers(?User $user): bool
    {
        if (app(PermissionService::class)->enabled()) {
            return (bool) app(PermissionService::class)->effective($user);
        }
        return $this->assigned($user, config('customer_access.users', [])) || $this->role($user, config('access.customer_roles', []));
    }

    public function administration(?User $user): bool
    {
        if (app(PermissionService::class)->enabled()) {
            return in_array($user?->user_type, ['super_admin', 'admin'], true) && app(PermissionService::class)->any($user, PermissionCatalog::MANAGEMENT);
        }
        return $this->assigned($user, config('access.administration_users') ?? config('customer_access.users', [])) && $this->role($user, config('access.administrator_roles', ['Admin']));
    }

    public function company(?User $user): bool
    {
        if (app(PermissionService::class)->enabled()) {
            return app(PermissionService::class)->any($user, ['company_settings.view', 'company_settings.update']);
        }
        return $this->assigned($user, config('access.company_users') ?? config('access.administration_users') ?? config('customer_access.users', [])) && $this->role($user, config('access.administrator_roles', ['Admin']));
    }

    public function identity(?User $user): bool
    {
        if (app(PermissionService::class)->enabled()) {
            return app(PermissionService::class)->can($user, 'reports.identity.view');
        }
        return $this->operations($user) && $this->assigned($user, config('rental.identity_report_user_ids', []));
    }

    public function capabilities(?User $user): array
    {
        return ['rental_operations' => $this->operations($user), 'customers' => $this->customers($user), 'administration' => $this->administration($user), 'company_settings' => $this->company($user), 'identity_reports' => $this->identity($user)];
    }
}
