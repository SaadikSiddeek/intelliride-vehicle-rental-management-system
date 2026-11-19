<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') throw new RuntimeException('Disposable SQLite only.');
    Artisan::call('migrate', ['--force' => true]);
    Artisan::call('db:seed', ['--force' => true]);
    DB::table('users_tb')->insert(['ID' => 1, 'username' => 'branch-owner', 'email' => 'branch-owner@example.test', 'role_id' => DB::table('roles_tb')->value('ID'), 'branch_id' => 1, 'password' => Hash::make(bin2hex(random_bytes(16))), 'user_type' => 'super_admin', 'status' => true]);
    DB::table('authorization_state_tb')->where('ID', 1)->update(['enabled' => true]);
    Sanctum::actingAs(User::find(1));
});

function branchNamePayload(array $changes = []): array
{
    return array_replace(['upd_id' => 1, 'branch_name' => 'Synthetic branch', 'branch_code' => 'SYNTHETIC-NAME', 'address' => 'Training address', 'contact_number' => '0000000000', 'manager_name' => 'Example Manager', 'status' => true], $changes);
}

it('creates lists hydrates and edits a branch manager name without requiring Staff', function () {
    expect(DB::table('staff_tb')->count())->toBe(0);
    $id = $this->postJson('/api/save_branch', branchNamePayload())->assertOk()->assertJsonPath('data.manager_name', 'Example Manager')->json('data.ID');
    expect(DB::table('branch_tb')->where('ID', $id)->value('manager_id'))->toBeNull();
    $this->postJson('/api/fetch_branch_data', ['upd_id' => $id])->assertOk()->assertJsonPath('data.manager_name', 'Example Manager');
    $this->postJson('/api/get_branches')->assertOk()->assertJsonFragment(['manager_name' => 'Example Manager', 'manager' => 'Example Manager'])->assertJsonPath('managers', []);
    $this->postJson('/api/save_branch', branchNamePayload(['upd_id' => $id, 'manager_name' => 'Updated Manager']))->assertOk();
    expect(DB::table('branch_tb')->where('ID', $id)->value('manager_name'))->toBe('Updated Manager');
    $this->postJson('/api/save_branch', branchNamePayload(['upd_id' => $id, 'manager_name' => null]))->assertOk();
    expect(DB::table('branch_tb')->where('ID', $id)->value('manager_name'))->toBeNull();
});

it('validates optional names and duplicate codes without accepting malformed values', function () {
    $this->postJson('/api/save_branch', branchNamePayload(['manager_name' => str_repeat('x', 201)]))->assertUnprocessable()->assertJsonValidationErrors('manager_name');
    $this->postJson('/api/save_branch', branchNamePayload(['manager_name' => ['invalid']]))->assertUnprocessable()->assertJsonValidationErrors('manager_name');
    $this->postJson('/api/save_branch', branchNamePayload(['manager_name' => null]))->assertOk();
    $this->postJson('/api/save_branch', array_diff_key(branchNamePayload(), ['upd_id' => true]))->assertStatus(409);
});

it('backfills only missing manager names and retains historical Staff associations', function () {
    DB::table('staff_tb')->insert(['ID' => 3, 'branch_id' => 1, 'department_id' => DB::table('department_tb')->value('ID'), 'designation_id' => DB::table('designation_tb')->value('ID'), 'emp_code' => 'SYNTHETIC-MANAGER', 'first_name' => 'Legacy', 'last_name' => 'Manager', 'phone' => '0000000000', 'status' => true]);
    DB::table('branch_tb')->where('ID', 1)->update(['manager_id' => 3]);
    $custom = DB::table('branch_tb')->insertGetId(['branch_name' => 'Custom name', 'branch_code' => 'CUSTOM', 'manager_id' => 3, 'manager_name' => 'Owner entered name'], 'ID');
    (require database_path('migrations/2026_11_14_140000_add_manager_name_to_branch.php'))->up();
    expect(DB::table('branch_tb')->where('ID', 1)->value('manager_name'))->toBe('Legacy Manager')
        ->and(DB::table('branch_tb')->where('ID', $custom)->value('manager_name'))->toBe('Owner entered name');
    $this->postJson('/api/save_branch', branchNamePayload(['upd_id' => 1, 'branch_code' => 'SETUP', 'manager_name' => 'New typed name']))->assertOk();
    expect((int) DB::table('branch_tb')->where('ID', 1)->value('manager_id'))->toBe(3)
        ->and(DB::table('branch_tb')->where('ID', 1)->value('manager_name'))->toBe('New typed name');
});

it('enforces Branch action permissions independently of its manager display value', function () {
    DB::table('users_tb')->insert(['ID' => 2, 'username' => 'branch-reader', 'email' => 'branch-reader@example.test', 'role_id' => DB::table('roles_tb')->value('ID'), 'password' => Hash::make(bin2hex(random_bytes(16))), 'user_type' => 'user', 'status' => true]);
    DB::table('user_permission_tb')->insert(['user_id' => 2, 'permission_code' => 'branches.view', 'effect' => 'allow']);
    Sanctum::actingAs(User::find(2));
    $this->postJson('/api/get_branches')->assertOk();
    $this->postJson('/api/save_branch', branchNamePayload())->assertForbidden();
    $this->postJson('/api/delete_branch', ['upd_id' => 1])->assertForbidden();
});
