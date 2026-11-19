<?php

use App\Models\Rental;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
});


function handoverPayload(array $changes=[]): array
{
    return array_replace(['booking_id'=>1,'actual_pickup_at'=>'2026-12-01T10:00','starting_odometer'=>1200,
        'pickup_fuel_litres'=>'35.500','driver_name'=>'Synthetic Driver','driver_document_number'=>'TEST-NIC',
        'driver_licence_number'=>'TEST-LICENCE','driver_licence_expiry'=>'2027-12-31',
        'identity_verified'=>true,'licence_verified'=>true,'agreement_accepted'=>true,'agreement_reference'=>'TEST-AGR-1',
        'condition_notes'=>'Inspected; existing scratch recorded.','existing_damage'=>'Existing rear scratch.',
        'deposit_received'=>'20000.00','deposit_method'=>'cash'], $changes);
}

test('handover atomically activates rental blocks vehicle and records authenticated staff',function () {
    $pricing=DB::table('booking_tb')->value('pricing_snapshot');
    $id=$this->postJson('/api/save_handover',handoverPayload(['handed_over_by'=>702,'handover_staff_id'=>999]))->assertCreated()->json('data.ID');
    $rental=Rental::findOrFail($id);
    expect($rental->handed_over_by)->toBe(701)->and($rental->handover_staff_id)->toBe(3)->and($rental->handover_staff_name)->toBe('Test Employee');
    expect($rental->pricing_snapshot)->toBe(json_decode($pricing,true));
    expect(DB::table('booking_tb')->value('status'))->toBe('Converted to Rental');
    expect(DB::table('vehicle_tb')->value('status'))->toBe('Rented');
    expect(DB::table('vehicle_unavailability_tb')->where('ID',$rental->availability_block_id)->value('ends_at'))->toBeNull();
    expect(DB::table('rental_deposit_tb')->count())->toBe(1);
    expect(DB::table('booking_payment_tb')->count())->toBe(0);
    $this->postJson('/api/get_rentals',['status'=>'Active'])->assertOk()->assertJsonPath('data.0.handed_over_by','Test Employee');
    $this->postJson('/api/handover_booking_filter')->assertOk()->assertJsonCount(0,'data');
    $this->postJson('/api/save_handover',handoverPayload())->assertUnprocessable();
    expect(Rental::count())->toBe(1)->and(DB::table('rental_deposit_tb')->count())->toBe(1);
});

test('handover retains account attribution when a legacy user has no employee mapping',function () {
    $user=User::findOrFail(701); $user->emp_id='ADMIN001'; $user->save(); Sanctum::actingAs($user);
    $id=$this->postJson('/api/save_handover',handoverPayload())->assertCreated()->json('data.ID');
    expect(Rental::findOrFail($id)->handover_staff_id)->toBeNull();
    expect(Rental::findOrFail($id)->handover_staff_name)->toBe('test-admin');
});

test('handover validates dates mileage licence agreement checks and deposit without side effects',function () {
    foreach ([['actual_pickup_at'=>'2026-11-30T10:00'],['actual_pickup_at'=>'2026-12-03T10:00'],['starting_odometer'=>999],['driver_licence_expiry'=>'2026-12-01'],['identity_verified'=>false],['licence_verified'=>false],['agreement_accepted'=>false],['deposit_received'=>'19999.99'],['deposit_method'=>'card']] as $change) {
        $this->postJson('/api/save_handover',handoverPayload($change))->assertUnprocessable();
    }
    expect(Rental::count())->toBe(0)->and(DB::table('rental_deposit_tb')->count())->toBe(0)->and(DB::table('vehicle_unavailability_tb')->count())->toBe(0);
    expect(DB::table('vehicle_tb')->value('status'))->toBe('Available');
});

test('handover rechecks customer branch reservation and maintenance availability',function () {
    DB::table('customer_tb')->update(['status'=>'Blocked']);
    $this->postJson('/api/save_handover',handoverPayload())->assertUnprocessable();
    DB::table('customer_tb')->update(['status'=>'Active']);
    DB::table('branch_tb')->update(['status'=>0]);
    $this->postJson('/api/save_handover',handoverPayload())->assertUnprocessable();
    DB::table('branch_tb')->update(['status'=>1]);
    DB::table('vehicle_unavailability_tb')->insert(['vehicle_id'=>1,'kind'=>'Maintenance','status'=>'Active','starts_at'=>'2026-12-01 09:00:00']);
    $this->postJson('/api/save_handover',handoverPayload())->assertUnprocessable();
    expect(Rental::count())->toBe(0);
});

