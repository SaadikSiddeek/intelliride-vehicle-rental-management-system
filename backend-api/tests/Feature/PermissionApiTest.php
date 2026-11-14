<?php

use App\Models\User;
use App\Services\PermissionService;
use Database\Seeders\PermissionCatalogSeeder;
use Database\Seeders\InitialMasterDataSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') {
        throw new RuntimeException('RBAC tests require isolated in-memory SQLite.');
    }
    foreach (glob(database_path('migrations/2026_09_13_*.php')) as $file) {
        (require $file)->up();
    }
    foreach (['2026_10_14_175423_add_br_id_to_users_table.php', '2026_07_16_193259_create_personal_access_tokens_table.php', '2026_11_11_071730_create_customer_tables.php', '2026_11_11_073037_create_rental_package_tb.php', '2026_11_11_160000_create_booking_tables.php', '2026_11_11_170000_create_rental_handover_tables.php', '2026_11_11_180000_create_returns_finance_tables.php', '2026_11_11_190000_create_fleet_operations_tables.php', '2026_11_12_160000_create_business_profile.php', '2026_11_13_210000_create_authorization_tables.php'] as $file) {
        (require database_path('migrations/'.$file))->up();
    }
    (new PermissionCatalogSeeder)->run();
    (new InitialMasterDataSeeder)->run();
    $role = DB::table('roles_tb')->first();
    foreach ([1 => 'super_admin', 2 => 'admin', 3 => 'user', 4 => 'user', 5 => 'user'] as $id => $type) {
        DB::table('users_tb')->insert(['ID' => $id, 'role_id' => $role->ID, 'username' => 'rbac-test-'.$id, 'email' => 'rbac-'.$id.'@example.test', 'password' => Hash::make(bin2hex(random_bytes(16))), 'user_type' => $type, 'status' => true, 'managed_by_user_id' => $id > 2 ? 2 : null]);
    }
    DB::table('authorization_state_tb')->where('ID', 1)->update(['enabled' => true]);
    DB::table('staff_tb')->insert(['ID' => 1, 'branch_id' => $role->branch_id, 'department_id' => DB::table('department_tb')->value('ID'), 'designation_id' => DB::table('designation_tb')->value('ID'), 'emp_code' => 'RBAC-TEST', 'first_name' => 'Synthetic', 'last_name' => 'Employee', 'phone' => '0000000000', 'status' => true]);
    $this->grant = function (int $id, array $codes, bool $delegable = true) {
        foreach ($codes as $code) {
            DB::table('user_permission_tb')->updateOrInsert(['user_id' => $id, 'permission_code' => $code], ['effect' => 'allow']);
            if ($id === 2) {
                DB::table('admin_permission_scope_tb')->updateOrInsert(['user_id' => $id, 'permission_code' => $code], ['delegable' => $delegable]);
            }
        }
    };
});

it('keeps the catalog and essential masters idempotent without inventing accounts', function () {
    $counts = [DB::table('permission_tb')->count(), DB::table('department_tb')->count(), DB::table('roles_tb')->count()];
    (new PermissionCatalogSeeder)->run();
    (new InitialMasterDataSeeder)->run();
    expect([DB::table('permission_tb')->count(), DB::table('department_tb')->count(), DB::table('roles_tb')->count()])->toBe($counts)->and(DB::table('users_tb')->count())->toBe(5)->and(DB::table('customer_tb')->count())->toBe(0);
});

it('denies missing assignments regardless of legacy allowlists and role names', function () {
    config(['customer_access.users' => ['5'], 'access.operations_roles' => ['Installation Administrator']]);
    Sanctum::actingAs(User::find(5));
    foreach (['get_customers', 'save_customer', 'get_users', 'save_user', 'dashboard_overview', 'get_invoices', 'save_invoice_payment', 'get_report', 'save_permissions'] as $endpoint) {
        $this->postJson('/api/'.$endpoint)->assertForbidden();
    }
    $this->getJson('/api/user')->assertOk()->assertJsonPath('authorization_mode', 'rbac')->assertJsonPath('effective_permissions', []);
});

