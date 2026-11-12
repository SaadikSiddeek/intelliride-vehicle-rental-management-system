<?php
use App\Models\Rental;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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
    (require database_path('migrations/2026_11_11_170000_create_rental_handover_tables.php'))->up();
    Storage::fake('rental_documents');
    DB::table('roles_tb')->insert(['ID'=>1,'role_name'=>'Test','branch_id'=>1]);
    DB::table('users_tb')->insert(['ID'=>701,'role_id'=>1,'username'=>'test-admin','email'=>'test@example.test','password'=>'not-used','emp_id'=>'3','status'=>1]);
    DB::table('department_tb')->insert(['ID'=>1,'department_name'=>'Test','branch_id'=>1]);
    DB::table('designation_tb')->insert(['ID'=>1,'designation_name'=>'Test','branch_id'=>1]);
    DB::table('staff_tb')->insert(['ID'=>3,'user_id'=>701,'branch_id'=>1,'designation_id'=>1,'department_id'=>1,'emp_code'=>'TEST-STAFF','first_name'=>'Test','last_name'=>'Employee','phone'=>'0770000000']);
    DB::table('vehicle_tb')->update(['mileage'=>1000]);
    config(['rental.return_policy'=>['version'=>1,'grace_minutes'=>60,'daily_hourly_basis_points'=>1000,'weekly_monthly_hourly_rate'=>null,'weekly_monthly_24h_cap'=>null,'fuel_price_per_litre'=>null,'fuel_service_charge'=>'0.00']]);
    Sanctum::actingAs(User::findOrFail(701));
    $this->postJson('/api/save_booking',['customer_id'=>1,'vehicle_id'=>1,'package_id'=>1,'pickup_branch_id'=>1,'return_branch_id'=>1,'pickup_at'=>'2026-12-01T10:00','expected_return_at'=>'2026-12-02T10:00','status'=>'Confirmed'])->assertCreated();
    $this->travelTo(now()->setDate(2026,12,1)->setTime(6,0));
    (require database_path('migrations/2026_11_11_180000_create_returns_finance_tables.php'))->up();
    $this->postJson('/api/save_handover',financeHandoverPayload())->assertCreated();
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-12-02 12:00','Asia/Colombo'));
    $id=$this->postJson('/api/save_return_assessment',['rental_id'=>1,'actual_return_at'=>'2026-12-02T10:00','ending_odometer'=>1250,'return_fuel_litres'=>'35.500','condition_notes'=>'Inspected','damage_estimate'=>'0.00','damage_charge'=>'0.00','vehicle_after_return'=>'Inspection Required','apply_deposit'=>false,'status'=>'Pending Review'])->assertOk()->json('data.ID');
    $row=$this->postJson('/api/fetch_return_data',['upd_id'=>$id])->assertOk()->json('data');
    $this->postJson('/api/finalize_return',['upd_id'=>$id,'revision'=>$row['revision'],'review_hash'=>$row['calculation']['review_hash'],'review_approved'=>true,'review_notes'=>'Synthetic finance fixture.'])->assertOk();
});


function financeHandoverPayload(array $changes=[]): array
{
    return array_replace(['booking_id'=>1,'actual_pickup_at'=>'2026-12-01T10:00','starting_odometer'=>1200,
        'pickup_fuel_litres'=>'35.500','driver_name'=>'Synthetic Driver','driver_document_number'=>'TEST-NIC',
        'driver_licence_number'=>'TEST-LICENCE','driver_licence_expiry'=>'2027-12-31',
        'identity_verified'=>true,'licence_verified'=>true,'agreement_accepted'=>true,'agreement_reference'=>'TEST-AGR-1',
        'condition_notes'=>'Inspected; existing scratch recorded.','existing_damage'=>'Existing rear scratch.',
        'deposit_received'=>'20000.00','deposit_method'=>'cash'], $changes);
}



function financePayment(array $changes=[]):array{return array_replace(['invoice_id'=>1,'request_id'=>(string)Str::uuid(),'amount'=>'1000.00','method'=>'cash','paid_on'=>'2026-12-02','approved'=>true],$changes);}
function financeRefund(array $changes=[]):array{return array_replace(['invoice_id'=>1,'request_id'=>(string)Str::uuid(),'amount'=>'100.00','method'=>'cash','reason'=>'Reviewed remaining refundable deposit.','approved'=>true],$changes);}

