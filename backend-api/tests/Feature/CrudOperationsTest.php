<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') throw new RuntimeException('Disposable database required.');
    Artisan::call('migrate', ['--force' => true]); Artisan::call('db:seed', ['--force' => true]);
    DB::table('authorization_state_tb')->where('ID', 1)->update(['enabled' => true]);
    $this->crudSecret = bin2hex(random_bytes(16));
    foreach ([1 => 'super_admin', 2 => 'admin', 3 => 'user'] as $id => $type) DB::table('users_tb')->insert(['ID'=>$id, 'username'=>'crud-'.$id, 'email'=>'crud-'.$id.'@example.test', 'password'=>Hash::make($this->crudSecret), 'role_id'=>DB::table('roles_tb')->value('ID'), 'branch_id'=>1, 'user_type'=>$type, 'status'=>true, 'managed_by_user_id'=>1]);
    Sanctum::actingAs(User::findOrFail(1));
    DB::table('vehicle_brand_tb')->insert(['ID'=>1,'brand_name'=>'Synthetic']);
    DB::table('vehicle_model_tb')->insert(['ID'=>1,'brand_id'=>1,'fuel_type_id'=>1,'transmission_type_id'=>1,'model_name'=>'Synthetic']);
    DB::table('vehicle_tb')->insert(['ID'=>1,'vehicle_number'=>'CRUD-SYNTHETIC','branch_id'=>1,'category_id'=>1,'brand_id'=>1,'model_id'=>1,'fuel_type_id'=>1,'transmission_type_id'=>1]);
    DB::table('customer_tb')->insert(['ID'=>1,'customer_type'=>'Local','full_name'=>'Synthetic CRUD Customer','mobile'=>'0770000000','status'=>'Active']);
    DB::table('rental_package_tb')->insert(['ID'=>1,'vehicle_id'=>1,'package_name'=>'Synthetic','billing_unit'=>'day','rate_per_unit'=>'1000.00','included_km_per_unit'=>100,'extra_km_charge'=>'10.00','security_deposit'=>'2000.00','minimum_units'=>1,'status'=>1]);
    $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-15 12:00', 'Asia/Colombo'));
});

function crudBooking(array $overrides=[]): array {return array_replace(['customer_id'=>1,'vehicle_id'=>1,'package_id'=>1,'pickup_branch_id'=>1,'return_branch_id'=>1,'pickup_at'=>'2026-12-01T10:00','expected_return_at'=>'2026-12-02T10:00','status'=>'Confirmed','discount'=>'0','advance_amount'=>'0','extras'=>[]],$overrides);}
function crudAmend($test, int $id, array $overrides=[]): array {$row=DB::table('booking_tb')->where('ID',$id)->first(); return array_replace(['upd_id'=>$id,'pickup_at'=>'2026-12-04T10:00','expected_return_at'=>'2026-12-06T10:00','original_pickup_at'=>$row->pickup_at,'original_expected_return_at'=>$row->expected_return_at,'reason'=>'Synthetic date correction'],$overrides);}

it('previews and amends confirmed booking dates without duplication using historical pricing', function () {
    $id=$this->postJson('/api/save_booking',crudBooking())->assertCreated()->json('data.ID');
    DB::table('rental_package_tb')->update(['rate_per_unit'=>'9999.00','included_km_per_unit'=>1,'security_deposit'=>'99999.00']);
    $data=crudAmend($this,$id);
    $this->postJson('/api/amend_booking_dates',[...$data,'preview'=>true])->assertOk()->assertJsonPath('data.total','2000.00')->assertJsonPath('data.included_km',200);
    expect(DB::table('booking_tb')->value('pickup_at'))->toBe('2026-12-01 10:00:00');
    $this->postJson('/api/amend_booking_dates',$data)->assertOk()->assertJsonPath('data.ID',$id);
    $this->postJson('/api/fetch_booking_data',['upd_id'=>$id])->assertOk()->assertJsonPath('data.pickup_at','2026-12-04 10:00:00')->assertJsonPath('data.pricing_snapshot.total','2000.00')->assertJsonPath('data.pricing_snapshot.security_deposit','2000');
    expect(DB::table('booking_tb')->count())->toBe(1)->and(DB::table('booking_payment_tb')->count())->toBe(0)->and(DB::table('authorization_audit_tb')->where('action','booking_dates_amended')->count())->toBe(1);
    $this->postJson('/api/amend_booking_dates',$data)->assertConflict();
});

