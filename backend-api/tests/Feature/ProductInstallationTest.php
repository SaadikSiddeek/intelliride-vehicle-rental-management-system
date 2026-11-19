<?php
use App\Helpers\Helpers;
use App\Models\User;
use App\Services\InstallationBranch;
use App\Services\CodeGenerator;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
beforeEach(function () {
 if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') throw new RuntimeException('Disposable SQLite only.');
 Artisan::call('migrate', ['--force'=>true]); Artisan::call('db:seed', ['--force'=>true]);
});
function productOwner() {
 DB::table('users_tb')->insert(['username'=>'preview-owner','email'=>'preview-owner@example.test','role_id'=>DB::table('roles_tb')->value('ID'),'branch_id'=>1,'password'=>Hash::make(bin2hex(random_bytes(20))),'user_type'=>'super_admin','status'=>true]);
 DB::table('authorization_state_tb')->where('ID',1)->update(['enabled'=>true]);
 Sanctum::actingAs(User::where('username','preview-owner')->firstOrFail());
}
it('serves grounded public suggestions and retains private AI authentication', function () {
 config(['services.intelliride_ai.token'=>'test-only-service-token']);
 \Illuminate\Support\Facades\Http::fake(['*'=>\Illuminate\Support\Facades\Http::response(['reply'=>'Synthetic provider response'],200)]);
 foreach (['How do I log in?','How do I purchase IntelliRide?','What is IntelliRide?','What will I get with each package?','How do IntelliRide bookings work?','Who won football?','Is airport shuttle provided?'] as $q) $this->postJson('/api/public/chat',['message'=>$q])->assertOk()->assertJsonStructure(['reply','links']);
 $this->postJson('/api/public/chat',['message'=>'   '])->assertUnprocessable();
 $this->postJson('/api/public/chat',['message'=>str_repeat('x',2001)])->assertUnprocessable();
 $this->getJson('/api/ai/health')->assertUnauthorized();
 $this->postJson('/api/ai/chat',['message'=>'Hello'])->assertUnauthorized();
 $this->getJson('/api/public/product')->assertOk()->assertJsonCount(3,'plans');
 expect(file_get_contents(resource_path('public/product.json')))->toBe(file_get_contents(base_path('../frontend/src/data/public-product.json')));
});
it('preserves singleton branch edits and prevents second branch creation', function () {
 DB::table('branch_tb')->where('ID',1)->update(['branch_name'=>'Owner edited name']);
 Artisan::call('db:seed',['--force'=>true]);
 expect(DB::table('branch_tb')->count())->toBe(1)->and(app(InstallationBranch::class)->current()->branch_name)->toBe('Owner edited name');
 productOwner();
 $this->postJson('/api/save_branch',['branch_name'=>'Second'])->assertStatus(409);
 $this->postJson('/api/delete_branch',['upd_id'=>1])->assertStatus(409);
 $this->postJson('/api/get_branches')->assertOk()->assertJsonCount(1,'data');
});
it('preserves ambiguous historical branches until the owner chooses', function () {
 DB::table('branch_tb')->insert(['branch_name'=>'Historical','branch_code'=>'HISTORY','status'=>true]);
 DB::table('installation_settings_tb')->where('ID',1)->update(['branch_id'=>null]);
 expect(fn()=>app(InstallationBranch::class)->initialize())->toThrow(\Illuminate\Validation\ValidationException::class);
 expect(DB::table('branch_tb')->count())->toBe(2);
});
it('round trips randomized opaque identifiers and rejects tampering', function () {
 productOwner(); $headers=['X-IntelliRide-Identifiers'=>'encrypted-v1'];
 $id=$this->postJson('/api/get_branches',[],$headers)->assertOk()->json('data.0.id');
 expect($id)->toStartWith('ir1.')->and(Helpers::decryptVal($id))->toBe(1);
 $next=Helpers::encryptVal(1);
 expect($next)->not->toBe($id)->and(explode('.',$next)[1])->toBe(explode('.',$id)[1]);
 $this->postJson('/api/fetch_branch_data',['upd_id'=>$id],$headers)->assertOk()->assertJsonPath('data.branch_code','SETUP');
 $this->postJson('/api/fetch_branch_data',['upd_id'=>$id.'bad'],$headers)->assertUnprocessable();
 $this->postJson('/api/save_branch',['upd_id'=>$id,'branch_name'=>'Encrypted edit','branch_code'=>'SETUP','status'=>true],$headers)->assertOk();
 $this->postJson('/api/get_branches')->assertJsonPath('data.0.id',1);
 expect(CodeGenerator::reference('booking',42))->toBe('BKG-000042')->and(CodeGenerator::reference('payment',4))->toBe('PAY-4');
});

it('decodes multipart feature arrays centrally without decrypting ordinary chat text', function () {
    $id = Helpers::encryptVal(1);
    $request = \Illuminate\Http\Request::create('/api/save_vehicle', 'POST', ['features' => json_encode([$id]), 'removed_image_ids' => [$id], 'message' => 'ir1.not-a-record-token']);
    $response = app(\App\Http\Middleware\EncryptedIdentifiers::class)->handle($request, fn ($r) => response()->json(['features' => $r->input('features'), 'removed' => $r->input('removed_image_ids'), 'message' => $r->input('message')]));
    expect($response->getData(true))->toBe(['features' => '[1]', 'removed' => [1], 'message' => 'ir1.not-a-record-token']);
});

it('keeps existing public image paths and supports encrypted folder identifiers', function () {
    \Illuminate\Support\Facades\Storage::fake('registered_vehicles');
    $path='vehicle_1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg';
    \Illuminate\Support\Facades\Storage::disk('registered_vehicles')->put($path, 'synthetic image bytes');
    DB::table('vehicle_brand_tb')->insert(['ID'=>1,'brand_name'=>'Image fixture']);
    DB::table('vehicle_model_tb')->insert(['ID'=>1,'brand_id'=>1,'fuel_type_id'=>1,'transmission_type_id'=>1,'model_name'=>'Image fixture']);
    DB::table('vehicle_tb')->insert(['ID'=>1,'vehicle_number'=>'IMAGE-FIXTURE','branch_id'=>1,'category_id'=>1,'brand_id'=>1,'model_id'=>1,'fuel_type_id'=>1,'transmission_type_id'=>1]);
    DB::table('vehicle_images_tb')->insert(['vehicle_id'=>1,'path'=>$path]);
    $this->get('/api/registered-vehicle-images/'.$path)->assertOk();
    $this->get('/api/registered-vehicle-images/vehicle_'.Helpers::encryptVal(1).'/'.basename($path))->assertOk();
});
