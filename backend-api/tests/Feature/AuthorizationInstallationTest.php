<?php

use App\Services\PermissionService;
use Database\Seeders\InitialMasterDataSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') {
        throw new RuntimeException('Installer tests require empty in-memory SQLite.');
    }
    Artisan::call('migrate', ['--force' => true]);
});

it('migrates an empty installation without creating accounts or activating permissions', function () {
    expect(DB::table('users_tb')->count())->toBe(0)->and(DB::table('authorization_state_tb')->value('enabled'))->toBe(0)->and(app(PermissionService::class)->enabled())->toBeFalse();
});

it('requires private interactive initialization and never supplies a shared password', function () {
    expect(Artisan::call('intelliride:rbac-initialize', ['--no-interaction' => true]))->toBe(1)->and(DB::table('users_tb')->count())->toBe(0);
});

it('creates only one installation Super Admin and preserves it on subsequent runs', function () {
    $password = bin2hex(random_bytes(12));
    $this->artisan('intelliride:rbac-initialize')
        ->expectsQuestion('Installation Super Admin email', 'installer@example.test')
        ->expectsQuestion('Installation Super Admin username', 'synthetic-installer')
        ->expectsQuestion('Strong password (at least 12 characters)', $password)
        ->expectsQuestion('Confirm password', $password)
        ->expectsConfirmation('Initialize this EMPTY database with one Super Admin and essential master records?', 'yes')
        ->assertSuccessful();
    $u = DB::table('users_tb')->first();
    expect($u->user_type)->toBe('super_admin')->and(Hash::check($password, $u->password))->toBeTrue()->and(DB::table('users_tb')->count())->toBe(1)->and(app(PermissionService::class)->enabled())->toBeTrue()->and(DB::table('staff_tb')->count())->toBe(0);
    $hash = $u->password;
    expect(Artisan::call('intelliride:rbac-initialize', ['--no-interaction' => true]))->toBe(0)->and(DB::table('users_tb')->count())->toBe(1)->and(DB::table('users_tb')->first()->password)->toBe($hash);
});

it('refuses implicit promotion of an existing account', function () {
    (new InitialMasterDataSeeder)->run();
    $role = DB::table('roles_tb')->first();
    DB::table('users_tb')->insert(['role_id' => $role->ID, 'username' => 'existing', 'email' => 'existing@example.test', 'password' => Hash::make(bin2hex(random_bytes(16))), 'status' => true]);
    $before = DB::table('users_tb')->first();
    expect(Artisan::call('intelliride:rbac-initialize', ['--no-interaction' => true]))->toBe(1)->and(DB::table('users_tb')->first()->user_type)->toBe('user')->and(DB::table('users_tb')->first()->password)->toBe($before->password)->and(app(PermissionService::class)->enabled())->toBeFalse();
});

it('previews explicit existing-account mappings without changing authority or passwords', function () {
    (new InitialMasterDataSeeder)->run();
    $role = DB::table('roles_tb')->first();
    $id = DB::table('users_tb')->insertGetId(['role_id' => $role->ID, 'username' => 'existing', 'email' => 'existing@example.test', 'password' => Hash::make(bin2hex(random_bytes(16))), 'status' => true], 'ID');
    $path = tempnam(sys_get_temp_dir(), 'rbac-plan-');
    try {
        file_put_contents($path, json_encode(['reason' => 'Isolated transition preview', 'accounts' => [['id' => $id, 'expected_username' => 'existing', 'expected_email' => 'existing@example.test', 'expected_emp_id' => null, 'user_type' => 'super_admin', 'managed_by_user_id' => null, 'allow' => [], 'deny' => [], 'access' => [], 'delegable' => []]]]));
        expect(Artisan::call('intelliride:rbac-activate', ['plan' => $path]))->toBe(0)->and(app(PermissionService::class)->enabled())->toBeFalse()->and(DB::table('users_tb')->where('ID', $id)->value('user_type'))->toBe('user');
        expect(Artisan::call('intelliride:rbac-activate', ['plan' => $path, '--apply' => true, '--no-interaction' => true]))->toBe(1)->and(app(PermissionService::class)->enabled())->toBeFalse();
    } finally {
        unlink($path);
    }
});

