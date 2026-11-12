<?php

use App\Models\Rental;
use App\Models\User;
use App\Services\ReportService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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
    (require database_path('migrations/2026_11_11_190000_create_fleet_operations_tables.php'))->up();
    $this->postJson('/api/save_handover', reportHandoverPayload())->assertCreated();
    $this->travelTo(CarbonImmutable::parse('2026-12-02 12:00', 'Asia/Colombo'));
    $id = $this->postJson('/api/save_return_assessment', ['rental_id' => 1, 'actual_return_at' => '2026-12-02T10:00', 'ending_odometer' => 1250, 'return_fuel_litres' => '35.500', 'condition_notes' => 'Inspected', 'damage_estimate' => '0.00', 'damage_charge' => '0.00', 'vehicle_after_return' => 'Inspection Required', 'apply_deposit' => false, 'status' => 'Pending Review'])->assertOk()->json('data.ID');
    $row = $this->postJson('/api/fetch_return_data', ['upd_id' => $id])->assertOk()->json('data');
    $this->postJson('/api/finalize_return', ['upd_id' => $id, 'revision' => $row['revision'], 'review_hash' => $row['calculation']['review_hash'], 'review_approved' => true, 'review_notes' => 'Synthetic finance fixture.'])->assertOk();
});

function reportHandoverPayload(array $changes = []): array
{
    return array_replace(['booking_id' => 1, 'actual_pickup_at' => '2026-12-01T10:00', 'starting_odometer' => 1200,
        'pickup_fuel_litres' => '35.500', 'driver_name' => 'Synthetic Driver', 'driver_document_number' => 'TEST-NIC',
        'driver_licence_number' => 'TEST-LICENCE', 'driver_licence_expiry' => '2027-12-31',
        'identity_verified' => true, 'licence_verified' => true, 'agreement_accepted' => true, 'agreement_reference' => 'TEST-AGR-1',
        'condition_notes' => 'Inspected; existing scratch recorded.', 'existing_damage' => 'Existing rear scratch.',
        'deposit_received' => '20000.00', 'deposit_method' => 'cash'], $changes);
}

function reportPayload(array $changes = []): array
{
    return array_replace(['type' => 'rental_history', 'from' => '2026-12-01', 'to' => '2026-12-02'], $changes);
}
test('all report types use real data and stable headings including empty reports', function () {
    foreach (array_keys(ReportService::TYPES) as $type) {
        $this->postJson('/api/get_report', reportPayload(['type' => $type, 'customer_id' => $type === 'customer_history' ? 1 : null]))->assertOk()->assertJsonPath('status', true)->assertJsonStructure(['columns', 'data', 'meta' => ['total', 'filters']]);
    }
});
test('financial report separates recognized invoices cash collections and deposit liability', function () {
    $this->postJson('/api/save_invoice_payment', ['invoice_id' => 1, 'request_id' => (string) Str::uuid(), 'amount' => '1000.00', 'method' => 'cash', 'paid_on' => '2026-12-02', 'approved' => true])->assertOk();
    $this->postJson('/api/get_report', reportPayload(['type' => 'financial']))->assertOk()->assertJsonPath('totals.Recognized Revenue', 8000.5)->assertJsonPath('totals.Rental Cash Received', 1000)->assertJsonPath('totals.Deposit Received', 20000);
    $this->postJson('/api/get_report', reportPayload(['type' => 'outstanding_invoices']))->assertOk()->assertJsonPath('totals.Balance', 7000.5);
});
test('identity permissions apply equally to report data and all export formats', function () {
    config(['rental.identity_report_user_ids' => []]);
    $this->postJson('/api/get_report', reportPayload(['include_identity' => true]))->assertForbidden();
    foreach (['csv', 'xlsx', 'pdf', 'html'] as $format) {
        $this->postJson('/api/export_report', reportPayload(['include_identity' => true, 'format' => $format]))->assertForbidden();
    }
    config(['rental.identity_report_user_ids' => ['701']]);
    $this->postJson('/api/get_report', reportPayload(['include_identity' => true]))->assertOk()->assertJsonFragment(['NIC / Passport']);
});
test('csv and xlsx escape formula strings and preserve numeric cell types', function () {
    $r = Rental::findOrFail(1);
    $s = $r->rental_snapshot;
    $s['customer']['name'] = '=HYPERLINK("https://example.invalid")';
    $r->update(['rental_snapshot' => $s]);
    $csv = $this->postJson('/api/export_report', reportPayload(['format' => 'csv']))->assertOk();
    expect($csv->getContent())->toContain("'=HYPERLINK");
    $xlsx = $this->postJson('/api/export_report', reportPayload(['format' => 'xlsx']))->assertOk();
    $path = $xlsx->baseResponse->getFile()->getPathname();
    $zip = new ZipArchive;
    expect($zip->open($path))->toBeTrue();
    $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
    expect($sheet)->toContain('t="n"')->not->toContain('<f>');
    expect($zip->getFromName('xl/styles.xml'))->toContain('FF102A48');
    $zip->close();
});
test('report print and pdf exports use the same filtered rows', function () {
    $this->postJson('/api/export_report', reportPayload(['format' => 'html', 'vehicle_id' => 999]))->assertOk()->assertSee('No records match', false);
    $pdf = $this->postJson('/api/export_report', reportPayload(['format' => 'pdf']))->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(substr($pdf->getContent(), 0, 5))->toBe('%PDF-');
});
test('report pagination and validation retain applied server filters', function () {
    $row = (array) DB::table('booking_tb')->first();
    unset($row['ID']);
    $row['status'] = 'Draft';
    for ($i = 0; $i < 12; $i++) {
        DB::table('booking_tb')->insert($row);
    }
    $this->postJson('/api/get_report', reportPayload(['type' => 'booking_history', 'page' => 2, 'per_page' => 10]))->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('meta.total', 13);
    $this->postJson('/api/get_report', reportPayload(['type' => 'customer_history']))->assertUnprocessable()->assertJsonValidationErrors('customer_id');
    $this->postJson('/api/get_report', reportPayload(['from' => '2027-01-01', 'to' => '2026-01-01']))->assertUnprocessable();
    config(['customer_access.users' => []]);
    $this->postJson('/api/get_report', reportPayload())->assertForbidden();
});

test('report search and overdue filtering apply equally to displayed and exported authorized fields', function () {
    $this->postJson('/api/get_report', reportPayload(['q' => 'not-a-customer']))->assertOk()->assertJsonCount(0, 'data');
    $this->postJson('/api/export_report', reportPayload(['q' => 'not-a-customer', 'format' => 'csv']))->assertOk()->assertDontSee('Test Customer', false);
    $this->postJson('/api/get_report', reportPayload(['overdue_only' => true]))->assertOk()->assertJsonCount(0, 'data');
    DB::table('rental_tb')->where('ID', 1)->update(['status' => 'Active']);
    $this->postJson('/api/get_report', reportPayload(['overdue_only' => true]))->assertOk()->assertJsonCount(1, 'data');
});