it('rejects conflicts invalid dates past pickups and locked lifecycle with no partial update',function () {
    $id=$this->postJson('/api/save_booking',crudBooking())->assertCreated()->json('data.ID');
    $this->postJson('/api/save_booking',crudBooking(['pickup_at'=>'2026-12-04T10:00','expected_return_at'=>'2026-12-06T10:00']))->assertCreated();
    $this->postJson('/api/amend_booking_dates',crudAmend($this,$id))->assertUnprocessable();
    $this->postJson('/api/amend_booking_dates',crudAmend($this,$id,['expected_return_at'=>'2026-12-01T09:00']))->assertUnprocessable();
    $this->postJson('/api/amend_booking_dates',crudAmend($this,$id,['pickup_at'=>'2026-11-01T10:00']))->assertUnprocessable();
    expect(DB::table('booking_tb')->where('ID',$id)->value('pickup_at'))->toBe('2026-12-01 10:00:00');
    DB::table('booking_tb')->where('ID',$id)->update(['status'=>'Converted to Rental']);
    $this->postJson('/api/amend_booking_dates',crudAmend($this,$id))->assertUnprocessable();
});

it('excludes its own reservation and safely shifts legacy snapshots only at unchanged duration',function () {
    $id=$this->postJson('/api/save_booking',crudBooking())->assertCreated()->json('data.ID');
    $quote=json_decode(DB::table('booking_tb')->where('ID',$id)->value('pricing_snapshot'),true);unset($quote['minimum_units']);
    DB::table('booking_tb')->where('ID',$id)->update(['pricing_snapshot'=>json_encode($quote)]);
    $this->postJson('/api/amend_booking_dates',crudAmend($this,$id,['pickup_at'=>'2026-12-01T11:00','expected_return_at'=>'2026-12-02T11:00']))->assertOk();
    $this->postJson('/api/amend_booking_dates',crudAmend($this,$id))->assertUnprocessable();
});

it('does not reduce booking charges below receipts or duplicate recorded payments',function () {
    $id=$this->postJson('/api/save_booking',crudBooking(['expected_return_at'=>'2026-12-04T10:00','advance_amount'=>'2500','payment_method'=>'cash','payment_date'=>'2026-11-15']))->assertCreated()->json('data.ID');
    $this->postJson('/api/amend_booking_dates',crudAmend($this,$id,['expected_return_at'=>'2026-12-05T10:00']))->assertUnprocessable();
    expect(DB::table('booking_payment_tb')->count())->toBe(1)->and(DB::table('booking_tb')->value('total'))->toBe(3000);
});

it('preserves status on stale unauthorized and invalid resource requests',function () {
    $id=DB::table('department_tb')->value('ID');
    $f=['resource'=>'departments','id'=>$id,'active'=>false,'expected_status'=>'1','reason'=>'Synthetic status review'];
    Sanctum::actingAs(User::findOrFail(3));$this->postJson('/api/record_status',$f)->assertForbidden();
    $this->postJson('/api/amend_booking_dates',['upd_id'=>1])->assertForbidden();
    Sanctum::actingAs(User::findOrFail(1));
    $this->postJson('/api/record_status',$f)->assertOk()->assertJsonPath('data.status',0);
    $this->postJson('/api/record_status',$f)->assertConflict();
    $this->postJson('/api/record_status',[...$f,'active'=>true,'expected_status'=>'0'])->assertOk()->assertJsonPath('data.status',1);
    $this->postJson('/api/record_status',[...$f,'resource'=>'vehicle_tb'])->assertForbidden();
    $this->postJson('/api/record_status',[...$f,'resource'=>['departments']])->assertForbidden();
    expect(DB::table('department_tb')->where('ID',$id)->value('status'))->toBe(1);
});

it('protects owner accounts and preserves grants across user deactivation and reactivation',function () {
    DB::table('user_permission_tb')->insert(['user_id'=>3,'permission_code'=>'customers.view','effect'=>'allow']);
    $token=User::findOrFail(3)->createToken('synthetic-status-test')->plainTextToken;
    $f=['resource'=>'users','id'=>3,'active'=>false,'expected_status'=>'1','reason'=>'Synthetic account review'];
    $this->postJson('/api/record_status',[...$f,'id'=>1])->assertForbidden();
    $this->postJson('/api/record_status',$f)->assertOk();
    expect(DB::table('personal_access_tokens')->count())->toBe(0)->and(DB::table('user_permission_tb')->where('user_id',3)->count())->toBe(1);
    Sanctum::actingAs(User::findOrFail(3));$this->getJson('/api/user')->assertForbidden()->assertJsonPath('code','ACCOUNT_INACTIVE');
    app('auth')->forgetGuards();app('auth')->shouldUse('web');
    $this->postJson('/api/login',['email'=>'crud-3@example.test','password'=>$this->crudSecret])->assertForbidden()->assertJsonPath('code','ACCOUNT_INACTIVE');
    Sanctum::actingAs(User::findOrFail(1));$this->postJson('/api/record_status',[...$f,'active'=>true,'expected_status'=>'0'])->assertOk();
    app('auth')->forgetGuards();app('auth')->shouldUse('web');
    $this->postJson('/api/login',['email'=>'crud-3@example.test','password'=>$this->crudSecret])->assertOk()->assertJsonPath('user.effective_permissions',['customers.view']);
});