it('activates only an explicitly matched reviewed identity and revokes old tokens without resetting passwords', function () {
    (new InitialMasterDataSeeder)->run();
    $role = DB::table('roles_tb')->first();
    $hash = Hash::make(bin2hex(random_bytes(16)));
    $id = DB::table('users_tb')->insertGetId(['role_id' => $role->ID, 'username' => 'existing', 'email' => 'existing@example.test', 'password' => $hash, 'status' => true], 'ID');
    \App\Models\User::find($id)->createToken('synthetic-existing-session');
    $path = tempnam(sys_get_temp_dir(), 'rbac-plan-');
    try {
        $plan = ['reason' => 'Reviewed synthetic migration', 'accounts' => [['id' => $id, 'expected_username' => 'existing', 'expected_email' => 'mismatch@example.test', 'expected_emp_id' => null, 'user_type' => 'super_admin', 'managed_by_user_id' => null, 'allow' => [], 'deny' => [], 'access' => [], 'delegable' => []]]];
        file_put_contents($path, json_encode($plan));
        expect(Artisan::call('intelliride:rbac-activate', ['plan' => $path]))->toBe(1)->and(DB::table('users_tb')->where('ID', $id)->value('user_type'))->toBe('user');
        $plan['accounts'][0]['expected_email'] = 'existing@example.test';
        file_put_contents($path, json_encode($plan));
        $this->artisan('intelliride:rbac-activate', ['plan' => $path, '--apply' => true])
            ->expectsConfirmation('Activate this reviewed mapping, replacing allowlist authority and revoking all existing tokens?', 'yes')
            ->assertSuccessful();
        expect(app(PermissionService::class)->enabled())->toBeTrue()->and(DB::table('users_tb')->where('ID', $id)->value('password'))->toBe($hash)->and(DB::table('personal_access_tokens')->count())->toBe(0)->and(DB::table('authorization_audit_tb')->count())->toBe(1);
        expect(DB::table('authorization_audit_tb')->value('after_state'))->not->toContain('expected_email')->not->toContain($hash);
    } finally {
        unlink($path);
    }
});

it('refuses conflicting Super Admin identities without choosing or resetting either account', function () {
    (new InitialMasterDataSeeder)->run();
    $role = DB::table('roles_tb')->first();
    foreach ([1, 2] as $id) {
        DB::table('users_tb')->insert(['role_id' => $role->ID, 'username' => 'conflict-'.$id, 'email' => 'conflict-'.$id.'@example.test', 'password' => Hash::make(bin2hex(random_bytes(16))), 'user_type' => 'super_admin', 'status' => true]);
    }
    expect(Artisan::call('intelliride:rbac-initialize', ['--no-interaction' => true]))->toBe(1)->and(DB::table('users_tb')->count())->toBe(2)->and(app(PermissionService::class)->enabled())->toBeFalse();
});


it('allows different accounts to share a permission but rejects repeated grants inside one account', function () {
    (new InitialMasterDataSeeder)->run();
    $role = DB::table('roles_tb')->first();
    $accounts = [];
    foreach ([1, 2, 3] as $id) {
        $name = 'shared-permission-'.$id;
        $email = $name.'@example.test';
        DB::table('users_tb')->insert(['ID' => $id, 'role_id' => $role->ID, 'username' => $name, 'email' => $email, 'password' => Hash::make(bin2hex(random_bytes(16))), 'status' => true]);
        $accounts[] = ['id' => $id, 'expected_username' => $name, 'expected_email' => $email, 'expected_emp_id' => null, 'user_type' => $id === 1 ? 'super_admin' : 'user', 'managed_by_user_id' => $id === 1 ? null : 1, 'allow' => $id === 1 ? [] : ['customers.view'], 'deny' => [], 'access' => [], 'delegable' => []];
    }
    $path = tempnam(sys_get_temp_dir(), 'rbac-shared-');
    try {
        $plan = ['reason' => 'Review shared ordinary access', 'accounts' => $accounts];
        file_put_contents($path, json_encode($plan));
        expect(Artisan::call('intelliride:rbac-activate', ['plan' => $path]))->toBe(0)->and(app(PermissionService::class)->enabled())->toBeFalse();
        $plan['accounts'][2]['allow'][] = 'customers.view';
        file_put_contents($path, json_encode($plan));
        expect(Artisan::call('intelliride:rbac-activate', ['plan' => $path]))->toBe(1)->and(app(PermissionService::class)->enabled())->toBeFalse()->and(DB::table('users_tb')->count())->toBe(3);
    } finally {
        unlink($path);
    }
});