it('separates view create and edit permissions on direct API calls', function () {
    ($this->grant)(2, ['customers.view', 'customers.create', 'customers.edit']);
    ($this->grant)(3, ['customers.view']);
    ($this->grant)(4, ['customers.view', 'customers.create']);
    Sanctum::actingAs(User::find(3));
    $this->postJson('/api/get_customers')->assertOk();
    $this->postJson('/api/save_customer')->assertForbidden();
    Sanctum::actingAs(User::find(4));
    $this->postJson('/api/save_customer')->assertUnprocessable(); // Authorized; business validation still runs.
    $this->postJson('/api/save_customer', ['upd_id' => 123])->assertForbidden();
});

it('applies deny overrides and live parent revocation to existing authenticated sessions', function () {
    ($this->grant)(2, ['customers.view', 'customers.create']);
    ($this->grant)(3, ['customers.view', 'customers.create']);
    Sanctum::actingAs(User::find(3));
    $this->postJson('/api/get_customers')->assertOk();
    DB::table('admin_permission_scope_tb')->where('user_id', 2)->where('permission_code', 'customers.view')->delete();
    $this->postJson('/api/get_customers')->assertForbidden();
    DB::table('user_permission_tb')->where('user_id', 3)->where('permission_code', 'customers.create')->update(['effect' => 'deny']);
    $this->postJson('/api/save_customer')->assertForbidden();
    DB::table('users_tb')->where('ID', 3)->update(['status' => false]);
    $this->getJson('/api/user')->assertForbidden();
});

it('blocks elevation and permission assignment by normal users and out-of-scope administrators', function () {
    ($this->grant)(2, ['users.create', 'users.edit', 'users.view', 'permissions.assign', 'customers.view']);
    Sanctum::actingAs(User::find(2));
    $body = ['kind' => 'user', 'id' => 3, 'reason' => 'Synthetic permission test', 'allow' => ['payments.create'], 'deny' => [], 'access' => [], 'delegable' => []];
    $this->postJson('/api/save_permissions', $body)->assertForbidden();
    $body['allow'] = ['customers.view'];
    $this->postJson('/api/save_permissions', $body)->assertOk();
    $body['id'] = 1;
    $this->postJson('/api/save_permissions', $body)->assertForbidden();
    $this->postJson('/api/fetch_user_data', ['upd_id' => 1])->assertNotFound();
    Sanctum::actingAs(User::find(3));
    $this->postJson('/api/save_user', ['form_data' => ['user_type' => 'super_admin']])->assertForbidden();
    $this->postJson('/api/save_permissions', $body)->assertForbidden();
    expect(DB::table('authorization_audit_tb')->count())->toBe(1);
});

it('protects Super Admin from ordinary account mutation and preserves the last active authority', function () {
    Sanctum::actingAs(User::find(1));
    $this->postJson('/api/save_user', ['upd_id' => 1, 'form_data' => ['status' => false, 'user_type' => 'user']])->assertForbidden();
    expect(DB::table('users_tb')->where('ID', 1)->value('status'))->toBe(1);
    $this->postJson('/api/save_permissions', ['kind' => 'user', 'id' => 1, 'reason' => 'Attempted restriction', 'allow' => [], 'deny' => ['users.view'], 'access' => [], 'delegable' => []])->assertForbidden();
});

it('redacts financial dashboard fields and staff activity without their separate grants', function () {
    ($this->grant)(2, ['dashboard.view', 'dashboard.operations']);
    ($this->grant)(3, ['dashboard.view', 'dashboard.operations']);
    Sanctum::actingAs(User::find(3));
    $this->postJson('/api/dashboard_overview')->assertOk()->assertJsonMissingPath('data.period')->assertJsonMissingPath('data.daily')->assertJsonMissingPath('data.current.deposit_held')->assertJsonMissingPath('data.analytics.previous')->assertJsonPath('data.visibility.finance', false);
});

