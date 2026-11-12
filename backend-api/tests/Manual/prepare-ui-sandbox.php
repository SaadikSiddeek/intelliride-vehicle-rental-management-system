<?php
$root=dirname(__DIR__,2);require $root.'/vendor/autoload.php';$app=require $root.'/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;use Illuminate\Support\Facades\Hash;use Illuminate\Http\Request;
$name=$argv[1]??'';if(!preg_match('/^intelliride_codex_returns_\d{8}_[a-f0-9]{8}$/D',$name)||!app()->environment('local'))throw new RuntimeException('Isolated synthetic schema only.');
config(['database.connections.mysql.database'=>$name,'customer_access.users'=>['701','702']]);DB::purge('mysql');
if(!DB::table('users_tb')->where('ID',702)->exists())DB::table('users_tb')->insert(['ID'=>702,'role_id'=>1,'username'=>'Synthetic UI Staff','email'=>'synthetic-ui@example.test','password'=>Hash::make('SyntheticOnly!2026'),'status'=>1]);
$kernel=$app->make(Illuminate\Contracts\Http\Kernel::class);
function sandboxApi($kernel,$route,$body,$token=null){app('auth')->forgetGuards();$h=['CONTENT_TYPE'=>'application/json','HTTP_ACCEPT'=>'application/json'];if($token)$h['HTTP_AUTHORIZATION']='Bearer '.$token;$r=Request::create('/api/'.$route,'POST',[],[],[],$h,json_encode($body));$response=$kernel->handle($r);$data=json_decode($response->getContent(),true);$kernel->terminate($r,$response);if($response->getStatusCode()>=400)throw new RuntimeException('Sandbox '.$route.' failed: '.($data['message']??'Validation'));return $data;}
$token=sandboxApi($kernel,'login',['email'=>'synthetic-ui@example.test','password'=>'SyntheticOnly!2026'])['token'];
try{foreach([2,3]as$id){
 if(DB::table('vehicle_tb')->where('ID',$id)->exists())continue;
 DB::table('vehicle_tb')->insert(['ID'=>$id,'branch_id'=>1,'category_id'=>1,'brand_id'=>1,'model_id'=>1,'fuel_type_id'=>1,'transmission_type_id'=>1,'vehicle_number'=>'SYNTHETIC-'.$id,'mileage'=>1000]);
 DB::table('rental_package_tb')->insert(['ID'=>$id,'vehicle_id'=>$id,'package_name'=>'Synthetic UI Daily '.$id,'billing_unit'=>'day','rate_per_unit'=>'8000.00','included_km_per_unit'=>100,'extra_km_charge'=>'75.00','security_deposit'=>$id===2?'20000.00':'0.00','minimum_units'=>1,'status'=>1]);
 DB::table('customer_tb')->insert(['ID'=>$id,'customer_type'=>'Local','full_name'=>'SYNTHETIC UI CUSTOMER '.$id,'mobile'=>'0770000000','status'=>'Active']);
 $pickup=now('Asia/Colombo')->startOfMinute();$end=$pickup->copy()->addDay();
 $b=sandboxApi($kernel,'save_booking',['customer_id'=>$id,'vehicle_id'=>$id,'package_id'=>$id,'pickup_branch_id'=>1,'return_branch_id'=>1,'pickup_at'=>$pickup->format('Y-m-d\TH:i'),'expected_return_at'=>$end->format('Y-m-d\TH:i'),'status'=>'Confirmed'],$token);
 if($id===2)sandboxApi($kernel,'save_handover',['booking_id'=>$b['data']['ID'],'actual_pickup_at'=>$pickup->format('Y-m-d\TH:i'),'starting_odometer'=>1000,'pickup_fuel_litres'=>'35.500','driver_name'=>'Synthetic UI Driver','driver_document_number'=>'TEST','driver_licence_number'=>'TEST','driver_licence_expiry'=>$end->copy()->addYear()->toDateString(),'identity_verified'=>true,'licence_verified'=>true,'agreement_accepted'=>true,'agreement_reference'=>'SYNTHETIC-UI','condition_notes'=>'Synthetic intact vehicle','deposit_received'=>'20000.00','deposit_method'=>'cash'],$token);
}}finally{\Laravel\Sanctum\PersonalAccessToken::findToken($token)?->delete();}
echo "Prepared isolated browser fixtures in $name; no live records changed.\n";
