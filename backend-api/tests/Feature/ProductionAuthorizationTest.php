<?php

use App\Models\User;
use App\Services\AccessService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') {
        throw new RuntimeException('Isolated SQLite only');
    }
    foreach (glob(database_path('migrations/2026_09_13_*.php')) as $file) {
        (require $file)->up();
    }
    foreach (['2026_07_16_193259_create_personal_access_tokens_table.php', '2026_11_11_071730_create_customer_tables.php', '2026_11_11_073037_create_rental_package_tb.php', '2026_11_11_160000_create_booking_tables.php', '2026_11_11_170000_create_rental_handover_tables.php', '2026_11_11_180000_create_returns_finance_tables.php', '2026_11_11_190000_create_fleet_operations_tables.php', '2026_11_12_160000_create_business_profile.php'] as $file) {
        (require database_path('migrations/'.$file))->up();
    }
    DB::table('branch_tb')->insert(['ID' => 1, 'branch_name' => 'Isolated', 'branch_code' => 'TEST']);
    DB::table('roles_tb')->insert([['ID' => 10, 'role_name' => 'Admin', 'branch_id' => 1], ['ID' => 11, 'role_name' => 'Accountant', 'branch_id' => 1]]);
    foreach ([701 => 10, 702 => 11, 903 => 10] as $id => $role) {
        DB::table('users_tb')->insert(['ID' => $id, 'role_id' => $role, 'username' => 'isolated-'.$id, 'email' => 'isolated-'.$id.'@example.test', 'password' => Hash::make('IsolatedOnly!2026'), 'emp_id' => null, 'status' => 1]);
    }
    config(['customer_access.users' => ['701'], 'access.operations_users' => null, 'access.operations_roles' => [], 'access.customer_roles' => [], 'access.administration_users' => null, 'access.company_users' => null, 'access.administrator_roles' => ['Admin'], 'rental.identity_report_user_ids' => []]);
});

it('requires authentication and denies missing operations assignments even for an Admin role', function () {
    $this->postJson('/api/dashboard_overview')->assertUnauthorized();
    Sanctum::actingAs(User::findOrFail(903));
    $this->postJson('/api/dashboard_overview')->assertForbidden()->assertJsonPath('message', 'Rental operations access is required.');
    config(['customer_access.users' => []]);
    Sanctum::actingAs(User::findOrFail(701));
    $this->postJson('/api/dashboard_overview')->assertForbidden();
});

it('permits the assigned active operations user and returns authoritative capabilities', function () {
    Sanctum::actingAs(User::findOrFail(701));
    $this->postJson('/api/dashboard_overview')->assertOk()->assertJsonPath('status', true);
    $this->getJson('/api/user')->assertOk()->assertJsonPath('permissions.rental_operations', true)->assertJsonPath('permissions.administration', true)->assertJsonPath('permissions.identity_reports', false);
});

it('separates customer, operations, administration and sensitive identity permissions', function () {
    config(['access.operations_users' => ['903']]);
    $service = app(AccessService::class);
    expect($service->operations(User::find(903)))->toBeTrue()->and($service->customers(User::find(903)))->toBeFalse()->and($service->administration(User::find(903)))->toBeFalse()->and($service->operations(User::find(701)))->toBeFalse()->and($service->customers(User::find(701)))->toBeTrue();
    Sanctum::actingAs(User::findOrFail(903));
    $this->postJson('/api/get_customers')->assertForbidden();
    $this->postJson('/api/get_report', ['type' => 'rental_history', 'include_identity' => true])->assertForbidden();
    $this->getJson('/api/business_profile')->assertForbidden();
});

it('allows explicitly configured server-verified role assignments across different database IDs', function () {
    config(['customer_access.users' => [], 'access.operations_roles' => ['admin']]);
    Sanctum::actingAs(User::findOrFail(903));
    $this->postJson('/api/dashboard_overview')->assertOk();
    $this->postJson('/api/get_users')->assertForbidden();
    config(['access.administration_users' => ['903'], 'rental.identity_report_user_ids' => ['903']]);
    $this->postJson('/api/get_users')->assertOk();
    $this->postJson('/api/report_options')->assertOk()->assertJsonPath('data.can_include_identity', true);
});

