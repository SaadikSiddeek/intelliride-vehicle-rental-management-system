<?php

use App\Models\RentalPackage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') {
        throw new RuntimeException('Rental Package tests require SQLite :memory:.');
    }
    foreach (glob(database_path('migrations/2026_09_13_*.php')) as $file) {
        (require $file)->up();
    }
    (require database_path('migrations/2026_11_11_073037_create_rental_package_tb.php'))->up();
    DB::table('branch_tb')->insert(['ID' => 1, 'branch_code' => 'TEST', 'branch_name' => 'Test Branch']);
    DB::table('vehicle_category_tb')->insert(['ID' => 1, 'category_name' => 'Test Category']);
    DB::table('vehicle_brand_tb')->insert(['ID' => 1, 'brand_name' => 'Toyota']);
    DB::table('fuel_type_tb')->insert(['ID' => 1, 'fuel_type_name' => 'Petrol']);
    DB::table('transmission_type_tb')->insert(['ID' => 1, 'transmission_name' => 'Automatic']);
    DB::table('vehicle_model_tb')->insert(['ID' => 1, 'brand_id' => 1, 'fuel_type_id' => 1, 'transmission_type_id' => 1, 'model_name' => 'Test Model']);
    foreach ([1, 2] as $id) {
        DB::table('vehicle_tb')->insert(['ID' => $id, 'branch_id' => 1, 'category_id' => 1, 'brand_id' => 1, 'model_id' => 1, 'fuel_type_id' => 1, 'transmission_type_id' => 1, 'vehicle_number' => 'TEST-'.$id]);
    }
    Sanctum::actingAs((new User)->forceFill(['ID' => 701, 'status' => true]));
});

function packagePayload(array $changes = []): array
{
    return array_replace([
        'vehicle_id' => 1, 'package_name' => 'Test Daily', 'billing_unit' => 'day',
        'rate_per_unit' => '8000.50', 'included_km_per_unit' => 100, 'extra_km_charge' => '75.25',
        'security_deposit' => '20000.00', 'minimum_units' => 1, 'status' => 1,
    ], $changes);
}

test('package create edit deactivate and validated list filters', function () {
    $id = $this->postJson('/api/save_rental_package', packagePayload())->assertCreated()->json('data.ID');
    $this->postJson('/api/fetch_rental_package_data', ['upd_id' => $id])->assertOk()->assertJsonPath('data.minimum_units', 1);
    expect(RentalPackage::findOrFail($id)->rate_per_unit)->toBe('8000.50');
    expect(RentalPackage::findOrFail($id)->vehicle->vehicle_number)->toBe('TEST-1');
    $this->postJson('/api/get_rental_packages', ['status' => 1, 'billing_unit' => 'day', 'q' => 'TEST-1'])->assertOk()->assertJsonCount(1, 'data');
    $this->postJson('/api/save_rental_package', packagePayload(['upd_id' => $id, 'status' => 0, 'billing_unit' => 'week', 'minimum_units' => 2]))->assertOk();
    $this->postJson('/api/get_rental_packages', ['status' => 1])->assertOk()->assertJsonCount(0, 'data');
    $this->postJson('/api/get_rental_packages', ['status' => 0, 'billing_unit' => 'week'])->assertOk()->assertJsonCount(1, 'data');
});

test('package names are unique per vehicle but editable and reusable on other vehicles', function () {
    $id = $this->postJson('/api/save_rental_package', packagePayload())->assertCreated()->json('data.ID');
    $this->postJson('/api/save_rental_package', packagePayload())->assertUnprocessable()->assertJsonValidationErrors('package_name');
    $this->postJson('/api/save_rental_package', packagePayload(['upd_id' => $id]))->assertOk();
    $this->postJson('/api/save_rental_package', packagePayload(['vehicle_id' => 2]))->assertCreated();
    expect(RentalPackage::count())->toBe(2);
});

test('package money units mileage and vehicle linkage are validated', function () {
    $this->postJson('/api/save_rental_package', packagePayload([
        'vehicle_id' => 999, 'rate_per_unit' => '-1.005', 'billing_unit' => 'hour',
        'included_km_per_unit' => -1, 'extra_km_charge' => '1e4', 'security_deposit' => '-5', 'minimum_units' => '1.5',
    ]))->assertUnprocessable()->assertJsonValidationErrors([
        'vehicle_id', 'rate_per_unit', 'billing_unit', 'included_km_per_unit', 'extra_km_charge', 'security_deposit', 'minimum_units',
    ]);
    $this->postJson('/api/save_rental_package', packagePayload(['rate_per_unit' => '0']))->assertUnprocessable()->assertJsonValidationErrors('rate_per_unit');
    expect(RentalPackage::count())->toBe(0);
});

test('unlimited mileage normalizes excess charge while zero allowance is retained', function () {
    $id = $this->postJson('/api/save_rental_package', packagePayload(['included_km_per_unit' => null]))->assertCreated()->json('data.ID');
    $package = RentalPackage::findOrFail($id);
    expect($package->included_km_per_unit)->toBeNull();
    expect($package->extra_km_charge)->toBe('0.00');
    $this->postJson('/api/save_rental_package', packagePayload(['upd_id' => $id, 'included_km_per_unit' => 0]))->assertOk();
    expect(RentalPackage::findOrFail($id)->included_km_per_unit)->toBe(0);
});

test('package vehicle Select2 resolves identifiers and searches brand and registration', function () {
    $this->postJson('/api/rental_package_vehicles', ['q' => 'Toyota'])->assertOk()->assertJsonPath('success', true)->assertJsonCount(2, 'data');
    $this->postJson('/api/rental_package_vehicles', ['q' => 'TEST-2'])->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', 2);
    $this->postJson('/api/rental_package_vehicles', ['id' => 1])->assertOk()->assertJsonPath('data.0.text', 'TEST-1 — Toyota Test Model');
    $this->postJson('/api/rental_package_vehicles', ['id' => -1])->assertUnprocessable();
    $this->postJson('/api/get_rental_packages', ['billing_unit' => 'hour'])->assertUnprocessable();
    $this->postJson('/api/fetch_rental_package_data', ['upd_id' => 999])->assertNotFound();
});