function initializeSyntheticOwner($test): string
{
    $password = bin2hex(random_bytes(16));
    $test->artisan('intelliride:rbac-initialize')
        ->expectsQuestion('Installation Super Admin email', 'owner-training@example.test')
        ->expectsQuestion('Installation Super Admin username', 'owner-training')
        ->expectsQuestion('Strong password (at least 12 characters)', $password)
        ->expectsQuestion('Confirm password', $password)
        ->expectsConfirmation('Initialize this EMPTY database with one Super Admin and essential master records?', 'yes')
        ->assertSuccessful();
    return $password;
}

it('enforces first-login replacement of the installation secret before business access', function () {
    $initial = initializeSyntheticOwner($this);
    expect(DB::table('users_tb')->count())->toBe(1)
        ->and(DB::table('users_tb')->where('user_type', 'admin')->count())->toBe(0)
        ->and((bool) DB::table('users_tb')->value('must_change_password'))->toBeTrue()
        ->and(DB::table('user_permission_tb')->count())->toBe(0)
        ->and(DB::table('role_permission_tb')->count())->toBe(0);
    $login = $this->postJson('/api/login', ['email' => 'owner-training@example.test', 'password' => $initial])->assertOk();
    $token = $login->json('token');
    \Illuminate\Support\Facades\Auth::guard('web')->logout();
    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/user')->assertOk()->assertJsonPath('must_change_password', true);
    $this->postJson('/api/get_customers')->assertForbidden()->assertJsonPath('code', 'PASSWORD_CHANGE_REQUIRED');
    $this->postJson('/api/save_user', ['form_data' => ['user_type' => 'super_admin']])->assertForbidden();
    $next = bin2hex(random_bytes(16));
    $this->postJson('/api/auth/password', ['current_password' => 'incorrect-synthetic', 'password' => $next, 'password_confirmation' => $next])->assertUnprocessable();
    $this->postJson('/api/auth/password', ['current_password' => $initial, 'password' => $initial, 'password_confirmation' => $initial])->assertUnprocessable();
    $this->postJson('/api/auth/password', ['current_password' => $initial, 'password' => $next, 'password_confirmation' => 'different-synthetic'])->assertUnprocessable();
    // A real Sanctum token exercises the transaction/token preservation path.
    $other = \App\Models\User::first()->createToken('other-synthetic-install-session');
    $this->postJson('/api/auth/password', ['current_password' => $initial, 'password' => $next, 'password_confirmation' => $next])
        ->assertOk()->assertJsonPath('user.must_change_password', false);
    expect(DB::table('personal_access_tokens')->count())->toBe(1)
        ->and(DB::table('personal_access_tokens')->where('id', $other->accessToken->id)->exists())->toBeFalse()
        ->and(Hash::check($next, DB::table('users_tb')->value('password')))->toBeTrue();
    $this->postJson('/api/get_customers')->assertOk();
    $this->postJson('/api/auth/password', ['current_password' => $next, 'password' => $initial, 'password_confirmation' => $initial])->assertForbidden();
    expect(DB::table('authorization_audit_tb')->where('action', 'installation_password_changed')->count())->toBe(1)
        ->and(DB::table('authorization_audit_tb')->where('action', 'installation_password_changed')->value('after_state'))->not->toContain($initial)->not->toContain($next);
    foreach (['customer_tb', 'booking_tb', 'invoice_tb', 'invoice_payment_tb', 'rental_deposit_tb'] as $table) expect(DB::table($table)->count())->toBe(0);
});

it('gives a database-verified active owner every newly registered permission without assignments', function () {
    initializeSyntheticOwner($this);
    $owner = \App\Models\User::first();
    $p = app(PermissionService::class);
    expect(count($p->effective($owner)))->toBe(DB::table('permission_tb')->count());
    DB::table('permission_tb')->insert(['code' => 'future_module.view', 'group_name' => 'Future', 'module_name' => 'Future module', 'action_name' => 'View']);
    expect($p->can($owner, 'future_module.view'))->toBeTrue()
        ->and(DB::table('user_permission_tb')->count())->toBe(0);
    // In-memory/client authority and active flags cannot impersonate trusted DB state.
    DB::table('users_tb')->where('ID', $owner->ID)->update(['user_type' => 'user']);
    $owner->user_type = 'super_admin';
    expect($p->can($owner, 'future_module.view'))->toBeFalse();
    DB::table('users_tb')->where('ID', $owner->ID)->update(['user_type' => 'super_admin', 'status' => false]);
    expect($p->effective($owner))->toBe([]);
});