test('finance partial payments settle once without treating deposit as cash received',function(){
 $payload=financePayment();$this->postJson('/api/save_invoice_payment',$payload)->assertOk();$this->postJson('/api/save_invoice_payment',$payload)->assertOk();
 expect(DB::table('invoice_payment_tb')->count())->toBe(1);
 $this->postJson('/api/fetch_invoice_data',['upd_id'=>1])->assertOk()->assertJsonPath('data.summary.additional_payments','1000.00')->assertJsonPath('data.summary.cash_received','1000.00')->assertJsonPath('data.summary.deposit_held','20000.00')->assertJsonPath('data.summary.payment_status','Partially Paid');
 $this->postJson('/api/save_invoice_payment',financePayment(['amount'=>'7000.50']))->assertOk();
 $this->postJson('/api/get_invoices',['payment_status'=>'Paid'])->assertOk()->assertJsonCount(1,'data');
 expect(DB::table('booking_tb')->value('payment_status'))->toBe('Paid');
 $this->postJson('/api/save_invoice_payment',financePayment(['amount'=>'1.00']))->assertUnprocessable();
});
test('finance rejects overpayments future receipts missing approval and missing references',function(){
 foreach([['amount'=>'99999.00'],['paid_on'=>'2030-01-01'],['approved'=>false],['method'=>'bank_transfer'],['amount'=>'0']]as$change)$this->postJson('/api/save_invoice_payment',financePayment($change))->assertUnprocessable();
 expect(DB::table('invoice_payment_tb')->count())->toBe(0);
});
test('refund requires settled invoice and cannot exceed remaining deposit or duplicate',function(){
 $this->postJson('/api/save_deposit_refund',financeRefund())->assertUnprocessable();
 $this->postJson('/api/save_invoice_payment',financePayment(['amount'=>'8000.50']))->assertOk();
 $refund=financeRefund(['amount'=>'15000.00']);$this->postJson('/api/save_deposit_refund',$refund)->assertOk();$this->postJson('/api/save_deposit_refund',$refund)->assertOk();
 expect(DB::table('rental_deposit_tb')->where('entry_type','Refunded')->count())->toBe(1);
 $this->postJson('/api/save_deposit_refund',financeRefund(['amount'=>'5000.01']))->assertUnprocessable();
 $this->postJson('/api/fetch_invoice_data',['upd_id'=>1])->assertOk()->assertJsonPath('data.summary.deposit_held','5000.00')->assertJsonPath('data.summary.deposit_refunded','15000.00');
});
test('reusing a receipt key for a changed amount is rejected',function(){
 $p=financePayment();$this->postJson('/api/save_invoice_payment',$p)->assertOk();$this->postJson('/api/save_invoice_payment',[...$p,'amount'=>'2000.00'])->assertUnprocessable()->assertJsonValidationErrors('request_id');
});
test('finance registers preserve source ledgers and apply date method status filters',function(){
 DB::table('booking_payment_tb')->insert(['booking_id'=>1,'amount'=>'100.00','method'=>'cash','paid_on'=>'2026-12-01','recorded_by'=>701]);
 $this->postJson('/api/save_invoice_payment',financePayment(['method'=>'card','reference'=>'TEST-REF']))->assertOk();
 $this->postJson('/api/get_payments')->assertOk()->assertJsonCount(2,'data');
 $this->postJson('/api/get_payments',['from'=>'2026-12-02','to'=>'2026-12-02','method'=>'card'])->assertOk()->assertJsonCount(1,'data')->assertJsonPath('data.0.source','Invoice Payment');
 $this->postJson('/api/invoice_filter',['q'=>'Test'])->assertOk()->assertJsonCount(1,'data');
 config(['customer_access.users'=>[]]);foreach(['get_invoices','get_payments','get_refunds','save_invoice_payment','save_deposit_refund']as$route)$this->postJson('/api/'.$route)->assertForbidden();
});
