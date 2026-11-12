<?php

use App\Models\Rental;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') {
        throw new RuntimeException('Booking tests require SQLite :memory:.');
    }
    foreach (glob(database_path('migrations/2026_09_13_*.php')) as $file) {
        (require $file)->up();
    }
    foreach (['2026_11_11_071730_create_customer_tables.php', '2026_11_11_073037_create_rental_package_tb.php', '2026_11_11_160000_create_booking_tables.php'] as $file) {
        (require database_path('migrations/'.$file))->up();
    }
    DB::table('branch_tb')->insert(['ID' => 1, 'branch_name' => 'Test', 'branch_code' => 'TEST']);
    DB::table('vehicle_category_tb')->insert(['ID' => 1, 'category_name' => 'Test']);
    DB::table('vehicle_brand_tb')->insert(['ID' => 1, 'brand_name' => 'Test']);
    DB::table('fuel_type_tb')->insert(['ID' => 1, 'fuel_type_name' => 'Petrol']);
    DB::table('transmission_type_tb')->insert(['ID' => 1, 'transmission_name' => 'Automatic']);
    DB::table('vehicle_model_tb')->insert(['ID' => 1, 'brand_id' => 1, 'fuel_type_id' => 1, 'transmission_type_id' => 1, 'model_name' => 'Test']);
    DB::table('vehicle_tb')->insert(['ID' => 1, 'vehicle_number' => 'TEST-1', 'branch_id' => 1, 'category_id' => 1, 'brand_id' => 1, 'model_id' => 1, 'fuel_type_id' => 1, 'transmission_type_id' => 1]);
    DB::table('customer_tb')->insert(['ID' => 1, 'customer_type' => 'Local', 'full_name' => 'Test Customer', 'mobile' => '0770000000', 'status' => 'Active']);
    DB::table('rental_package_tb')->insert(['ID' => 1, 'vehicle_id' => 1, 'package_name' => 'Daily', 'billing_unit' => 'day', 'rate_per_unit' => '8000.50', 'included_km_per_unit' => 100, 'extra_km_charge' => '75.25', 'security_deposit' => '20000.00', 'minimum_units' => 1, 'status' => 1]);
    config(['customer_access.users' => ['701'], 'rental.tax_basis_points' => 0, 'rental.pricing_user_ids' => [], 'rental.extras' => []]);
    Sanctum::actingAs((new User)->forceFill(['ID' => 701, 'status' => true]));
    $this->travelTo(now()->setDate(2026, 11, 11));
    (require database_path('migrations/2026_11_11_170000_create_rental_handover_tables.php'))->up();
    Storage::fake('rental_documents');
    DB::table('roles_tb')->insert(['ID' => 1, 'role_name' => 'Test', 'branch_id' => 1]);
    DB::table('users_tb')->insert(['ID' => 701, 'role_id' => 1, 'username' => 'test-admin', 'email' => 'test@example.test', 'password' => 'not-used', 'emp_id' => '3', 'status' => 1]);
    DB::table('department_tb')->insert(['ID' => 1, 'department_name' => 'Test', 'branch_id' => 1]);
    DB::table('designation_tb')->insert(['ID' => 1, 'designation_name' => 'Test', 'branch_id' => 1]);
    DB::table('staff_tb')->insert(['ID' => 3, 'user_id' => 701, 'branch_id' => 1, 'designation_id' => 1, 'department_id' => 1, 'emp_code' => 'TEST-STAFF', 'first_name' => 'Test', 'last_name' => 'Employee', 'phone' => '0770000000']);
    DB::table('vehicle_tb')->update(['mileage' => 1000]);
    config(['rental.return_policy' => ['version' => 1, 'grace_minutes' => 60, 'daily_hourly_basis_points' => 1000, 'weekly_monthly_hourly_rate' => null, 'weekly_monthly_24h_cap' => null, 'fuel_price_per_litre' => null, 'fuel_service_charge' => '0.00']]);
    Sanctum::actingAs(User::findOrFail(701));
    $this->postJson('/api/save_booking', ['customer_id' => 1, 'vehicle_id' => 1, 'package_id' => 1, 'pickup_branch_id' => 1, 'return_branch_id' => 1, 'pickup_at' => '2026-12-01T10:00', 'expected_return_at' => '2026-12-02T10:00', 'status' => 'Confirmed'])->assertCreated();
    $this->travelTo(now()->setDate(2026, 12, 1)->setTime(6, 0));
    (require database_path('migrations/2026_11_11_180000_create_returns_finance_tables.php'))->up();
    $this->postJson('/api/save_handover', returnHandoverPayload())->assertCreated();
    $this->travelTo(CarbonImmutable::parse('2026-12-02 12:00', 'Asia/Colombo'));
});

