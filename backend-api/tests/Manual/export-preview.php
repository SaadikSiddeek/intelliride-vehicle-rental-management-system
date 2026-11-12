<?php
$root=dirname(__DIR__,2);require $root.'/vendor/autoload.php';$app=require $root.'/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$database=$argv[1]??'';$output=$argv[2]??'';if(!preg_match('/^intelliride_codex_returns_\d{8}_[a-f0-9]{8}$/D',$database)||!app()->environment('local'))throw new RuntimeException('Synthetic schema only.');
config(['database.connections.mysql.database'=>$database,'customer_access.users'=>['701','702']]);\Illuminate\Support\Facades\DB::purge('mysql');$user=\App\Models\User::findOrFail(702);
$request=\Illuminate\Http\Request::create('/api/export_report','POST',['type'=>'financial','format'=>'pdf','from'=>now('Asia/Colombo')->startOfMonth()->toDateString(),'to'=>now('Asia/Colombo')->toDateString()]);$request->setUserResolver(fn()=>$user);
$response=app(\App\Http\Controllers\Api\ReportController::class)->export($request,app(\App\Services\ReportService::class),app(\App\Services\ReportExportService::class));
if(!is_dir($output))mkdir($output,0700,true);file_put_contents($output.'/intelliride-financial-report.pdf',$response->getContent());echo 'Financial report PDF generated from synthetic data.';

$invoiceRequest=\Illuminate\Http\Request::create('/api/invoice_output','POST',['invoice_id'=>(int)($argv[3]??2),'format'=>'pdf']);$invoiceRequest->setUserResolver(fn()=>$user);$invoiceResponse=app(\App\Http\Controllers\Api\InvoiceOutputController::class)->output($invoiceRequest,app(\App\Services\FinanceService::class));file_put_contents($output.'/intelliride-landscape-invoice.pdf',$invoiceResponse->getContent());echo " Landscape invoice PDF generated from synthetic data.\n";