it('rejects ordinary users from every User and Role API including self escalation', function () {
    Sanctum::actingAs(User::findOrFail(702));
    foreach (['save_user', 'get_users', 'fetch_user_data', 'save_role', 'get_roles', 'fetch_role_data'] as $endpoint) {
        $this->postJson('/api/'.$endpoint, ['upd_id' => 702, 'form_data' => ['role_id' => 10]])->assertForbidden();
    }
    expect(DB::table('users_tb')->where('ID', 702)->value('role_id'))->toBe(11);
});

it('requires the administrator role in addition to explicit administration assignment', function () {
    config(['access.administration_users' => ['702'], 'access.company_users' => ['702']]);
    Sanctum::actingAs(User::findOrFail(702));
    $this->postJson('/api/get_users')->assertForbidden();
    $this->getJson('/api/business_profile')->assertForbidden();
});

it('blocks inactive accounts with existing tokens and refuses to mint a new token', function () {
    DB::table('users_tb')->where('ID', 701)->update(['status' => false]);
    $this->postJson('/api/login', ['email' => 'isolated-701@example.test', 'password' => 'IsolatedOnly!2026'])->assertForbidden();
    expect(DB::table('personal_access_tokens')->count())->toBe(0);
    Sanctum::actingAs(User::findOrFail(701));
    foreach (['/api/user', '/api/business_branding'] as $url) {
        $this->getJson($url)->assertForbidden();
    }
    $this->postJson('/api/dashboard_overview')->assertForbidden();
    $this->postJson('/api/get_staff')->assertForbidden();
});

it('does not permit public registration or role selection to create a privileged account', function () {
    $count = DB::table('users_tb')->count();
    $this->postJson('/api/signup', ['username' => 'attacker', 'name' => 'Attacker', 'role_id' => 10, 'status' => 1, 'email' => 'attacker@example.test', 'password' => 'IsolatedOnly!2026', 'password_confirmation' => 'IsolatedOnly!2026'])->assertForbidden();
    expect(DB::table('users_tb')->count())->toBe($count)->and(DB::table('personal_access_tokens')->count())->toBe(0);
});

it('does not grant access from staff record creator or a matching employee association', function () {
    DB::table('users_tb')->where('ID', 702)->update(['emp_id' => '701']);
    $ordinary = User::findOrFail(702);
    expect(app(AccessService::class)->operations($ordinary))->toBeFalse()->and(app(AccessService::class)->administration($ordinary))->toBeFalse();
});

it('keeps cached explicit empty operations configuration authoritative without broadening the legacy customer list', function () {
    config(['access.operations_users' => []]);
    Sanctum::actingAs(User::findOrFail(701));
    $this->postJson('/api/dashboard_overview')->assertForbidden();
    $this->postJson('/api/get_customers')->assertOk();
});

it('reports deployment readiness without printing credentials or personal details', function () {
    $code = Artisan::call('intelliride:deployment-audit', ['--user' => '903']);
    $output = Artisan::output();
    $data = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
    expect($code)->toBe(0)->and($data)->toHaveKeys(['app_key_present', 'pending_migrations'])
        ->and($output)->not->toContain('IsolatedOnly')->not->toContain('isolated-903@example.test');
});

