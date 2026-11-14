<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') throw new RuntimeException('Disposable SQLite only.');
    Artisan::call('migrate', ['--force' => true]);
    Artisan::call('db:seed', ['--force' => true]);
    $this->roundTripSecrets = [];
    foreach ([1 => 'super_admin', 2 => 'admin', 3 => 'user'] as $id => $type) {
        $this->roundTripSecrets[$id] = bin2hex(random_bytes(16));
        DB::table('users_tb')->insert(['ID' => $id, 'username' => 'roundtrip-'.$id, 'email' => 'roundtrip-'.$id.'@example.test', 'role_id' => DB::table('roles_tb')->value('ID'), 'branch_id' => 1, 'password' => Hash::make($this->roundTripSecrets[$id]), 'status' => true, 'user_type' => $type, 'managed_by_user_id' => $id === 1 ? null : 1]);
    }
    DB::table('authorization_state_tb')->where('ID', 1)->update(['enabled' => true]);
});

function loginRoundTrip($test, int $id): array
{
    app('auth')->forgetGuards();
    app('auth')->shouldUse('web'); // A real new HTTP login starts with the configured session guard.
    $response = $test->postJson('/api/login', ['email' => 'roundtrip-'.$id.'@example.test', 'password' => $test->roundTripSecrets[$id]])->assertOk();
    $token = $response->json('token');
    Auth::guard('web')->logout();
    app('auth')->forgetGuards();
    $test->withToken($token);
    return $response->json('user');
}

it('persists assignments to the correct account and resolves them on login and current-user reload', function (array $codes, string $module) {
    sort($codes); // Permission order carries no authority.
    loginRoundTrip($this, 1);
    $body = ['kind' => 'user', 'id' => 3, 'reason' => 'Isolated permission round trip', 'allow' => $codes, 'deny' => [], 'access' => [], 'delegable' => []];
    $this->postJson('/api/save_permissions', $body)->assertOk();
    $this->postJson('/api/permission_target', ['kind' => 'user', 'id' => 3])->assertOk()->assertJsonPath('data.allow', $codes)->assertJsonPath('data.effective', $codes);
    expect(DB::table('user_permission_tb')->where('user_id', 3)->pluck('permission_code')->sort()->values()->all())->toBe(collect($codes)->sort()->values()->all())
        ->and(DB::table('user_permission_tb')->where('user_id', '!=', 3)->count())->toBe(0);
    $user = loginRoundTrip($this, 3);
    expect($user['effective_permissions'])->toBe($codes);
    $this->getJson('/api/user')->assertOk()->assertJsonPath('effective_permissions', $codes);
    $this->postJson('/api/save_permissions', $body)->assertForbidden();
    if ($module === 'dashboard') {
        $this->postJson('/api/dashboard_overview')->assertOk()->assertJsonPath('data.visibility.finance', false)->assertJsonPath('data.visibility.operations', false);
        $this->postJson('/api/get_customers')->assertForbidden();
    } elseif ($module === 'customers') {
        $this->postJson('/api/get_customers')->assertOk();
        $id = $this->postJson('/api/save_customer', ['customer_type' => 'Local', 'full_name' => 'Synthetic Roundtrip', 'mobile' => '0770000022', 'status' => 'Active'])->assertCreated()->json('data.ID');
        $this->postJson('/api/save_customer', ['upd_id' => $id, 'full_name' => 'Forbidden edit'])->assertForbidden();
        $this->postJson('/api/dashboard_overview')->assertForbidden();
    } elseif ($module === 'bookings') {
        $this->postJson('/api/get_bookings')->assertOk();
        $this->postJson('/api/save_booking')->assertForbidden();
        foreach (['Confirmed', 'Cancelled'] as $status) $this->postJson('/api/booking_status', ['status' => $status, 'id' => 1])->assertForbidden();
    } else {
        $this->postJson('/api/dashboard_overview')->assertForbidden();
        $this->postJson('/api/get_bookings')->assertForbidden();
    }
    // Revocation affects this already-issued token, not just a newly minted token.
    DB::table('user_permission_tb')->where('user_id', 3)->delete();
    $this->getJson('/api/user')->assertOk()->assertJsonPath('effective_permissions', []);
})->with([
    'Normal A dashboard only' => [['dashboard.view'], 'dashboard'],
    'Normal B customer view and create' => [['customers.view', 'customers.create'], 'customers'],
    'Normal C bookings view only' => [['bookings.view'], 'bookings'],
    'Normal D no permissions' => [[], 'none'],
]);


it('reports saved Admin grants blocked by an empty ceiling and activates only explicitly approved scope', function () {
    loginRoundTrip($this, 1);
    $body = ['kind' => 'user', 'id' => 2, 'reason' => 'Reproduce empty production Admin ceiling safely', 'allow' => ['customers.view'], 'deny' => [], 'access' => [], 'delegable' => []];
    $this->postJson('/api/save_permissions', $body)->assertOk()->assertJsonPath('data.effective', [])->assertJsonCount(1, 'data.warnings');
    $this->postJson('/api/permission_target', ['kind' => 'user', 'id' => 2])->assertOk()->assertJsonPath('data.allow', ['customers.view'])->assertJsonPath('data.effective', [])->assertJsonCount(1, 'data.warnings');
    $this->postJson('/api/authorization_setup')->assertOk()->assertJsonPath('data.4.complete', false);
    expect(DB::table('admin_permission_scope_tb')->where('user_id', 2)->count())->toBe(0);
    $admin = loginRoundTrip($this, 2);
    expect($admin['effective_permissions'])->toBe([]);
    $this->postJson('/api/get_customers')->assertForbidden();
    loginRoundTrip($this, 1);
    $body['access'] = ['customers.view'];
    $this->postJson('/api/save_permissions', $body)->assertOk()->assertJsonPath('data.effective', ['customers.view'])->assertJsonPath('data.warnings', []);
    $this->postJson('/api/authorization_setup')->assertOk()->assertJsonPath('data.4.complete', true);
    expect((bool) DB::table('admin_permission_scope_tb')->where('user_id', 2)->value('delegable'))->toBeFalse();
    loginRoundTrip($this, 2);
    $this->postJson('/api/get_customers')->assertOk();
    $this->postJson('/api/save_customer')->assertForbidden();
    $this->postJson('/api/save_permissions', $body)->assertForbidden();
});
