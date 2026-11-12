<?php

use App\Models\User;
use App\Services\BookingService;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') {
        throw new RuntimeException('Booking tests require SQLite :memory:.');
    }
    foreach (glob(database_path('migrations/2026_09_13_*.php')) as $file) (require $file)->up();
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
});

function bookingPayload(array $changes = []): array
{
    return array_replace(['customer_id' => 1, 'vehicle_id' => 1, 'package_id' => 1,
        'pickup_at' => '2026-12-01T10:00', 'expected_return_at' => '2026-12-02T10:00',
        'pickup_branch_id' => 1, 'return_branch_id' => 1, 'status' => 'Draft', 'discount' => '0.00', 'advance_amount' => '0.00', 'extras' => [],
    ], $changes);
}

test('booking pricing rounds duration up and persists immutable confirmed snapshots', function () {
    $payload = bookingPayload(['status' => 'Confirmed', 'expected_return_at' => '2026-12-02T10:01', 'total' => '1']);
    $this->postJson('/api/quote_booking', $payload)->assertOk()->assertJsonPath('data.units', 2)->assertJsonPath('data.total', '16001.00')->assertJsonPath('data.included_km', 200);
    $id = $this->postJson('/api/save_booking', $payload)->assertCreated()->json('data.ID');
    DB::table('rental_package_tb')->where('ID', 1)->update(['rate_per_unit' => '9999.00']);
    $this->postJson('/api/fetch_booking_data', ['upd_id' => $id])->assertOk()->assertJsonPath('data.pricing_snapshot.agreed_rate', '8000.50');
    $this->postJson('/api/save_booking', bookingPayload(['upd_id' => $id]))->assertUnprocessable()->assertJsonValidationErrors('status');
    $this->postJson('/api/get_bookings', ['status' => 'Confirmed'])->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.booking_code', 'BKG-000001');
});

test('overlapping confirmations are rejected while adjacency and drafts are allowed', function () {
    $this->postJson('/api/save_booking', bookingPayload(['status' => 'Confirmed']))->assertCreated();
    $this->postJson('/api/save_booking', bookingPayload(['status' => 'Confirmed', 'pickup_at' => '2026-12-01T12:00']))->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');
    $this->postJson('/api/save_booking', bookingPayload())->assertCreated();
    $this->postJson('/api/save_booking', bookingPayload(['status' => 'Confirmed', 'pickup_at' => '2026-12-02T10:00', 'expected_return_at' => '2026-12-03T10:00']))->assertCreated();
    expect(DB::table('booking_tb')->where('status', 'Confirmed')->count())->toBe(2);
});

test('maintenance active rentals and unavailable fleet statuses block availability', function () {
    DB::table('vehicle_unavailability_tb')->insert(['vehicle_id' => 1, 'kind' => 'Maintenance', 'status' => 'Scheduled', 'starts_at' => '2026-12-01 09:00:00', 'ends_at' => '2026-12-01 11:00:00']);
    $this->postJson('/api/booking_vehicle_filter', bookingPayload())->assertOk()->assertJsonCount(0, 'data');
    $this->postJson('/api/save_booking', bookingPayload(['status' => 'Confirmed']))->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');
    DB::table('vehicle_unavailability_tb')->update(['status' => 'Completed']);
    $this->postJson('/api/booking_vehicle_filter', bookingPayload())->assertOk()->assertJsonCount(1, 'data');
    DB::table('vehicle_unavailability_tb')->insert(['vehicle_id' => 1, 'kind' => 'Active Rental', 'status' => 'Active', 'starts_at' => '2026-11-30 09:00:00', 'ends_at' => null]);
    $this->postJson('/api/save_booking', bookingPayload(['status' => 'Confirmed']))->assertUnprocessable();
    DB::table('vehicle_unavailability_tb')->update(['status' => 'Completed']);
    DB::table('vehicle_tb')->update(['status' => 'Rented']);
    $this->postJson('/api/booking_vehicle_filter', bookingPayload())->assertOk()->assertJsonCount(0, 'data');
    $this->postJson('/api/save_booking', bookingPayload(['status' => 'Confirmed']))->assertUnprocessable();
});

test('discount and agreed pricing require permission and tax uses integer rounding', function () {
    $this->postJson('/api/quote_booking', bookingPayload(['discount' => '1.00']))->assertUnprocessable()->assertJsonValidationErrors('discount');
    $this->postJson('/api/quote_booking', bookingPayload(['agreed_rate' => '1.00']))->assertUnprocessable();
    config(['rental.pricing_user_ids' => ['701'], 'rental.tax_basis_points' => 1800, 'rental.extras' => ['seat' => ['label' => 'Child seat', 'amount' => '250.25']]]);
    $this->postJson('/api/quote_booking', bookingPayload(['agreed_rate' => '1000.01', 'discount' => '100.00', 'extras' => ['seat']]))->assertOk()
        ->assertJsonPath('data.subtotal', '1250.26')->assertJsonPath('data.tax', '207.05')->assertJsonPath('data.total', '1357.31')->assertJsonPath('data.pricing_authorized_by', 701);
    $this->postJson('/api/quote_booking', bookingPayload(['discount' => '999999.00']))->assertUnprocessable();
});