it('reads deployment-local assignments through the actual environment configuration parser', function () {
    $repository = Env::getRepository();
    $values = ['RENTAL_OPERATIONS_USER_IDS' => '903, 904', 'RENTAL_OPERATIONS_ROLE_NAMES' => '', 'ADMIN_USER_IDS' => '903'];
    $original = [];
    foreach ($values as $key => $value) {
        $original[$key] = $repository->get($key);
        $repository->set($key, $value);
    }
    try {
        $loaded = require config_path('access.php');
        expect($loaded['operations_users'])->toBe(['903', '904'])->and($loaded['administration_users'])->toBe(['903']);
        config(['access' => $loaded, 'customer_access.users' => []]);
        Sanctum::actingAs(User::findOrFail(903));
        $this->postJson('/api/dashboard_overview')->assertOk();
        $this->postJson('/api/get_users')->assertOk();
        $this->postJson('/api/get_customers')->assertForbidden();
    } finally {
        foreach ($original as $key => $value) {
            if ($value === null) {
                $repository->clear($key);
            } else {
                $repository->set($key, $value);
            }
        }
    }
});

it('does not provision default privileged accounts or business records during deployment seeding', function () {
    // This test exercises the current reference pipeline on an existing legacy installation.
    (require database_path('migrations/2026_11_13_210000_create_authorization_tables.php'))->up();
    $before = ['users' => DB::table('users_tb')->count(), 'branches' => DB::table('branch_tb')->count()];
    $roles = DB::table('roles_tb')->whereIn('ID', [10, 11])->orderBy('ID')->get()->toJson();
    $password = DB::table('users_tb')->where('ID', 701)->value('password');
    app(DatabaseSeeder::class)->run();
    expect(DB::table('users_tb')->count())->toBe($before['users'])
        ->and(DB::table('roles_tb')->whereIn('ID', [10, 11])->orderBy('ID')->get()->toJson())->toBe($roles)
        ->and(DB::table('permission_tb')->count())->toBe(count(\App\Services\PermissionCatalog::definitions()))
        ->and(DB::table('customer_tb')->count())->toBe(0)
        ->and(DB::table('invoice_tb')->count())->toBe(0)
        ->and(DB::table('branch_tb')->count())->toBe($before['branches'])
        ->and(DB::table('users_tb')->where('ID', 701)->value('password'))->toBe($password)
        ->and(DB::table('users_tb')->where('username', 'admin')->exists())->toBeFalse();
});

it('rotates a password through hidden interactive prompts and revokes tokens without changing account links or privileges', function () {
    $account = User::findOrFail(701);
    $account->createToken('synthetic-rotation');
    $before = $account->only(['role_id', 'emp_id', 'status']);
    $this->artisan('intelliride:rotate-account-password', ['userId' => '701'])
        ->expectsConfirmation('Rotate password for account #701 and revoke all its access tokens?', 'yes')
        ->expectsQuestion('New password', 'Synthetic#Secure2026!')
        ->expectsQuestion('Confirm new password', 'Synthetic#Secure2026!')
        ->expectsOutput('Password rotated and existing access tokens revoked. Sign in again.')
        ->assertSuccessful();
    expect(Hash::check('Synthetic#Secure2026!', $account->fresh()->password))->toBeTrue()
        ->and($account->fresh()->only(['role_id', 'emp_id', 'status']))->toBe($before)
        ->and($account->tokens()->count())->toBe(0);
});

it('rejects weak or mismatched password rotation without changing credentials or tokens', function () {
    $account = User::findOrFail(701);
    $account->createToken('synthetic-rotation');
    $hash = $account->password;
    $this->artisan('intelliride:rotate-account-password', ['userId' => '701'])
        ->expectsConfirmation('Rotate password for account #701 and revoke all its access tokens?', 'yes')
        ->expectsQuestion('New password', 'weak')
        ->expectsQuestion('Confirm new password', 'different')
        ->expectsOutput('Password policy or confirmation failed. No account changes were made.')
        ->assertFailed();
    expect($account->fresh()->password)->toBe($hash)->and($account->tokens()->count())->toBe(1);
});

it('refuses noninteractive password rotation instead of accepting secrets in arguments or environment', function () {
    $hash = User::findOrFail(701)->password;
    $this->artisan('intelliride:rotate-account-password', ['userId' => '701', '--no-interaction' => true])
        ->expectsOutput('Interactive hidden password entry is required.')
        ->assertFailed();
    expect(User::findOrFail(701)->password)->toBe($hash);
});