it('preserves owner hashes and all master counts when safe seeders and initialization rerun', function () {
    initializeSyntheticOwner($this);
    $hash = DB::table('users_tb')->value('password');
    $tables = ['users_tb', 'branch_tb', 'department_tb', 'designation_tb', 'fuel_type_tb', 'transmission_type_tb', 'vehicle_category_tb', 'roles_tb', 'permission_tb'];
    $before = array_map(fn ($t) => DB::table($t)->count(), $tables);
    Artisan::call('db:seed', ['--force' => true]);
    (new InitialMasterDataSeeder)->run();
    (new \Database\Seeders\PermissionCatalogSeeder)->run();
    expect(Artisan::call('intelliride:rbac-initialize', ['--no-interaction' => true]))->toBe(0)
        ->and(array_map(fn ($t) => DB::table($t)->count(), $tables))->toBe($before)
        ->and(DB::table('users_tb')->value('password'))->toBe($hash)
        ->and((bool) DB::table('users_tb')->value('must_change_password'))->toBeTrue();
    expect(DB::table('department_tb')->count())->toBe(6)->and(DB::table('designation_tb')->count())->toBe(6)
        ->and(DB::table('fuel_type_tb')->count())->toBe(4)->and(DB::table('transmission_type_tb')->count())->toBe(2)
        ->and(DB::table('vehicle_category_tb')->count())->toBe(4)->and(DB::table('branch_tb')->count())->toBe(1);
});


it('refuses a damaged installation singleton without resetting the existing owner', function () {
    initializeSyntheticOwner($this);
    $hash = DB::table('users_tb')->value('password');
    DB::table('authorization_state_tb')->delete();
    expect(Artisan::call('intelliride:rbac-initialize', ['--no-interaction' => true]))->toBe(1)
        ->and(DB::table('users_tb')->count())->toBe(1)->and(DB::table('users_tb')->value('password'))->toBe($hash);
});


it('lets the fresh owner create the first Admin who delegates only approved Normal User access', function () {
    initializeSyntheticOwner($this);
    // Required password replacement is exercised separately with real bearer tokens.
    DB::table('users_tb')->update(['must_change_password' => false]);
    $owner = \App\Models\User::first();
    $role = DB::table('roles_tb')->first();
    foreach ([1, 2] as $id) DB::table('staff_tb')->insert(['ID' => $id, 'branch_id' => $role->branch_id, 'department_id' => DB::table('department_tb')->value('ID'), 'designation_id' => DB::table('designation_tb')->value('ID'), 'emp_code' => 'INSTALL-TEST-'.$id, 'first_name' => 'Synthetic', 'last_name' => 'Employee '.$id, 'phone' => '0000000000', 'status' => true]);
    $payload = function ($type, $employee, $name) use ($role) {
        $password = bin2hex(random_bytes(16));
        return ['form_data' => ['username' => $name, 'email' => $name.'@example.test', 'emp_id' => $employee, 'role_id' => $role->ID, 'user_type' => $type, 'password' => $password, 'password_confirmation' => $password, 'reason' => 'Isolated fresh-install delegation test']];
    };
    \Laravel\Sanctum\Sanctum::actingAs($owner);
    $admin = $this->postJson('/api/save_user', $payload('admin', 1, 'first-admin'))->assertCreated()->json('data.ID');
    $this->postJson('/api/save_permissions', ['kind' => 'user', 'id' => $admin, 'reason' => 'Approve limited company administration', 'allow' => ['users.create', 'permissions.assign', 'customers.view'], 'deny' => [], 'access' => ['users.create', 'permissions.assign', 'customers.view'], 'delegable' => ['customers.view']])->assertOk();
    \Laravel\Sanctum\Sanctum::actingAs(\App\Models\User::find($admin));
    $this->postJson('/api/save_user', $payload('admin', 2, 'forbidden-admin'))->assertForbidden();
    $normal = $this->postJson('/api/save_user', $payload('user', 2, 'first-normal'))->assertCreated()->json('data.ID');
    $this->postJson('/api/save_permissions', ['kind' => 'user', 'id' => $normal, 'reason' => 'Assign view-only customer access', 'allow' => ['customers.view'], 'deny' => [], 'access' => [], 'delegable' => []])->assertOk();
    \Laravel\Sanctum\Sanctum::actingAs(\App\Models\User::find($normal));
    $this->postJson('/api/get_customers')->assertOk();
    $this->postJson('/api/save_customer')->assertForbidden();
    $this->postJson('/api/save_permissions')->assertForbidden();
    $this->postJson('/api/dashboard_overview')->assertForbidden();
    expect(DB::table('users_tb')->where('user_type', 'super_admin')->count())->toBe(1)
        ->and(DB::table('users_tb')->where('user_type', 'admin')->count())->toBe(1)
        ->and(DB::table('customer_tb')->count())->toBe(0)->and(DB::table('invoice_tb')->count())->toBe(0);
});