function returnHandoverPayload(array $changes = []): array
{
    return array_replace(['booking_id' => 1, 'actual_pickup_at' => '2026-12-01T10:00', 'starting_odometer' => 1200,
        'pickup_fuel_litres' => '35.500', 'driver_name' => 'Synthetic Driver', 'driver_document_number' => 'TEST-NIC',
        'driver_licence_number' => 'TEST-LICENCE', 'driver_licence_expiry' => '2027-12-31',
        'identity_verified' => true, 'licence_verified' => true, 'agreement_accepted' => true, 'agreement_reference' => 'TEST-AGR-1',
        'condition_notes' => 'Inspected; existing scratch recorded.', 'existing_damage' => 'Existing rear scratch.',
        'deposit_received' => '20000.00', 'deposit_method' => 'cash'], $changes);
}

function returnPayload(array $changes = []): array
{
    return array_replace(['rental_id' => 1, 'actual_return_at' => '2026-12-02T10:00', 'ending_odometer' => 1350, 'return_fuel_litres' => '35.500', 'condition_notes' => 'Return inspected.', 'damage_estimate' => '0.00', 'damage_charge' => '0.00', 'vehicle_after_return' => 'Inspection Required', 'apply_deposit' => true, 'status' => 'Pending Review'], $changes);
}
function saveAndQuoteReturn($test, array $changes = []): array
{
    $id = $test->postJson('/api/save_return_assessment', returnPayload($changes))->assertOk()->json('data.ID');

    return $test->postJson('/api/fetch_return_data', ['upd_id' => $id])->assertOk()->json('data');
}
function finalizationPayload(array $row, array $changes = []): array
{
    return array_replace(['upd_id' => $row['ID'], 'revision' => $row['revision'], 'review_hash' => $row['calculation']['review_hash'], 'review_approved' => true, 'review_notes' => 'Reviewed all calculations and evidence.', 'deposit_deduction_approved' => true], $changes);
}

