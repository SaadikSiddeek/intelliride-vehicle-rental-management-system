<?php
use App\Models\User;use Illuminate\Support\Facades\DB;use Illuminate\Support\Facades\Storage;use Illuminate\Http\UploadedFile;use Laravel\Sanctum\Sanctum;
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
    (require database_path('migrations/2026_11_11_190000_create_fleet_operations_tables.php'))->up();
    Storage::fake('fleet_documents');
});


function maintenancePayload(array $changes=[]):array{return array_replace(['vehicle_id'=>1,'service_type'=>'Synthetic inspection','starts_at'=>'2026-12-01T10:00','ends_at'=>'2026-12-01T12:00','notes'=>'Synthetic maintenance test'],$changes);}
test('maintenance rejects reservation conflicts then blocks booking search and safe release',function(){
 $this->postJson('/api/save_maintenance',maintenancePayload())->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');
 DB::table('booking_tb')->update(['status'=>'Cancelled']);
 $id=$this->postJson('/api/save_maintenance',maintenancePayload())->assertOk()->json('data.ID');
 $this->postJson('/api/booking_vehicle_filter',['pickup_branch_id'=>1,'pickup_at'=>'2026-12-01T10:00','expected_return_at'=>'2026-12-01T11:00'])->assertOk()->assertJsonCount(0,'data');
 $this->postJson('/api/save_maintenance',maintenancePayload(['upd_id'=>$id,'notes'=>'Updated planned work']))->assertOk();
 $this->postJson('/api/maintenance_status',['upd_id'=>$id,'status'=>'Active'])->assertOk();expect(DB::table('vehicle_tb')->value('status'))->toBe('Maintenance');expect(DB::table('vehicle_unavailability_tb')->value('ends_at'))->toBeNull();
 $this->postJson('/api/maintenance_status',['upd_id'=>$id,'status'=>'Completed','release_status'=>'Available'])->assertUnprocessable();
 $this->postJson('/api/maintenance_status',['upd_id'=>$id,'status'=>'Completed','release_status'=>'Available','release_approved'=>true])->assertOk();expect(DB::table('vehicle_tb')->value('status'))->toBe('Available');
 $this->postJson('/api/maintenance_status',['upd_id'=>$id,'status'=>'Completed'])->assertUnprocessable();
});
test('maintenance cancellation releases schedule and active rentals exclude new work',function(){
 DB::table('booking_tb')->update(['status'=>'Cancelled']);$id=$this->postJson('/api/save_maintenance',maintenancePayload())->assertOk()->json('data.ID');
 $this->postJson('/api/maintenance_status',['upd_id'=>$id,'status'=>'Cancelled'])->assertOk();
 DB::table('vehicle_unavailability_tb')->insert(['vehicle_id'=>1,'kind'=>'Active Rental','status'=>'Active','starts_at'=>'2026-12-01 09:00:00']);
 $this->postJson('/api/save_maintenance',maintenancePayload())->assertUnprocessable();
});
test('fleet documents validate files preserve renewal history and protect downloads',function(){
 $png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=');$payload=['vehicle_id'=>1,'document_type'=>'Insurance','document_number'=>'TEST-OLD','issued_on'=>'2026-01-01','expires_on'=>'2026-06-30','file'=>UploadedFile::fake()->createWithContent('policy.png',$png)];
 $id=$this->post('/api/save_vehicle_document',$payload,['Accept'=>'application/json'])->assertCreated()->json('data.ID');
 $this->postJson('/api/get_vehicle_documents',['status'=>'Expired'])->assertOk()->assertJsonCount(1,'data')->assertJsonMissingPath('data.0.path');
 $path=DB::table('vehicle_document_tb')->where('ID',$id)->value('path');Storage::disk('fleet_documents')->assertExists($path);
 $payload['renewal_of']=$id;$payload['document_number']='TEST-NEW';$payload['issued_on']='2026-07-01';$payload['expires_on']='2027-06-30';$payload['file']=UploadedFile::fake()->createWithContent('renewal.png',$png);
 $this->post('/api/save_vehicle_document',$payload,['Accept'=>'application/json'])->assertCreated();Storage::disk('fleet_documents')->assertExists($path);
 $this->postJson('/api/get_vehicle_documents',['status'=>'Superseded'])->assertOk()->assertJsonCount(1,'data');
 expect(DB::table('vehicle_tb')->value('insurance_expiry_date'))->toBe('2027-06-30');
 $this->get('/api/vehicle_documents/'.$id)->assertOk()->assertHeader('X-Content-Type-Options','nosniff');
 config(['customer_access.users'=>[]]);$this->getJson('/api/vehicle_documents/'.$id)->assertForbidden();
});