it('supports every allowlisted binary master and does not silently unblock a customer',function () {
    DB::table('vehicle_feature_tb')->insert(['feature_name'=>'Synthetic feature','status'=>true]);
    DB::table('staff_tb')->insert(['branch_id'=>1,'department_id'=>DB::table('department_tb')->value('ID'),'designation_id'=>DB::table('designation_tb')->value('ID'),'emp_code'=>'CRUD-STAFF','first_name'=>'Synthetic','last_name'=>'Employee','phone'=>'0000000000','status'=>true]);
    $resources=['vehicle_features'=>'vehicle_feature_tb','staff'=>'staff_tb','branches'=>'branch_tb','departments'=>'department_tb','designations'=>'designation_tb','categories'=>'vehicle_category_tb','brands'=>'vehicle_brand_tb','models'=>'vehicle_model_tb','fuel_types'=>'fuel_type_tb','transmissions'=>'transmission_type_tb','rental_packages'=>'rental_package_tb','roles'=>'roles_tb'];
    foreach($resources as $resource=>$table) {
        $id=DB::table($table)->value('ID');
        foreach([false,true] as $active) $this->postJson('/api/record_status',['resource'=>$resource,'id'=>$id,'active'=>$active,'expected_status'=>$active?'0':'1','reason'=>'Synthetic binary status check'])->assertOk();
    }
    foreach ([false,true] as $active) $this->postJson('/api/record_status',['resource'=>'customers','id'=>1,'active'=>$active,'expected_status'=>$active?'Inactive':'Active','reason'=>'Synthetic customer activation'])->assertOk();
    DB::table('customer_tb')->where('ID',1)->update(['status'=>'Blocked']);
    $this->postJson('/api/record_status',['resource'=>'customers','id'=>1,'active'=>true,'expected_status'=>'Blocked','reason'=>'Synthetic blocked customer check'])->assertUnprocessable();
});


it('keeps nonexistent-account and wrong-password login failures indistinguishable', function () {
    app('auth')->forgetGuards();app('auth')->shouldUse('web');
    $missing=$this->postJson('/api/login',['email'=>'missing@example.test','password'=>'incorrect synthetic password'])->assertStatus(422);
    $wrong=$this->postJson('/api/login',['email'=>'crud-3@example.test','password'=>'incorrect synthetic password'])->assertStatus(422);
    expect($missing->json('message'))->toBe($wrong->json('message'))->and(DB::table('personal_access_tokens')->count())->toBe(0);
});


it('limits delegated Admin inline account changes to managed normal users', function () {
    DB::table('user_permission_tb')->insert(['user_id'=>2,'permission_code'=>'users.deactivate','effect'=>'allow']);
    DB::table('admin_permission_scope_tb')->insert(['user_id'=>2,'permission_code'=>'users.deactivate','delegable'=>false]);
    Sanctum::actingAs(User::findOrFail(2));
    $f=['resource'=>'users','id'=>3,'active'=>false,'expected_status'=>'1','reason'=>'Synthetic delegated status check'];
    $this->postJson('/api/record_status',$f)->assertForbidden();
    $this->postJson('/api/record_status',[...$f,'id'=>1])->assertForbidden();
    $this->postJson('/api/record_status',[...$f,'id'=>2])->assertForbidden();
    DB::table('users_tb')->where('ID',3)->update(['managed_by_user_id'=>2]);
    $this->postJson('/api/record_status',$f)->assertOk();
    expect(DB::table('users_tb')->where('ID',1)->value('status'))->toBe(1);
});