it('rejects an invalid bootstrap secret before creating accounts or master data', function () {
    $password = str_repeat('x', 73);
    $this->artisan('intelliride:rbac-initialize')
        ->expectsQuestion('Installation Super Admin email', 'invalid-owner@example.test')
        ->expectsQuestion('Installation Super Admin username', 'invalid-owner')
        ->expectsQuestion('Strong password (at least 12 characters)', $password)
        ->expectsQuestion('Confirm password', $password)->assertFailed();
    expect(DB::table('users_tb')->count())->toBe(0)->and(DB::table('branch_tb')->count())->toBe(0)
        ->and(app(PermissionService::class)->enabled())->toBeFalse();
});

it('rejects unsafe hash inputs through the same shared installation-password rule', function () {
    foreach ([str_repeat('é', 37), "synthetic-password\0suffix"] as $password) {
        expect(validator(['password' => $password], ['password' => ['required', 'string', new \App\Rules\InstallationPassword]])->fails())->toBeTrue();
    }
});


it('seeds a fresh installation through DatabaseSeeder without creating or promoting any account', function () {
    expect(Artisan::call('db:seed', ['--force' => true]))->toBe(0);
    expect(DB::table('branch_tb')->count())->toBe(1)
        ->and(DB::table('department_tb')->count())->toBe(6)
        ->and(DB::table('designation_tb')->count())->toBe(6)
        ->and(DB::table('roles_tb')->count())->toBe(4)
        ->and(DB::table('permission_tb')->count())->toBe(count(\App\Services\PermissionCatalog::definitions()))
        ->and(DB::table('users_tb')->count())->toBe(0)
        ->and(DB::table('staff_tb')->count())->toBe(0)
        ->and(app(PermissionService::class)->enabled())->toBeFalse();
    foreach (['customer_tb', 'vehicle_tb', 'booking_tb', 'invoice_tb', 'invoice_payment_tb', 'rental_deposit_tb'] as $table) expect(DB::table($table)->count())->toBe(0);
    initializeSyntheticOwner($this);
    $owner = \App\Models\User::first();
    expect($owner->user_type)->toBe('super_admin')->and($owner->must_change_password)->toBeTrue()
        ->and(DB::table('users_tb')->count())->toBe(1)
        ->and(DB::table('users_tb')->where('user_type', 'admin')->count())->toBe(0);
    $hash = $owner->password;
    expect(Artisan::call('db:seed', ['--force' => true]))->toBe(0)
        ->and(Artisan::call('intelliride:rbac-initialize', ['--no-interaction' => true]))->toBe(0)
        ->and(DB::table('users_tb')->count())->toBe(1)->and(DB::table('users_tb')->value('password'))->toBe($hash)
        ->and(DB::table('user_permission_tb')->count())->toBe(0);
});

it('preserves operator-maintained reference data when the main seeder reruns', function () {
    Artisan::call('db:seed', ['--force' => true]);
    DB::table('branch_tb')->update(['branch_name' => 'Owner configured branch', 'branch_code' => 'OWNER']);
    DB::table('department_tb')->where('department_name', 'Operations')->update(['description' => 'Owner maintained description', 'status' => false]);
    DB::table('roles_tb')->where('role_name', 'Rental Officer')->update(['description' => 'Reviewed custom template', 'status' => false]);
    DB::table('fuel_type_tb')->insert(['fuel_type_name' => 'Owner configured fuel', 'status' => true]);
    $snapshot = fn () => collect(['branch_tb','department_tb','designation_tb','roles_tb','fuel_type_tb','transmission_type_tb','vehicle_category_tb'])->mapWithKeys(fn ($t) => [$t => DB::table($t)->orderBy('ID')->get()->toArray()])->toArray();
    $before = $snapshot();
    Artisan::call('db:seed', ['--force' => true]);
    expect($snapshot())->toEqual($before)->and(DB::table('users_tb')->count())->toBe(0);
});