test('advance recording is atomic and tracks payment status without mixing deposit', function () {
    $payload = bookingPayload(['advance_amount' => '2000.00', 'payment_method' => 'bank_transfer', 'payment_date' => '2026-11-11', 'payment_reference' => 'TEST-REF']);
    $id = $this->postJson('/api/save_booking', $payload)->assertCreated()->json('data.ID');
    $this->postJson('/api/fetch_booking_data', ['upd_id' => $id])->assertOk()->assertJsonPath('data.payment_status', 'Partially Paid')->assertJsonCount(1, 'data.payments');
    expect(DB::table('booking_payment_tb')->count())->toBe(1);
    $this->postJson('/api/save_booking', [...$payload, 'upd_id' => $id])->assertUnprocessable();
    $this->postJson('/api/save_booking', bookingPayload(['upd_id' => $id, 'status' => 'Confirmed']))->assertOk();
    expect(DB::table('booking_payment_tb')->count())->toBe(1);
    $this->postJson('/api/booking_status', ['upd_id' => $id, 'status' => 'Cancelled'])->assertOk();
    expect(DB::table('booking_payment_tb')->count())->toBe(1);
});

test('invalid advances and payment references roll back booking creation', function () {
    foreach ([['advance_amount' => '99999.00'], ['advance_amount' => '10.00'], ['advance_amount' => '10.00', 'payment_method' => 'card', 'payment_date' => '2026-11-11'], ['advance_amount' => '10.00', 'payment_method' => 'cash', 'payment_date' => '2030-01-01']] as $changes) {
        $this->postJson('/api/save_booking', bookingPayload($changes))->assertUnprocessable();
    }
    expect(DB::table('booking_tb')->count())->toBe(0);
    expect(DB::table('booking_payment_tb')->count())->toBe(0);
    $this->postJson('/api/save_booking', bookingPayload(['advance_amount' => '8000.50', 'payment_method' => 'cash', 'payment_date' => '2026-11-11']))->assertCreated();
    expect(DB::table('booking_tb')->value('payment_status'))->toBe('Paid');
});

test('dates same branch active customers and package linkage are enforced', function () {
    $this->postJson('/api/save_booking', bookingPayload(['expected_return_at' => '2026-11-01T10:00', 'return_branch_id' => 2]))->assertUnprocessable()->assertJsonValidationErrors(['expected_return_at', 'return_branch_id']);
    $this->postJson('/api/save_booking', bookingPayload(['status' => 'Confirmed', 'pickup_at' => '2026-11-01T10:00']))->assertUnprocessable()->assertJsonValidationErrors('pickup_at');
    DB::table('customer_tb')->update(['status' => 'Blocked']);
    $this->postJson('/api/save_booking', bookingPayload())->assertUnprocessable()->assertJsonValidationErrors('customer_id');
    DB::table('customer_tb')->update(['status' => 'Active']);
    DB::table('rental_package_tb')->update(['status' => 0]);
    $this->postJson('/api/save_booking', bookingPayload())->assertUnprocessable()->assertJsonValidationErrors('package_id');
});

test('no show and cancellation transitions cannot bypass the workflow', function () {
    $id = $this->postJson('/api/save_booking', bookingPayload(['status' => 'Confirmed']))->assertCreated()->json('data.ID');
    $this->postJson('/api/booking_status', ['upd_id' => $id, 'status' => 'No-show'])->assertUnprocessable();
    $this->travelTo(now()->setDate(2026, 12, 3));
    $this->postJson('/api/booking_status', ['upd_id' => $id, 'status' => 'No-show'])->assertOk();
    $this->postJson('/api/booking_status', ['upd_id' => $id, 'status' => 'Cancelled'])->assertUnprocessable();
    $this->postJson('/api/save_booking', bookingPayload(['status' => 'Converted to Rental']))->assertUnprocessable();
});

test('booking endpoints preserve the existing customer allowlist', function () {
    config(['customer_access.users' => []]);
    foreach (['booking_options', 'booking_vehicle_filter', 'booking_package_filter', 'quote_booking', 'save_booking', 'get_bookings', 'fetch_booking_data', 'booking_status'] as $route) {
        $this->postJson('/api/'.$route, bookingPayload())->assertForbidden();
    }
});

test('unlimited mileage and minimum weekly units are snapshotted correctly', function () {
    DB::table('rental_package_tb')->update(['billing_unit' => 'week', 'minimum_units' => 2, 'included_km_per_unit' => null, 'extra_km_charge' => 0]);
    $this->postJson('/api/quote_booking', bookingPayload())->assertOk()->assertJsonPath('data.units', 2)->assertJsonPath('data.included_km', null)->assertJsonPath('data.total', '16001.00');
    expect(BookingService::money(BookingService::cents('0.01')))->toBe('0.01');
});