it('uses opaque identifiers through real booking filters creation hydration and permission denial', function () {
    $headers = ['X-IntelliRide-Identifiers' => 'encrypted-v1'];
    $options = $this->postJson('/api/booking_options', [], $headers)->assertOk()->json('data');
    $customer = $this->postJson('/api/customer_filter', ['id' => \App\Helpers\Helpers::encryptVal(1)], $headers)->assertOk()->json('results.0.id');
    // Select2 filters preserve IDs as opaque strings; requests decrypt at the boundary.
    $payload = crudBooking(['customer_id' => $customer ?: \App\Helpers\Helpers::encryptVal(1), 'vehicle_id' => \App\Helpers\Helpers::encryptVal(1), 'package_id' => \App\Helpers\Helpers::encryptVal(1), 'pickup_branch_id' => $options['installation_branch_id'], 'return_branch_id' => $options['installation_branch_id']]);
    $created = $this->postJson('/api/save_booking', $payload, $headers)->assertCreated()->json('data');
    $id = $created['ID'] ?? $created['id'];
    expect($id)->toStartWith('ir1.');
    $detail = $this->postJson('/api/fetch_booking_data', ['upd_id' => $id], $headers)->assertOk()->json('data');
    expect($detail['customer_id'])->toStartWith('ir1.')->and($detail['booking_code'])->toBe('BKG-000001');
    expect(DB::table('booking_tb')->count())->toBe(1)->and((int) DB::table('booking_tb')->value('customer_id'))->toBe(1);
    Sanctum::actingAs(User::findOrFail(3));
    $this->postJson('/api/fetch_booking_data', ['upd_id' => $id], $headers)->assertForbidden();
    $this->postJson('/api/save_booking', $payload, $headers)->assertForbidden();
});

it('preserves assigned historical vehicle reads without exposing another branch or moving records', function () {
    $main=DB::table('branch_tb')->insertGetId(['branch_name'=>'New installation','branch_code'=>'MAIN','status'=>true],'ID');
    $other=DB::table('branch_tb')->insertGetId(['branch_name'=>'Unrelated','branch_code'=>'OTHER','status'=>true],'ID');
    DB::table('installation_settings_tb')->where('ID',1)->update(['branch_id'=>$main]);
    $copy=(array)DB::table('vehicle_tb')->where('ID',1)->first(); $copy['ID']=2; $copy['vehicle_number']='UNRELATED-PRIVATE'; $copy['branch_id']=$other; DB::table('vehicle_tb')->insert($copy);
    $headers=['X-IntelliRide-Identifiers'=>'encrypted-v1'];
    $this->postJson('/api/get_vehicles',[],$headers)->assertOk()->assertJsonCount(1,'data')->assertJsonPath('data.0.is_historical_branch',true);
    $this->postJson('/api/fetch_vehicle_data',['upd_id'=>\App\Helpers\Helpers::encryptVal(1)],$headers)->assertOk()->assertJsonPath('data.is_historical_branch',true);
    $this->postJson('/api/fetch_vehicle_data',['upd_id'=>\App\Helpers\Helpers::encryptVal(2)],$headers)->assertNotFound();
    $this->postJson('/api/save_vehicle',['upd_id'=>\App\Helpers\Helpers::encryptVal(1)],$headers)->assertStatus(409);
    expect((int)DB::table('vehicle_tb')->where('ID',1)->value('branch_id'))->toBe(1);
});

it('replays a retried draft creation without duplicating bookings or changing its payload',function(){
 $request=(string)\Illuminate\Support\Str::uuid();
 $payload=crudBooking(['status'=>'Draft','request_id'=>$request]);
 $first=$this->postJson('/api/save_booking',$payload)->assertCreated()->json('data.ID');
 $again=$this->postJson('/api/save_booking',$payload)->assertOk()->json('data.ID');
 expect($again)->toBe($first)->and(DB::table('booking_tb')->count())->toBe(1);
 $this->postJson('/api/save_booking',[...$payload,'request_id'=>strtoupper($request)])->assertOk()->assertJsonPath('data.ID',$first);
 $this->postJson('/api/save_booking',[...$payload,'notes'=>'Different payload with same request'])->assertStatus(409);
});

it('uses the installation fleet for booking without branch filtering or moving historical vehicles',function(){
 $main=DB::table('branch_tb')->insertGetId(['branch_name'=>'Selected Main','branch_code'=>'SELECTED','status'=>true],'ID');
 DB::table('installation_settings_tb')->where('ID',1)->update(['branch_id'=>$main]);
 $copy=(array)DB::table('vehicle_tb')->where('ID',1)->first();$copy['ID']=2;$copy['vehicle_number']='CURRENT-INSTALLATION';$copy['branch_id']=$main;DB::table('vehicle_tb')->insert($copy);
 $this->postJson('/api/booking_vehicle_filter',['pickup_at'=>'2026-12-01T10:00','expected_return_at'=>'2026-12-02T10:00','pickup_branch_id'=>1])->assertOk()->assertJsonCount(2,'data');
 $this->postJson('/api/dashboard_overview')->assertOk()->assertJsonPath('data.installation_branch','Selected Main')->assertJsonPath('data.current.fleet_total',1);
 expect((int)DB::table('vehicle_tb')->where('ID',1)->value('branch_id'))->toBe(1);
});
