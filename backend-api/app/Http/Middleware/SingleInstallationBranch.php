<?php

namespace App\Http\Middleware;

use App\Services\InstallationBranch;
use Closure;
use Illuminate\Http\Request;

class SingleInstallationBranch
{
    public function handle(Request $request, Closure $next)
    {
        // Self-service/authentication must remain usable if a legacy branch decision is pending.
        $operation = preg_replace('#^api/#', '', $request->route()->uri());
        if (in_array($operation, ['save_user', 'save_role'], true)) {
            abort_unless(app(\App\Services\AccessService::class)->administration($request->user()), 403, 'Administrator access is required.');
        }
        if (in_array($operation, ['user','auth/activity','auth/password','logout','ai/chat','ai/health','my_profile_photo','business_branding','authorization_setup','permission_catalog','permission_targets','permission_target','authorization_audit'], true)) return $next($request);
        if (in_array($operation, ['save_branch','save_staff','save_user','save_role','save_department','save_designation','save_vehicle','save_booking','quote_booking','booking_options','dashboard_overview','get_branches','branch_filter','fetch_branch_data','delete_branch'], true)) {
            $branch = app(InstallationBranch::class)->current();
            $request->user()?->setAttribute('branch_id', $branch->ID);
            if ($operation === 'delete_branch') abort(409, 'The installation branch is preserved. Update Branch Settings instead.');
            if ($operation === 'save_branch') {
                abort_if(! $request->filled('upd_id'), 409, 'This installation already has a branch. Update Branch Settings instead.');
                abort_unless((int) $request->input('upd_id') === (int) $branch->ID, 409, 'Only the configured installation branch may be updated.');
            } else {
                // Existing historical records remain in their original branch.
                $tables = ['save_staff' => 'staff_tb', 'save_user' => 'users_tb', 'save_role' => 'roles_tb', 'save_department' => 'department_tb', 'save_designation' => 'designation_tb', 'save_vehicle' => 'vehicle_tb'];
                if ($request->filled('upd_id') && isset($tables[$operation])) {
                    $column = $operation === 'save_booking' ? 'pickup_branch_id' : 'branch_id';
                    $existing = \Illuminate\Support\Facades\DB::table($tables[$operation])->where('ID', $request->input('upd_id'))->value($column);
                    abort_if($existing && (int) $existing !== (int) $branch->ID, 409, 'This historical record belongs to another branch. It has not been reassigned.');
                }
                $request->merge(['branch_id' => $branch->ID, 'branch' => $branch->ID, 'pickup_branch_id' => $branch->ID, 'return_branch_id' => $branch->ID]);
            }
        } elseif ($request->user() && in_array($operation, ['get_departments','get_department','get_designation','get_roles'], true)) {
            $request->user()->setAttribute('branch_id', app(InstallationBranch::class)->current()->ID);
        }
        return $next($request);
    }
}