it('separates report financial data identity viewing and identity export', function () {
    ($this->grant)(2, ['reports.view', 'reports.export', 'reports.identity.view']);
    ($this->grant)(3, ['reports.view', 'reports.export', 'reports.identity.view']);
    Sanctum::actingAs(User::find(3));
    $this->postJson('/api/get_report', ['type' => 'rental_history'])->assertOk()->assertJsonMissing(['Invoice Total'])->assertJsonMissing(['Balance']);
    $this->postJson('/api/get_report', ['type' => 'financial'])->assertForbidden();
    $this->postJson('/api/export_report', ['type' => 'rental_history', 'include_identity' => true, 'format' => 'csv'])->assertForbidden();
});

it('keeps existing installations in explicit legacy mode until activation', function () {
    DB::table('authorization_state_tb')->where('ID', 1)->update(['enabled' => false]);
    expect(app(PermissionService::class)->enabled())->toBeFalse();
    config(['customer_access.users' => ['5']]);
    Sanctum::actingAs(User::find(5));
    $this->postJson('/api/get_customers')->assertOk();
    $this->postJson('/api/permission_catalog')->assertForbidden();
});

function rbacUserPayload(array $changes = []): array
{
    return ['form_data' => array_replace(['username' => 'synthetic-new-user', 'email' => 'synthetic-new@example.test', 'role_id' => DB::table('roles_tb')->value('ID'), 'emp_id' => 1, 'password' => bin2hex(random_bytes(12)), 'reason' => 'Isolated account-authorization regression'], $changes)];
}

it('rejects Admin account creation and self promotion even with forged valid account payloads', function () {
    ($this->grant)(2, ['users.create', 'users.edit']);
    Sanctum::actingAs(User::find(2));
    $body = rbacUserPayload(['user_type' => 'admin']);
    $body['form_data']['password_confirmation'] = $body['form_data']['password'];
    $this->postJson('/api/save_user', $body)->assertForbidden();
    $body['form_data']['user_type'] = 'super_admin';
    $this->postJson('/api/save_user', $body)->assertUnprocessable();
    $body['upd_id'] = 2;
    $this->postJson('/api/save_user', $body)->assertForbidden();
    expect(DB::table('users_tb')->count())->toBe(5);
});

it('creates only owned Normal Users for an Admin and audits without storing credentials', function () {
    ($this->grant)(2, ['users.create', 'users.view']);
    Sanctum::actingAs(User::find(2));
    $body = rbacUserPayload();
    $body['form_data']['password_confirmation'] = $body['form_data']['password'];
    $id = $this->postJson('/api/save_user', $body)->assertCreated()->json('data.ID');
    $u = DB::table('users_tb')->where('ID', $id)->first();
    expect($u->user_type)->toBe('user')->and($u->managed_by_user_id)->toBe(2)->and(Hash::check($body['form_data']['password'], $u->password))->toBeTrue();
    $audit = json_encode(DB::table('authorization_audit_tb')->get());
    expect($audit)->not->toContain($body['form_data']['password'])->not->toContain($u->password);
});

it('requires separate Admin ceilings and delegation and applies ceiling revocation immediately', function () {
    Sanctum::actingAs(User::find(1));
    $payload = ['kind' => 'user', 'id' => 2, 'reason' => 'Review Admin authority', 'allow' => ['users.view', 'permissions.assign', 'customers.view'], 'deny' => [], 'access' => ['users.view', 'permissions.assign', 'customers.view'], 'delegable' => []];
    $this->postJson('/api/save_permissions', $payload)->assertOk();
    expect(app(PermissionService::class)->can(User::find(2), 'customers.view'))->toBeTrue()->and(app(PermissionService::class)->delegable(User::find(2)))->toBe([]);
    ($this->grant)(3, ['customers.view']);
    expect(app(PermissionService::class)->can(User::find(3), 'customers.view'))->toBeFalse();
    $payload['delegable'] = ['customers.view'];
    $this->postJson('/api/save_permissions', $payload)->assertOk();
    expect(app(PermissionService::class)->can(User::find(3), 'customers.view'))->toBeTrue();
    $payload['access'] = ['users.view', 'permissions.assign'];
    $payload['delegable'] = [];
    $this->postJson('/api/save_permissions', $payload)->assertOk();
    expect(app(PermissionService::class)->can(User::find(2), 'customers.view'))->toBeFalse()->and(app(PermissionService::class)->can(User::find(3), 'customers.view'))->toBeFalse();
});

