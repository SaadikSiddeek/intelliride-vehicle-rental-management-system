<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PermissionService;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RecordStatusController extends Controller
{
    public const RESOURCES = [
        'branches' => ['branch_tb', 'branches.edit'], 'departments' => ['department_tb', 'departments.edit'],
        'designations' => ['designation_tb', 'designations.edit'], 'staff' => ['staff_tb', 'staff.edit'],
        'categories' => ['vehicle_category_tb', 'categories.edit'], 'brands' => ['vehicle_brand_tb', 'brands.edit'],
        'models' => ['vehicle_model_tb', 'models.edit'], 'fuel_types' => ['fuel_type_tb', 'fuel_types.edit'],
        'transmissions' => ['transmission_type_tb', 'transmissions.edit'], 'vehicle_features' => ['vehicle_feature_tb', 'vehicle_features.edit'],
        'rental_packages' => ['rental_package_tb', 'rental_packages.edit'], 'customers' => ['customer_tb', 'customers.edit'],
        'roles' => ['roles_tb', 'roles.manage'], 'users' => ['users_tb', 'users.deactivate'],
    ];

    public function update(Request $r, PermissionService $p)
    {
        $f = $r->validate(['resource' => ['required', Rule::in(array_keys(self::RESOURCES))],
            'id' => ['required', 'integer', 'min:1'], 'active' => ['required', 'boolean'],
            'expected_status' => ['required', 'string', 'max:20'], 'reason' => ['required', 'string', 'min:5', 'max:500']]);
        [$table, $permission] = self::RESOURCES[$f['resource']];
        // No legacy fallback: quick changes use the activated, canonical RBAC policy.
        abort_unless($p->enabled() && $p->can($r->user(), $permission), 403, 'Status management permission is required.');
        return DB::transaction(function () use ($r, $p, $f, $table) {
            DB::table('authorization_state_tb')->where('ID', 1)->lockForUpdate()->first();
            $actor = $r->user()->fresh();
            abort_unless($p->can($actor, self::RESOURCES[$f['resource']][1]), 403);
            $row = DB::table($table)->where('ID', $f['id'])->lockForUpdate()->first();
            abort_unless($row, 404, 'Record not found.');
            abort_unless((string) $row->status === $f['expected_status'], 409, 'This record changed. Refresh the table before retrying.');
            if ($table === 'users_tb') {
                $p->assertManageTarget($actor, $row);
                abort_if((int) $actor->ID === (int) $row->ID || $row->user_type === 'super_admin', 403, 'Your own account and Super Admin accounts cannot be changed here.');
            }
            if ($table === 'roles_tb') abort_unless($actor->user_type === 'super_admin', 403);
            if ($table === 'customer_tb') abort_unless(in_array($row->status, ['Active', 'Inactive'], true), 422, 'Review blocked customers in the edit form.');
            $next = $table === 'customer_tb' ? ($f['active'] ? 'Active' : 'Inactive') : (int) $f['active'];
            DB::table($table)->where('ID', $row->ID)->update(['status' => $next, 'updated_at' => now()]);
            if ($table === 'users_tb' && ! $f['active']) {
                DB::table('personal_access_tokens')->where('tokenable_type', User::class)->where('tokenable_id', $row->ID)->delete();
            }
            $p->audit($actor->ID, $table === 'users_tb' ? $row->ID : null, 'record_status_changed', $f['reason'],
                ['resource' => $f['resource'], 'id' => $row->ID, 'status' => $row->status], ['status' => $next]);
            return response()->json(['status' => true, 'message' => 'Status updated successfully.', 'data' => ['status' => $next]]);
        });
    }
}
