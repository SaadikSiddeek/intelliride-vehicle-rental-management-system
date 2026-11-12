<?php
// Full authenticated local-MySQL smoke test, rolled back in its entirety.
$root=dirname(__DIR__,2);
require $root.'/vendor/autoload.php';
$app=require $root.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$kernel=$app->make(Illuminate\Contracts\Http\Kernel::class);
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
function handoverApi($kernel,string $route,array $body,?string $token=null): array {
 app('auth')->forgetGuards();
 $headers=['CONTENT_TYPE'=>'application/json','HTTP_ACCEPT'=>'application/json'];
 if($token)$headers['HTTP_AUTHORIZATION']='Bearer '.$token;
 $req=Request::create('/api/'.$route,'POST',[],[],[],$headers,json_encode($body));
 $response=$kernel->handle($req);$result=['code'=>$response->getStatusCode(),'data'=>json_decode($response->getContent(),true)];$kernel->terminate($req,$response);return $result;
}
if(!app()->environment('local')||DB::getDriverName()!=='mysql')throw new RuntimeException('Local MySQL only.');
$credentials=json_decode(trim(fgets(STDIN)),true,512,JSON_THROW_ON_ERROR);
$vehicle=DB::table('vehicle_tb')->where('status','Available')->first();
if(!$vehicle)throw new RuntimeException('No available local test vehicle.');
$vehicleBefore=json_encode($vehicle);
$counts=[];foreach(['rental_tb','rental_deposit_tb','booking_tb','customer_tb','rental_package_tb'] as $t)$counts[$t]=DB::table($t)->count();
DB::beginTransaction();
try {
 $login=handoverApi($kernel,'login',$credentials);unset($credentials);
 if($login['code']!==200)throw new RuntimeException('Local sign-in failed.');
 $token=$login['data']['token'];unset($login);
 $customer=DB::table('customer_tb')->insertGetId(['customer_type'=>'Local','full_name'=>'CODEX ROLLBACK HANDOVER TEST','mobile'=>'0770000000','status'=>'Active'],'ID');
 $package=DB::table('rental_package_tb')->insertGetId(['vehicle_id'=>$vehicle->ID,'package_name'=>'CODEX ROLLBACK '.bin2hex(random_bytes(4)),'billing_unit'=>'day','rate_per_unit'=>'100.00','included_km_per_unit'=>100,'extra_km_charge'=>'1.00','security_deposit'=>'10.00','minimum_units'=>1,'status'=>1],'ID');
 $pickup=now('Asia/Colombo')->startOfMinute();$return=$pickup->copy()->addDay();
 $booking=handoverApi($kernel,'save_booking',['customer_id'=>$customer,'vehicle_id'=>$vehicle->ID,'package_id'=>$package,'pickup_branch_id'=>$vehicle->branch_id,'return_branch_id'=>$vehicle->branch_id,'pickup_at'=>$pickup->format('Y-m-d\TH:i'),'expected_return_at'=>$return->format('Y-m-d\TH:i'),'status'=>'Confirmed'],$token);
 if($booking['code']!==201)throw new RuntimeException('Synthetic booking failed: '.json_encode($booking));
 $payload=['booking_id'=>$booking['data']['data']['ID'],'actual_pickup_at'=>$pickup->format('Y-m-d\TH:i'),'starting_odometer'=>$vehicle->mileage,'pickup_fuel_litres'=>'20.000','driver_name'=>'Synthetic Driver','driver_document_number'=>'TEST-ONLY','driver_licence_number'=>'TEST-ONLY','driver_licence_expiry'=>$return->copy()->addYear()->toDateString(),'identity_verified'=>true,'licence_verified'=>true,'agreement_accepted'=>true,'agreement_reference'=>'SYNTHETIC-TEST','condition_notes'=>'Synthetic rollback test','deposit_received'=>'10.00','deposit_method'=>'cash','handed_over_by'=>999999];
 $handover=handoverApi($kernel,'save_handover',$payload,$token);
 if($handover['code']!==201)throw new RuntimeException('Handover failed: '.json_encode($handover));
 $id=$handover['data']['data']['ID'];
 $row=DB::table('rental_tb')->where('ID',$id)->first();
 if((int)$row->handed_over_by===999999||DB::table('rental_deposit_tb')->where('rental_id',$id)->count()!==1)throw new RuntimeException('Attribution/deposit check failed.');
 $duplicate=handoverApi($kernel,'save_handover',$payload,$token);
 if($duplicate['code']!==422)throw new RuntimeException('Duplicate activation not rejected.');
 $detail=handoverApi($kernel,'fetch_rental_data',['upd_id'=>$id],$token);
 if($detail['code']!==200||$detail['data']['data']['status']!=='Active')throw new RuntimeException('Rental detail failed.');
 $summary=['result'=>'passed','handover_status'=>201,'duplicate_status'=>422,'detail_status'=>200,'deposit_rows'=>1];
} finally {DB::rollBack();}
foreach($counts as $table=>$count)if(DB::table($table)->count()!==$count)throw new RuntimeException('Rollback count mismatch: '.$table);
if(json_encode(DB::table('vehicle_tb')->where('ID',$vehicle->ID)->first())!==$vehicleBefore)throw new RuntimeException('Vehicle restoration failed.');
echo json_encode([...$summary,'all_test_records_rolled_back'=>true],JSON_PRETTY_PRINT)."\n";