it('uses active role defaults with deny precedence and never grants management to a Normal User', function () {
    ($this->grant)(2, ['customers.view', 'customers.create']);
    $roleId = DB::table('roles_tb')->value('ID');
    foreach (['customers.view', 'customers.create', 'permissions.assign'] as $code) {
        DB::table('role_permission_tb')->insert(['role_id' => $roleId, 'permission_code' => $code]);
    }
    DB::table('user_permission_tb')->insert(['user_id' => 3, 'permission_code' => 'customers.create', 'effect' => 'deny']);
    $p = app(PermissionService::class);
    expect($p->can(User::find(3), 'customers.view'))->toBeTrue()->and($p->can(User::find(3), 'customers.create'))->toBeFalse()->and($p->can(User::find(3), 'permissions.assign'))->toBeFalse();
    DB::table('roles_tb')->where('ID', $roleId)->update(['status' => false]);
    expect($p->can(User::find(3), 'customers.view'))->toBeFalse();
});

it('does not activate previously capped grants when an Admin is demoted to Normal User', function () {
    ($this->grant)(2, ['customers.view']);
    DB::table('role_permission_tb')->insert(['role_id' => DB::table('roles_tb')->value('ID'), 'permission_code' => 'payments.create']);
    Sanctum::actingAs(User::find(1));
    $body = rbacUserPayload(['username' => 'rbac-test-2', 'email' => 'rbac-2@example.test', 'user_type' => 'user', 'password' => null]);
    $body['upd_id'] = 2;
    $this->postJson('/api/save_user', $body)->assertOk();
    expect(app(PermissionService::class)->can(User::find(2), 'payments.create'))->toBeFalse()->and(DB::table('admin_permission_scope_tb')->where('user_id', 2)->count())->toBe(0);
});

it('guards confirmation review finalization release and refunds as separate operations', function () {
    ($this->grant)(2, ['bookings.edit', 'returns.assess', 'returns.finalize', 'deposits.view']);
    ($this->grant)(3, ['bookings.edit', 'returns.assess', 'returns.finalize', 'deposits.view']);
    Sanctum::actingAs(User::find(3));
    $this->postJson('/api/save_booking', ['status' => 'Confirmed'])->assertForbidden();
    $this->postJson('/api/booking_status', ['status' => 'Confirmed'])->assertForbidden();
    $this->postJson('/api/booking_status', ['status' => 'Cancelled'])->assertForbidden();
    $this->postJson('/api/save_return_assessment', ['status' => 'Pending Review'])->assertUnprocessable();
    $this->postJson('/api/finalize_return')->assertForbidden();
    $this->postJson('/api/save_deposit_refund')->assertForbidden();
});

it('fails closed when authorization state or catalog is missing after installation', function () {
    DB::table('authorization_state_tb')->delete();
    Sanctum::actingAs(User::find(5));
    config(['customer_access.users' => ['5']]);
    $this->postJson('/api/get_customers')->assertForbidden();
    Sanctum::actingAs(User::find(1));
    $this->postJson('/api/get_customers')->assertForbidden();
    $this->postJson('/api/save_permissions')->assertForbidden();
});

it('covers every protected route and denies ordinary users from direct business operations', function () {
    Sanctum::actingAs(User::find(5));
    $always = ['api/user', 'api/business_branding', 'api/auth/activity', 'api/logout', 'api/my_profile_photo'];
    foreach (\Illuminate\Support\Facades\Route::getRoutes() as $route) {
        if (! in_array('permissions', $route->gatherMiddleware(), true)) {
            continue;
        }
        $method = in_array('POST', $route->methods(), true) ? 'POST' : 'GET';
        if (in_array($route->uri(), $always, true) && ($route->uri() !== 'api/my_profile_photo' || $method === 'GET')) {
            continue;
        }
        $uri = preg_replace('/\{[^}]+\}/', '1', $route->uri());
        $this->json($method, '/'.$uri)->assertForbidden();
    }
});