test('return grace is inclusive then charges started hours from scheduled return', function () {
    $row = saveAndQuoteReturn($this, ['actual_return_at' => '2026-12-02T11:00']);
    expect($row['calculation']['late_charge'])->toBe('0.00');
    $row = saveAndQuoteReturn($this, ['revision' => 1, 'actual_return_at' => '2026-12-02T11:01']);
    expect($row['calculation']['chargeable_late_hours'])->toBe(2)->and($row['calculation']['late_charge'])->toBe('1600.10');
});
test('late charges are capped per additional 24 hour period', function () {
    $this->travelTo(CarbonImmutable::parse('2026-12-04 12:00', 'Asia/Colombo'));
    $row = saveAndQuoteReturn($this, ['actual_return_at' => '2026-12-03T11:00']);
    expect($row['calculation']['late_charge'])->toBe('8800.55');
});
test('missing fuel or weekly late rates block finalization without releasing vehicle', function () {
    $rental = Rental::findOrFail(1);
    $p = $rental->pricing_snapshot;
    $p['billing_unit'] = 'week';
    $rental->update(['pricing_snapshot' => $p]);
    $row = saveAndQuoteReturn($this, ['actual_return_at' => '2026-12-02T11:01', 'return_fuel_litres' => '30.500']);
    expect($row['calculation']['blockers'])->toHaveCount(2);
    $this->postJson('/api/finalize_return', finalizationPayload($row))->assertUnprocessable()->assertJsonValidationErrors('policy');
    expect(DB::table('vehicle_unavailability_tb')->value('status'))->toBe('Active')->and(DB::table('invoice_tb')->count())->toBe(0);
});
test('fuel uses recorded litres and explicit configured price with integer rounding', function () {
    config(['rental.return_policy.fuel_price_per_litre' => '300.25']);
    $row = saveAndQuoteReturn($this, ['return_fuel_litres' => '34.999']);
    expect($row['calculation']['missing_fuel_litres'])->toBe('0.501')->and($row['calculation']['fuel_charge'])->toBe('150.43');
});
test('excess distance uses historical allowance and approved settlement applies deposit once', function () {
    DB::table('rental_package_tb')->update(['extra_km_charge' => '999.00', 'included_km_per_unit' => 0]);
    DB::table('rental_deposit_tb')->update(['amount' => '1000.00']);
    $row = saveAndQuoteReturn($this);
    expect($row['calculation']['extra_km'])->toBe(50)->and($row['calculation']['extra_km_charge'])->toBe('3762.50');
    $this->postJson('/api/finalize_return', finalizationPayload($row))->assertOk();
    expect(DB::table('rental_tb')->value('status'))->toBe('Completed')->and(DB::table('vehicle_tb')->value('status'))->toBe('Inspection Required');
    expect(DB::table('rental_deposit_tb')->where('entry_type', 'Applied')->value('amount'))->toBe(1000);
    expect(DB::table('invoice_tb')->value('total'))->toBe(11763);
    expect(DB::table('vehicle_unavailability_tb')->value('status'))->toBe('Completed');
    $this->postJson('/api/finalize_return', finalizationPayload($row))->assertUnprocessable();
    expect(DB::table('invoice_tb')->count())->toBe(1)->and(DB::table('rental_deposit_tb')->where('entry_type', 'Applied')->count())->toBe(1);
});
test('damage needs reason and explicit approval while estimates alone do not charge', function () {
    $row = saveAndQuoteReturn($this, ['damage_estimate' => '1000.00']);
    expect($row['calculation']['damage_charge'])->toBe('0.00');
    $row = saveAndQuoteReturn($this, ['revision' => 1, 'damage_estimate' => '1000.00', 'damage_charge' => '500.00', 'new_damage' => 'New door dent', 'damage_reason' => 'Repair estimate reviewed']);
    $this->postJson('/api/finalize_return', finalizationPayload($row))->assertUnprocessable()->assertJsonValidationErrors('damage_approved');
    $this->postJson('/api/finalize_return', finalizationPayload($row, ['damage_approved' => true]))->assertOk();
    expect(DB::table('rental_return_audit_tb')->where('action', 'Finalized')->count())->toBe(1);
});
test('original booking advances are credited once and never duplicated as receipts', function () {
    DB::table('booking_payment_tb')->insert(['booking_id' => 1, 'amount' => '500.00', 'method' => 'cash', 'paid_on' => '2026-12-01', 'recorded_by' => 701]);
    $row = saveAndQuoteReturn($this, ['ending_odometer' => 1250]);
    expect($row['calculation']['deposit_to_apply'])->toBe('7500.50')->and($row['calculation']['refundable_deposit'])->toBe('12499.50');
    $this->postJson('/api/finalize_return', finalizationPayload($row))->assertOk();
    expect(DB::table('booking_payment_tb')->count())->toBe(1)->and(DB::table('invoice_payment_tb')->count())->toBe(0);
});
test('review approvals stale revisions and odometer validation prevent finalization', function () {
    $this->postJson('/api/save_return_assessment', returnPayload(['ending_odometer' => 1199]))->assertUnprocessable();
    $row = saveAndQuoteReturn($this);
    $this->postJson('/api/finalize_return', finalizationPayload($row, ['review_approved' => false]))->assertUnprocessable();
    $this->postJson('/api/save_return_assessment', returnPayload(['revision' => 1, 'condition_notes' => 'Updated inspection']))->assertOk();
    $this->postJson('/api/finalize_return', finalizationPayload($row))->assertUnprocessable();
    expect(DB::table('invoice_tb')->count())->toBe(0);
});
test('vehicle release requires approval and completed rentals stop holding original booking period', function () {
    $row = saveAndQuoteReturn($this, ['actual_return_at' => '2026-12-01T11:00', 'ending_odometer' => 1250, 'vehicle_after_return' => 'Available']);
    $this->postJson('/api/finalize_return', finalizationPayload($row))->assertUnprocessable()->assertJsonValidationErrors('vehicle_release_approved');
    $this->postJson('/api/finalize_return', finalizationPayload($row, ['vehicle_release_approved' => true]))->assertOk();
    $this->postJson('/api/booking_vehicle_filter', ['pickup_branch_id' => 1, 'pickup_at' => '2026-12-01T12:00', 'expected_return_at' => '2026-12-01T15:00'])->assertOk()->assertJsonCount(1, 'data');
});

test('legacy operational maintenance restriction survives return finalization', function () {
    DB::table('vehicle_tb')->where('ID', 1)->update(['status' => 'Under Maintenance']);
    $row = saveAndQuoteReturn($this,['ending_odometer' => 1250]);
    $this->postJson('/api/finalize_return',finalizationPayload($row))->assertOk();
    expect(DB::table('vehicle_tb')->value('status'))->toBe('Under Maintenance');
});
