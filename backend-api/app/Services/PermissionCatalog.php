<?php

namespace App\Services;

class PermissionCatalog
{
    public const MANAGEMENT = ['users.view', 'users.create', 'users.edit', 'users.deactivate', 'roles.manage', 'permissions.assign', 'authorization_audit.view', 'company_settings.view', 'company_settings.update'];

    public static function definitions(): array
    {
        $groups = [
            'Overview' => ['dashboard' => ['view', 'operations', 'finance', 'staff_activity']],
            'Rental Operations' => ['customers' => ['view', 'create', 'edit', 'deactivate', 'documents.view'], 'bookings' => ['view', 'create', 'edit', 'confirm', 'cancel', 'pricing_override'], 'rentals' => ['view', 'handover'], 'returns' => ['view', 'assess', 'review', 'finalize', 'release_vehicle']],
            'Fleet' => ['vehicles' => ['view', 'create', 'edit', 'deactivate'], 'vehicle_documents' => ['view', 'create', 'download'], 'maintenance' => ['view', 'create', 'edit', 'start', 'complete', 'cancel']],
            'Finance' => ['invoices' => ['view', 'print', 'download'], 'payments' => ['view', 'create'], 'deposits' => ['view', 'refund']],
            'Reports' => ['reports' => ['view', 'export', 'print', 'finance', 'identity.view', 'identity.export']],
            'Administration' => ['staff' => ['view', 'create', 'edit', 'deactivate'], 'branches' => ['view', 'create', 'edit', 'deactivate', 'delete'], 'users' => ['view', 'create', 'edit', 'deactivate'], 'roles' => ['manage'], 'permissions' => ['assign'], 'authorization_audit' => ['view']],
            'Configuration' => array_fill_keys(['rental_packages', 'categories', 'brands', 'models', 'fuel_types', 'transmissions', 'vehicle_features', 'departments', 'designations'], ['view', 'create', 'edit', 'deactivate']),
            'Settings' => ['company_settings' => ['view', 'update'], 'profile' => ['view', 'update']],
        ];
        $rows = [];
        foreach ($groups as $group => $modules) {
            foreach ($modules as $module => $actions) {
                foreach ($actions as $action) {
                    $rows[] = ['code' => "$module.$action", 'group_name' => $group, 'module_name' => ucwords(str_replace('_', ' ', $module)), 'action_name' => ucwords(str_replace(['_', '.'], ' ', $action))];
                }
            }
        }
        return $rows;
    }
}