it('maps every existing protected business endpoint to an explicit rule', function () {
    $middleware = app(\App\Http\Middleware\EnforcePermissions::class);
    foreach (\Illuminate\Support\Facades\Route::getRoutes() as $route) {
        if (! in_array('permissions', $route->gatherMiddleware(), true)) {
            continue;
        }
        $method = in_array('POST', $route->methods(), true) ? 'POST' : 'GET';
        $request = \Illuminate\Http\Request::create('/'.$route->uri(), $method);
        expect($middleware->requirements($request, preg_replace('#^api/#', '', $route->uri())))->not->toBeNull($route->uri());
    }
});

it('supports master searches in the isolated installation and limits read-only lookup hydration', function () {
    Sanctum::actingAs(User::find(1));
    $this->postJson('/api/staff_filter', ['q' => 'Synthetic'])->assertOk()->assertJsonCount(1, 'data');
    $this->postJson('/api/branch_filter', ['q' => 'Installation'])->assertOk()->assertJsonCount(1, 'data');
    $this->postJson('/api/role_filter', ['q' => 'Officer'])->assertOk();
    ($this->grant)(2, ['bookings.view']);
    ($this->grant)(3, ['bookings.view']);
    Sanctum::actingAs(User::find(3));
    $this->postJson('/api/branch_filter', ['id' => 1])->assertOk();
    $this->postJson('/api/branch_filter', ['q' => 'Installation'])->assertForbidden();
    $this->postJson('/api/customer_filter', ['id' => 1])->assertOk();
    $this->postJson('/api/customer_filter', ['q' => 'name'])->assertForbidden();
});

it('keeps Company Settings administrative even when a Normal User receives forged grants', function () {
    ($this->grant)(2, ['company_settings.view', 'company_settings.update']);
    ($this->grant)(3, ['company_settings.view', 'company_settings.update']);
    Sanctum::actingAs(User::find(3));
    $this->getJson('/api/business_profile')->assertForbidden();
    $this->postJson('/api/save_business_profile')->assertForbidden();
    Sanctum::actingAs(User::find(2));
    $this->getJson('/api/business_profile')->assertOk();
    DB::table('admin_permission_scope_tb')->where('user_id', 2)->where('permission_code', 'company_settings.update')->delete();
    $this->postJson('/api/save_business_profile')->assertForbidden();
});

it('prevents a second account from impersonating an already associated employee', function () {
    DB::table('users_tb')->where('ID', 1)->update(['emp_id' => '1']);
    ($this->grant)(2, ['users.create']);
    Sanctum::actingAs(User::find(2));
    $body = rbacUserPayload();
    $body['form_data']['password_confirmation'] = $body['form_data']['password'];
    $this->postJson('/api/save_user', $body)->assertUnprocessable()->assertJsonValidationErrors('emp_id');
    expect(DB::table('users_tb')->count())->toBe(5);
});


it('preserves unchanged approved legacy employee links while preventing new duplicate assignments', function () {
    DB::table('users_tb')->whereIn('ID', [3, 4])->update(['emp_id' => '1']);
    Sanctum::actingAs(User::find(1));
    $role = DB::table('roles_tb')->where('role_name', 'Rental Officer')->value('ID');
    $body = rbacUserPayload(['username' => 'rbac-test-3', 'email' => 'rbac-3@example.test', 'role_id' => $role, 'password' => null]);
    $body['upd_id'] = 3;
    $this->postJson('/api/save_user', $body)->assertOk();
    expect(DB::table('users_tb')->where('ID', 3)->value('role_id'))->toBe($role)
        ->and(DB::table('users_tb')->where('emp_id', '1')->count())->toBe(2);
    $body['upd_id'] = 5;
    $body['form_data']['username'] = 'rbac-test-5';
    $body['form_data']['email'] = 'rbac-5@example.test';
    $this->postJson('/api/save_user', $body)->assertUnprocessable()->assertJsonValidationErrors('emp_id');
    expect(DB::table('users_tb')->where('ID', 5)->value('emp_id'))->toBeNull();
});
