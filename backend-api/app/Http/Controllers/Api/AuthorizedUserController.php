<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AuthorizedUserController extends Controller
{
    private function query(Request $r)
    {
        $q = DB::table('users_tb');
        if ($r->user()->user_type !== 'super_admin') {
            $q->where('user_type', 'user')->where('managed_by_user_id', $r->user()->ID);
        }
        return $q;
    }

    public function index(Request $r)
    {
        return response()->json(['status' => true, 'data' => $this->query($r)->orderByDesc('ID')->get(['ID', 'role_id', 'username', 'email', 'emp_id', 'status', 'user_type', 'managed_by_user_id'])]);
    }

    public function show(Request $r)
    {
        $r->validate(['upd_id' => ['required', 'integer', 'min:1']]);
        $u = $this->query($r)->where('ID', $r->input('upd_id'))->first(['ID', 'role_id', 'username', 'email', 'emp_id', 'status', 'user_type', 'managed_by_user_id']);
        abort_unless($u, 404);
        return response()->json(['status' => true, 'data' => $u]);
    }

    public function save(Request $r, PermissionService $p)
    {
        $r->validate(['upd_id' => ['nullable', 'integer', 'min:1'], 'form_data' => ['required', 'array']]);
        return DB::transaction(function () use ($r, $p) {
            DB::table('authorization_state_tb')->where('ID', 1)->lockForUpdate()->first();
            $actor = $r->user()->fresh();
            $existing = $r->filled('upd_id') ? DB::table('users_tb')->where('ID', $r->input('upd_id'))->lockForUpdate()->first() : null;
            abort_if($r->filled('upd_id') && ! $existing, 404);
            abort_unless($p->can($actor, $existing ? 'users.edit' : 'users.create'), 403);
            if ($existing) {
                $p->assertManageTarget($actor, $existing);
                abort_if($existing->user_type === 'super_admin', 403, 'Super Admin account changes require the installation console.');
            }
            $employeeRules = ['required', 'integer', Rule::exists('staff_tb', 'ID')->where('status', true)];
            $employeeId = $r->input('form_data.emp_id');
            // Preserve approved legacy links; forbid creating or reassigning duplicate associations.
            if (! $existing || ! is_scalar($employeeId) || (string) $existing->emp_id !== (string) $employeeId) {
                $employeeRules[] = Rule::unique('users_tb', 'emp_id')->ignore($existing?->ID, 'ID');
            }
            $f = validator($r->input('form_data'), [
                'username' => ['required', 'string', 'max:100', Rule::unique('users_tb', 'username')->ignore($existing?->ID, 'ID')],
                'email' => ['required', 'email', 'max:150', Rule::unique('users_tb', 'email')->ignore($existing?->ID, 'ID')],
                'role_id' => ['required', 'integer', Rule::exists('roles_tb', 'ID')->where('status', true)],
                'emp_id' => $employeeRules,
                'password' => [$existing ? 'nullable' : 'required', 'string', 'min:12', 'confirmed'],
                'password_confirmation' => ['nullable', 'string'],
                'user_type' => ['sometimes', Rule::in(['admin', 'user'])],
                'status' => ['sometimes', 'boolean'], 'managed_by_user_id' => ['prohibited'],
                'reason' => ['required', 'string', 'max:500'],
            ], ['emp_id.unique' => 'This employee is already linked to another account.'])->validate();
            if ($actor->user_type !== 'super_admin') {
                abort_if(isset($f['user_type']) && $f['user_type'] !== 'user', 403, 'Only Super Admin can create Admin accounts.');
                $grants = DB::table('role_permission_tb')->where('role_id', $f['role_id'])->pluck('permission_code')->all();
                abort_if(array_diff($grants, $p->delegable($actor)), 403, 'This role template exceeds your delegated authority.');
            }
            $status = $f['status'] ?? $existing?->status ?? true;
            if ($existing && (bool) $existing->status !== (bool) $status) {
                abort_unless($p->can($actor, 'users.deactivate'), 403);
            }
            $data = array_intersect_key($f, array_flip(['username', 'email', 'role_id', 'emp_id']));
            $data['status'] = $status;
            $data['user_type'] = $actor->user_type === 'super_admin' ? ($f['user_type'] ?? $existing?->user_type ?? 'user') : 'user';
            $data['updated_at'] = now();
            if (! empty($f['password'])) {
                $data['password'] = Hash::make($f['password']);
            }
            if ($existing) {
                $beforeEffective = $p->effective(\App\Models\User::findOrFail($existing->ID));
                DB::table('users_tb')->where('ID', $existing->ID)->update($data);
                $id = $existing->ID;
                // Old Admin ceilings never revive if this account is promoted again later.
                if ($existing->user_type !== $data['user_type']) {
                    DB::table('admin_permission_scope_tb')->where('user_id', $id)->delete();
                    if ($data['user_type'] === 'user') {
                        foreach (array_diff(DB::table('permission_tb')->pluck('code')->all(), $beforeEffective) as $code) {
                            DB::table('user_permission_tb')->updateOrInsert(['user_id' => $id, 'permission_code' => $code], ['effect' => 'deny']);
                        }
                    }
                }
                if (isset($data['password']) || ! $status || $existing->user_type !== $data['user_type']) {
                    DB::table('personal_access_tokens')->where('tokenable_type', \App\Models\User::class)->where('tokenable_id', $id)->delete();
                }
            } else {
                // Preserve the existing User module's creating-account branch convention.
                $data['branch_id'] = $actor->branch_id;
                $data['managed_by_user_id'] = $actor->ID;
                $data['created_at'] = now();
                $id = DB::table('users_tb')->insertGetId($data, 'ID');
            }
            $safe = static fn ($u) => $u ? array_intersect_key((array) $u, array_flip(['role_id', 'user_type', 'status', 'managed_by_user_id', 'emp_id'])) : [];
            $p->audit($actor->ID, $id, $existing ? 'user_updated' : 'user_created', $f['reason'], $safe($existing), $safe(DB::table('users_tb')->where('ID', $id)->first()));
            return response()->json(['status' => true, 'message' => $existing ? 'User updated successfully.' : 'User created successfully.', 'data' => ['ID' => $id]], $existing ? 200 : 201);
        });
    }
}