test('handover condition uploads remain private and validation rejects invalid files',function () {
    $this->post('/api/save_handover',handoverPayload(['photos'=>[UploadedFile::fake()->create('test.html',5,'text/html')]]),['Accept'=>'application/json'])->assertUnprocessable();
    $png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=');
    $id=$this->post('/api/save_handover',handoverPayload(['photos'=>[UploadedFile::fake()->createWithContent('condition.png',$png)]]),['Accept'=>'application/json'])->assertCreated()->json('data.ID');
    $photo=DB::table('rental_photo_tb')->first(); Storage::disk('rental_documents')->assertExists($photo->path);
    $this->postJson('/api/fetch_rental_data',['upd_id'=>$id])->assertOk()->assertJsonPath('data.photos.0.ID',$photo->ID)->assertJsonMissingPath('data.photos.0.path');
    $this->get('/api/rental_photos/'.$photo->ID)->assertOk()->assertHeader('X-Content-Type-Options','nosniff');
    config(['customer_access.users'=>[]]);
    $this->getJson('/api/rental_photos/'.$photo->ID)->assertForbidden();
});

test('rental endpoints require existing allowlist and active authenticated account',function () {
    config(['customer_access.users'=>[]]);
    foreach(['handover_booking_filter','handover_context','save_handover','get_rentals','fetch_rental_data'] as $route) $this->postJson('/api/'.$route,handoverPayload())->assertForbidden();
    config(['customer_access.users'=>['701']]); $user=User::findOrFail(701); $user->status=false; Sanctum::actingAs($user);
    $this->postJson('/api/get_rentals')->assertForbidden();
});

test('private upload failures roll back activation deposit and booking conversion',function () {
    $png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=');
    Storage::shouldReceive('disk')->with('rental_documents')->andReturn(Mockery::mock()->shouldReceive('putFile')->once()->andThrow(new RuntimeException('Simulated storage failure'))->getMock());
    $this->post('/api/save_handover',handoverPayload(['photos'=>[UploadedFile::fake()->createWithContent('condition.png',$png)]]),['Accept'=>'application/json'])->assertStatus(500);
    expect(Rental::count())->toBe(0)->and(DB::table('rental_deposit_tb')->count())->toBe(0)->and(DB::table('vehicle_unavailability_tb')->count())->toBe(0);
    expect(DB::table('booking_tb')->value('status'))->toBe('Confirmed');
});


test('pickup boundaries use the reservation business timezone independently of application timezone', function ($start, $end, $clock, $pickup, $accepted, $message) {
    config(['app.timezone' => 'America/New_York']);
    $this->travelTo(\Carbon\CarbonImmutable::parse($clock, 'Asia/Colombo')->utc());
    DB::table('booking_tb')->where('ID', 1)->update(['pickup_at' => $start, 'expected_return_at' => $end]);
    $response=$this->postJson('/api/save_handover',handoverPayload(['actual_pickup_at'=>$pickup]));
    if ($accepted) {
        $response->assertCreated();
        expect(DB::table('rental_tb')->value('actual_pickup_at'))->toBe(str_replace('T',' ',$pickup).':00');
        expect(DB::table('booking_tb')->value('status'))->toBe('Converted to Rental');
    } else {
        $response->assertUnprocessable()->assertJsonValidationErrors('actual_pickup_at');
        if($message) expect($response->json('errors.actual_pickup_at.0'))->toContain($message);
        expect(DB::table('rental_tb')->count())->toBe(0)->and(DB::table('rental_deposit_tb')->count())->toBe(0);
    }
})->with([
    'inside reservation'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:00','2026-12-01T11:00',true,null],
    'inclusive start'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:00','2026-12-01T10:00',true,null],
    'exclusive return boundary'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-02 12:00:00','2026-12-02T10:00',false,'before the expected return'],
    'within existing early handover allowance'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:00','2026-12-01T09:59',true,null],
    'inclusive early boundary'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:00','2026-12-01T09:30',true,null],
    'before early boundary'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:00','2026-12-01T09:29',false,'before the reserved'],
    'after end'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-03 12:00:00','2026-12-02T10:01',false,'before the expected return'],
    'future today'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:00','2026-12-01T12:01',false,'future'],
    'current minute'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:30','2026-12-01T12:00',true,null],
    'future reservation'=>['2026-12-02 10:00:00','2026-12-03 10:00:00','2026-12-01 12:00:00','2026-12-02T10:00',false,'future'],
    'past reservation valid pickup'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-03 12:00:00','2026-12-01T11:00',true,null],
    'Colombo midnight previous UTC day'=>['2026-12-01 00:00:00','2026-12-02 00:00:00','2026-12-01 00:05:00','2026-12-01T00:00',true,null],
    'early handover across midnight'=>['2026-12-01 00:00:00','2026-12-02 00:00:00','2026-12-01 00:05:00','2026-11-30T23:59',true,null],
    'before early midnight boundary'=>['2026-12-01 00:00:00','2026-12-02 00:00:00','2026-12-01 00:05:00','2026-11-30T23:29',false,'before the reserved'],
    'missing timestamp'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:00','',false,null],
    'invalid timestamp'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:00','not-a-date',false,null],
    'date only unsupported'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:00','2026-12-01',false,null],
    'UTC offset not the wall-clock contract'=>['2026-12-01 10:00:00','2026-12-02 10:00:00','2026-12-01 12:00:00','2026-12-01T05:30Z',false,null],
]);

