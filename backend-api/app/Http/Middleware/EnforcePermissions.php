<?php

namespace App\Http\Middleware;

use App\Services\PermissionService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EnforcePermissions
{
    public function handle(Request $r, Closure $next)
    {
        $permissions = app(PermissionService::class);
        if (! $permissions->enabled()) {
            // The migration never changes existing authorization until explicitly activated.
            return $next($r);
        }
        $uri = preg_replace('#^api/#', '', $r->route()->uri());
        $required = $this->requirements($r, $uri);
        abort_if($required === null, 403, 'Access to this operation has not been assigned.');
        foreach ($required as $alternatives) {
            abort_unless($permissions->any($r->user(), (array) $alternatives), 403, 'You do not have permission for this operation.');
        }
        $execute = function () use ($r, $next, $uri, $permissions) {
            $before = $uri === 'save_role' && $r->filled('upd_id') ? (array) DB::table('roles_tb')->where('ID', $r->input('upd_id'))->first(['ID', 'role_name', 'status']) : [];
            $response = $next($r);
            if ($uri === 'save_role' && $response->isSuccessful()) {
                $result = $response->getData(true);
                $permissions->audit($r->user()->ID, null, 'role_updated', 'Business role template saved', $before, array_intersect_key($result['data'] ?? [], array_flip(['ID', 'role_name', 'status'])));
            }
            return $response;
        };
        $response = $uri === 'save_role' ? DB::transaction(function () use ($execute) {
            DB::table('authorization_state_tb')->where('ID', 1)->lockForUpdate()->first();
            return $execute();
        }) : $execute();
        if ($uri === 'dashboard_overview' && $response instanceof \Illuminate\Http\JsonResponse && $response->isSuccessful()) {
            $body = $response->getData(true);
            $body['data'] = app(\App\Services\DashboardPermissions::class)->redact($body['data'], $r->user(), $permissions);
            $response->setData($body);
        }
        return $response;
    }

    public function requirements(Request $r, string $uri): ?array
    {
        if (in_array($uri, ['user', 'business_branding', 'auth/activity', 'auth/password', 'logout'], true)) {
            return [];
        }
        if ($uri === 'my_profile_photo' && $r->isMethod('GET')) {
            // Header avatars expose only the authenticated account's own photo.
            return [];
        }
        // Hydrating a disabled form field needs one label, not general search authority.
        if ($r->filled('id')) {
            $hydration = [
                'customer_filter' => ['customers.view', 'bookings.view', 'bookings.create', 'bookings.edit'],
                'branch_filter' => ['branches.view', 'bookings.view', 'bookings.create', 'bookings.edit', 'staff.view', 'staff.create', 'staff.edit', 'vehicles.view', 'vehicles.create', 'vehicles.edit', 'reports.view', 'dashboard.view'],
                'booking_vehicle_filter' => ['bookings.view', 'bookings.create', 'bookings.edit'],
                'booking_package_filter' => ['bookings.view', 'bookings.create', 'bookings.edit'],
                'rental_package_vehicles' => ['rental_packages.view', 'rental_packages.edit', 'rental_packages.create', 'vehicle_documents.view', 'vehicle_documents.create', 'maintenance.view', 'maintenance.edit', 'maintenance.create', 'reports.view'],
                'return_rental_filter' => ['returns.view', 'returns.assess', 'returns.review'],
                'handover_booking_filter' => ['rentals.view', 'rentals.handover'],
                'staff_filter' => ['users.view', 'users.create', 'users.edit', 'branches.view', 'branches.create', 'branches.edit', 'reports.view'],
                'role_filter' => ['users.view', 'users.create', 'users.edit', 'permissions.assign'],
            ];
            if (isset($hydration[$uri])) {
                return [$hydration[$uri]];
            }
        }
        $fixed = [
            'business_profile' => 'company_settings.view', 'save_business_profile' => 'company_settings.update',
            'dashboard_overview' => 'dashboard.view', 'my_profile_photo' => $r->isMethod('GET') ? 'profile.view' : 'profile.update',
            'get_users' => 'users.view', 'fetch_user_data' => ['users.view', 'users.edit'],
            'get_roles' => 'roles.manage', 'fetch_role_data' => 'roles.manage', 'save_role' => 'roles.manage',
            'authorization_setup' => 'permissions.assign', 'permission_targets' => 'permissions.assign', 'permission_catalog' => 'permissions.assign', 'permission_target' => 'permissions.assign', 'save_permissions' => 'permissions.assign', 'authorization_audit' => 'authorization_audit.view',
            'get_rentals' => 'rentals.view', 'fetch_rental_data' => 'rentals.view', 'rental_photos/{id}' => ['rentals.view', 'returns.assess'], 'save_handover' => 'rentals.handover', 'handover_booking_filter' => 'rentals.handover', 'handover_context' => 'rentals.handover',
            'get_returns' => 'returns.view', 'fetch_return_data' => ['returns.view', 'returns.assess', 'returns.review'], 'return_rental_filter' => 'returns.assess',
            'get_invoices' => 'invoices.view', 'fetch_invoice_data' => 'invoices.view', 'get_payments' => 'payments.view', 'save_invoice_payment' => 'payments.create', 'get_refunds' => 'deposits.view', 'save_deposit_refund' => 'deposits.refund', 'invoice_filter' => ['payments.create', 'deposits.refund'], 'invoice_settlement_context' => ['payments.create', 'deposits.refund'],
            'get_vehicle_documents' => 'vehicle_documents.view', 'vehicle_documents/{id}' => 'vehicle_documents.download', 'save_vehicle_document' => 'vehicle_documents.create',
            'customer_documents/{id}' => 'customers.documents.view', 'delete_branch' => 'branches.delete',
            'booking_options' => ['bookings.view', 'bookings.create', 'bookings.edit'], 'booking_vehicle_filter' => ['bookings.create', 'bookings.edit'], 'booking_package_filter' => ['bookings.create', 'bookings.edit'], 'quote_booking' => ['bookings.create', 'bookings.edit'],
            'customer_filter' => ['customers.view', 'bookings.create', 'bookings.edit'], 'rental_package_vehicles' => ['rental_packages.view', 'rental_packages.create', 'rental_packages.edit', 'reports.view', 'maintenance.create', 'vehicle_documents.create'],
            'staff_filter' => ['users.create', 'users.edit', 'branches.create', 'branches.edit', 'reports.view'], 'role_filter' => ['users.create', 'users.edit', 'permissions.assign'],
            'branch_filter' => ['staff.create', 'staff.edit', 'vehicles.create', 'vehicles.edit', 'bookings.create', 'bookings.edit', 'dashboard.view', 'reports.view'],
            'department_filter' => ['staff.create', 'staff.edit'], 'designation_filter' => ['staff.create', 'staff.edit'],
            'fuel_type_filter' => ['vehicles.create', 'vehicles.edit'], 'transmission_type_filter' => ['vehicles.create', 'vehicles.edit'], 'brand_filter' => ['vehicles.create', 'vehicles.edit', 'models.create', 'models.edit'], 'model_filter' => ['vehicles.create', 'vehicles.edit'], 'vehciel_category_filter' => ['vehicles.create', 'vehicles.edit', 'models.create', 'models.edit'],
        ];
        if (isset($fixed[$uri])) {
            return [$fixed[$uri]];
        }
        if ($uri === 'invoice_output') {
            return ['invoices.view', $r->input('format') === 'pdf' ? 'invoices.download' : 'invoices.print'];
        }
        if (in_array($uri, ['report_options', 'report_customer_filter', 'get_report', 'export_report'], true)) {
            $need = ['reports.view'];
            if ($uri === 'export_report') {
                $need[] = $r->input('format') === 'html' ? 'reports.print' : 'reports.export';
            }
            if ($r->boolean('include_identity')) {
                $need[] = 'reports.identity.view';
                if ($uri === 'export_report') {
                    $need[] = 'reports.identity.export';
                }
            }
            if (in_array($r->input('type'), ['financial', 'outstanding_invoices', 'daily_transactions', 'deposit_history'], true)) {
                $need[] = 'reports.finance';
            }
            return $need;
        }
        if ($uri === 'booking_status') {
            return [$r->input('status') === 'Confirmed' ? 'bookings.confirm' : 'bookings.cancel'];
        }
        if ($uri === 'save_return_assessment') {
            return ['returns.assess'];
        }
        if ($uri === 'finalize_return') {
            return $r->boolean('vehicle_release_approved') ? ['returns.review', 'returns.finalize', 'returns.release_vehicle'] : ['returns.review', 'returns.finalize'];
        }
        if ($uri === 'maintenance_status') {
            return [match ($r->input('status')) {'Active' => 'maintenance.start', 'Completed' => 'maintenance.complete', default => 'maintenance.cancel'}];
        }
        $modules = [
            'user' => ['users', 'users_tb', 'get_users'], 'staff' => ['staff', 'staff_tb', 'get_staff'], 'department' => ['departments', 'department_tb', 'get_department'], 'designation' => ['designations', 'designation_tb', 'get_designation'],
            'vehicle_category' => ['categories', 'vehicle_category_tb', 'get_vehicle_categories'], 'vehicle_brand' => ['brands', 'vehicle_brand_tb', 'get_vehicle_brands'], 'vehicle_model' => ['models', 'vehicle_model_tb', 'get_vehicle_models'],
            'fuel_type' => ['fuel_types', 'fuel_type_tb', 'get_fuel_types'], 'vehicle_transmission' => ['transmissions', 'transmission_type_tb', 'get_vehicle_transmissions'], 'vehicle_feature' => ['vehicle_features', 'vehicle_feature_tb', 'get_vehicle_features'],
            'vehicle' => ['vehicles', 'vehicle_tb', 'get_vehicles'], 'branch' => ['branches', 'branch_tb', 'get_branches'], 'customer' => ['customers', 'customer_tb', 'get_customers'], 'rental_package' => ['rental_packages', 'rental_package_tb', 'get_rental_packages'], 'booking' => ['bookings', 'booking_tb', 'get_bookings'], 'maintenance' => ['maintenance', 'maintenance_tb', 'get_maintenance'],
        ];
        foreach ($modules as $name => [$module, $table, $list]) {
            if ($uri === $list) {
                return ["$module.view"];
            }
            if ($uri === "fetch_{$name}_data") {
                return [["$module.view", "$module.edit"]];
            }
            if ($uri !== "save_$name") {
                continue;
            }
            $need = [$r->filled('upd_id') ? "$module.edit" : "$module.create"];
            $status = $r->input('form_data.status', $r->input('status', $module === 'vehicles' ? $r->input('vehicle_status') : null));
            if ($r->filled('upd_id') && $status !== null && $module !== 'bookings' && $module !== 'maintenance') {
                $old = DB::table($table)->where('ID', $r->input('upd_id'))->value('status');
                $boolean = is_bool($status) || in_array((string) $status, ['0', '1', 'true', 'false'], true);
                $same = $boolean ? (bool) $old === filter_var($status, FILTER_VALIDATE_BOOLEAN) : (string) $old === (string) $status;
                if ($old !== null && ! $same) {
                    $need[] = "$module.deactivate";
                }
            }
            if ($module === 'bookings' && $status === 'Confirmed') {
                $need[] = 'bookings.confirm';
            }
            return $need;
        }
        return null;
    }
}
