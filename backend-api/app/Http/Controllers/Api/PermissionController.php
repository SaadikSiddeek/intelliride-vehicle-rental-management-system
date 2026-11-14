<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PermissionController extends Controller
{
    public function setup(Request $r)
    {
        abort_unless($r->user()->user_type === 'super_admin', 403);
        $employee = (string) $r->user()->emp_id;
        return response()->json(['status' => true, 'data' => [
            ['label' => 'Review company profile', 'complete' => DB::table('business_profile_tb')->whereNotNull('updated_by')->exists(), 'path' => '/company-settings'],
            ['label' => 'Complete the installation branch', 'complete' => DB::table('branch_tb')->where('status', true)->exists() && ! DB::table('branch_tb')->where('branch_code', 'SETUP')->exists(), 'path' => '/branch-management/manage'],
            ['label' => 'Register and link your real employee', 'complete' => ctype_digit($employee) && DB::table('staff_tb')->where('ID', $employee)->where('status', true)->exists(), 'path' => '/staff-management/manage'],
            ['label' => 'Create the first Admin', 'complete' => DB::table('users_tb')->where('user_type', 'admin')->where('status', true)->exists(), 'path' => '/user-management/manage'],
            ['label' => 'Review Admin access and delegation', 'complete' => DB::table('authorization_audit_tb as a')->join('users_tb as u', 'u.ID', '=', 'a.target_user_id')->where('u.user_type', 'admin')->where('a.action', 'user_permissions_changed')->exists(), 'path' => '/permission-management/manage'],
        ]]);
    }

    public function targets(Request $r, PermissionService $p)
    {
        abort_unless($p->enabled(), 403);
        $f = $r->validate(['kind' => ['nullable', Rule::in(['user', 'role'])], 'q' => ['nullable', 'string', 'max:100'], 'id' => ['nullable', 'integer']]);
        $role = ($f['kind'] ?? 'user') === 'role';
        abort_if($role && $r->user()->user_type !== 'super_admin', 403);
        $q = DB::table($role ? 'roles_tb' : 'users_tb');
        if (! $role && $r->user()->user_type !== 'super_admin') {
            $q->where('user_type', 'user')->where('managed_by_user_id', $r->user()->ID);
        }
        $column = $role ? 'role_name' : 'username';
        if (isset($f['id'])) {
            $q->where('ID', $f['id']);
        } else {
            $q->where($column, 'like', '%' . ($f['q'] ?? '') . '%');
        }
        return response()->json(['success' => true, 'data' => $q->orderBy($column)->limit(30)->get(['ID as id', "$column as text"])]);
    }

    public function catalog(Request $r, PermissionService $p)
    {
        abort_unless($p->enabled(), 403, 'Database permissions are not activated.');
        return response()->json(['status' => true, 'data' => ['permissions' => DB::table('permission_tb')->get(), 'delegable' => $p->delegable($r->user())]]);
    }

    public function target(Request $r, PermissionService $p)
    {
        abort_unless($p->enabled(), 403);
        $f = $r->validate(['kind' => ['required', Rule::in(['user', 'role'])], 'id' => ['required', 'integer', 'min:1']]);
        if ($f['kind'] === 'role') {
            abort_unless($r->user()->user_type === 'super_admin', 403);
            $role = DB::table('roles_tb')->where('ID', $f['id'])->first();
            abort_unless($role, 404);
            return response()->json(['status' => true, 'data' => ['name' => $role->role_name, 'allow' => DB::table('role_permission_tb')->where('role_id', $role->ID)->pluck('permission_code'), 'deny' => [], 'inherited' => [], 'effective' => [], 'access' => [], 'delegable' => [], 'user_type' => null]]);
        }
        $u = \App\Models\User::findOrFail($f['id']);
        $p->assertManageTarget($r->user(), $u);
        $overrides = DB::table('user_permission_tb')->where('user_id', $u->ID)->get();
        $scope = DB::table('admin_permission_scope_tb')->where('user_id', $u->ID)->get();
        $inherited = DB::table('roles_tb')->where('ID', $u->role_id)->where('status', true)->exists() ? DB::table('role_permission_tb')->where('role_id', $u->role_id)->pluck('permission_code') : [];
        return response()->json(['status' => true, 'data' => ['name' => $u->username, 'user_type' => $u->user_type, 'allow' => $overrides->where('effect', 'allow')->pluck('permission_code')->values(), 'deny' => $overrides->where('effect', 'deny')->pluck('permission_code')->values(), 'inherited' => $inherited, 'effective' => $p->effective($u), 'access' => $scope->pluck('permission_code'), 'delegable' => $scope->where('delegable', true)->pluck('permission_code')->values()]]);
    }

    public function save(Request $r, PermissionService $p)
    {
        abort_unless($p->enabled(), 403);
        $f = $r->validate(['kind' => ['required', Rule::in(['user', 'role'])], 'id' => ['required', 'integer', 'min:1'], 'reason' => ['required', 'string', 'max:500'], 'allow' => ['present', 'array'], 'deny' => ['present', 'array'], 'access' => ['present', 'array'], 'delegable' => ['present', 'array'], 'allow.*' => ['string', 'distinct', 'exists:permission_tb,code'], 'deny.*' => ['string', 'distinct', 'exists:permission_tb,code'], 'access.*' => ['string', 'distinct', 'exists:permission_tb,code'], 'delegable.*' => ['string', 'distinct', 'exists:permission_tb,code']]);
        $f += ['allow' => [], 'deny' => [], 'access' => [], 'delegable' => []];
        if (array_intersect($f['allow'], $f['deny']) || array_diff($f['delegable'], $f['access'])) {
            throw ValidationException::withMessages(['permissions' => 'Allow and deny must not overlap; delegation must be inside the access ceiling.']);
        }
        DB::transaction(function () use ($r, $p, $f) {
            DB::table('authorization_state_tb')->where('ID', 1)->lockForUpdate()->first();
            $actor = $r->user()->fresh();
            abort_unless($p->can($actor, 'permissions.assign'), 403);
            if ($f['kind'] === 'role') {
                abort_unless($actor->user_type === 'super_admin', 403);
                abort_unless(DB::table('roles_tb')->where('ID', $f['id'])->exists(), 404);
                if ($f['deny'] || $f['access'] || $f['delegable']) {
                    throw ValidationException::withMessages(['permissions' => 'Role templates contain grants only.']);
                }
                $before = DB::table('role_permission_tb')->where('role_id', $f['id'])->pluck('permission_code')->all();
                DB::table('role_permission_tb')->where('role_id', $f['id'])->delete();
                foreach ($f['allow'] as $code) {
                    DB::table('role_permission_tb')->insert(['role_id' => $f['id'], 'permission_code' => $code]);
                }
                $p->audit($actor->ID, null, 'role_permissions_changed', $f['reason'], ['role_id' => $f['id'], 'allow' => $before], ['role_id' => $f['id'], 'allow' => $f['allow']]);
                return;
            }
            $target = DB::table('users_tb')->where('ID', $f['id'])->lockForUpdate()->first();
            abort_unless($target, 404);
            $p->assertManageTarget($actor, $target);
            abort_if($target->user_type === 'super_admin', 403, 'Super Admin authority is managed only through the installation console.');
            $before = ['overrides' => DB::table('user_permission_tb')->where('user_id', $target->ID)->get()->toArray(), 'scope' => DB::table('admin_permission_scope_tb')->where('user_id', $target->ID)->get()->toArray()];
            $allowed = $p->delegable($actor);
            if ($actor->user_type !== 'super_admin') {
                abort_if($f['access'] || $f['delegable'] || array_diff([...$f['allow'], ...$f['deny']], $allowed), 403, 'Permissions exceed your delegated authority.');
                // Preserve restrictions outside the administrator's editable scope.
                DB::table('user_permission_tb')->where('user_id', $target->ID)->whereIn('permission_code', $allowed)->delete();
            } else {
                DB::table('user_permission_tb')->where('user_id', $target->ID)->delete();
                if ($target->user_type !== 'admin' && ($f['access'] || $f['delegable'])) {
                    throw ValidationException::withMessages(['access' => 'Only Admin accounts have access/delegation ceilings.']);
                }
                DB::table('admin_permission_scope_tb')->where('user_id', $target->ID)->delete();
                foreach ($f['access'] as $code) {
                    DB::table('admin_permission_scope_tb')->insert(['user_id' => $target->ID, 'permission_code' => $code, 'delegable' => in_array($code, $f['delegable'], true)]);
                }
            }
            foreach (['allow', 'deny'] as $effect) {
                foreach ($f[$effect] as $code) {
                    DB::table('user_permission_tb')->insert(['user_id' => $target->ID, 'permission_code' => $code, 'effect' => $effect]);
                }
            }
            $p->audit($actor->ID, $target->ID, 'user_permissions_changed', $f['reason'], $before, array_intersect_key($f, array_flip(['allow', 'deny', 'access', 'delegable'])));
        });
        return response()->json(['status' => true, 'message' => 'Permissions saved. Changes apply to subsequent requests.']);
    }

    public function audit(Request $r)
    {
        abort_unless($r->user()->user_type === 'super_admin', 403);
        return response()->json(['status' => true, 'data' => DB::table('authorization_audit_tb')->orderByDesc('ID')->paginate(50)]);
    }
}