test('a rejected pickup can be corrected and context returns the business clock for the selected booking', function () {
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-12-01 12:00:00','Asia/Colombo')->utc());
    $this->postJson('/api/handover_context',['booking_id'=>1])->assertOk()->assertJsonPath('data.rental_timezone','Asia/Colombo')->assertJsonPath('data.server_now','2026-12-01T12:00');
    $this->postJson('/api/save_handover',handoverPayload(['actual_pickup_at'=>'2026-12-01T12:01']))->assertUnprocessable()->assertJsonValidationErrors('actual_pickup_at');
    $this->postJson('/api/save_handover',handoverPayload(['actual_pickup_at'=>'2026-12-01T11:59']))->assertCreated();
    expect(DB::table('rental_tb')->count())->toBe(1)->and(DB::table('rental_deposit_tb')->count())->toBe(1);
});


test('video15November pickup is rejected for16November reservation and uses the existing thirty minute early allowance', function () {
    // Faithful isolated copy of recording values; never modify the operator's booking.
    DB::table('booking_tb')->where('ID',1)->update(['pickup_at'=>'2026-11-16 12:00:00','expected_return_at'=>'2026-11-23 12:00:00']);
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-15 20:50:06','Asia/Colombo')->utc());
    $this->postJson('/api/handover_context',['booking_id'=>1])->assertOk()->assertJsonPath('data.handover_not_started',true)->assertJsonPath('data.pickup_min','2026-11-16T11:30')->assertJsonPath('data.server_now','2026-11-15T20:50');
    $this->postJson('/api/save_handover',handoverPayload(['actual_pickup_at'=>'2026-11-15T08:47']))->assertUnprocessable()->assertJsonValidationErrors('actual_pickup_at');
    // Even choosing an in-period future pickup today must remain invalid.
    $this->postJson('/api/save_handover',handoverPayload(['actual_pickup_at'=>'2026-11-16T12:00']))->assertUnprocessable()->assertJsonValidationErrors('actual_pickup_at');
    expect(Rental::count())->toBe(0)->and(DB::table('rental_deposit_tb')->count())->toBe(0);
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-16 12:00:00','Asia/Colombo')->utc());
    $this->postJson('/api/handover_context',['booking_id'=>1])->assertOk()->assertJsonPath('data.handover_not_started',false)->assertJsonPath('data.pickup_min','2026-11-16T11:30')->assertJsonPath('data.pickup_max','2026-11-16T12:00');
    $this->postJson('/api/save_handover',handoverPayload(['actual_pickup_at'=>'2026-11-16T12:00']))->assertCreated();
    expect(DB::table('rental_tb')->value('actual_pickup_at'))->toBe('2026-11-16 12:00:00');
    $this->postJson('/api/save_handover',handoverPayload(['actual_pickup_at'=>'2026-11-16T12:00']))->assertUnprocessable();
    expect(Rental::count())->toBe(1)->and(DB::table('rental_deposit_tb')->count())->toBe(1);
});

test('expired confirmed booking can still record legitimate historical pickup without permitting the return boundary',function(){
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-12-03 12:00:00','Asia/Colombo')->utc());
    $this->postJson('/api/handover_context',['booking_id'=>1])->assertOk()->assertJsonPath('data.handover_not_started',false)->assertJsonPath('data.pickup_max','2026-12-02T09:59');
    $this->postJson('/api/save_handover',handoverPayload(['actual_pickup_at'=>'2026-12-01T11:00']))->assertCreated();
});

test('successful handover works without email configuration and dispatches no mail or jobs', function () {
    \Illuminate\Support\Facades\Queue::fake();
    \Illuminate\Support\Facades\Mail::fake();
    \Illuminate\Support\Facades\Notification::fake();
    $this->postJson('/api/save_handover', handoverPayload())->assertCreated()->assertJsonMissingPath('data.notification');
    \Illuminate\Support\Facades\Queue::assertNothingPushed();
    \Illuminate\Support\Facades\Mail::assertNothingSent();
    \Illuminate\Support\Facades\Notification::assertNothingSent();
});
