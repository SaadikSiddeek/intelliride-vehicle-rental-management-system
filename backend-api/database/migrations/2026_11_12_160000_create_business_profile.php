<?php

use App\Services\BusinessProfileService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_profile_tb', function (Blueprint $t) {
            $t->unsignedInteger('ID')->primary();
            $t->json('profile');
            $t->string('logo_path')->nullable();
            $t->unsignedInteger('revision')->default(1);
            $t->unsignedBigInteger('updated_by')->nullable();
            $t->timestamps();
        });
        DB::table('business_profile_tb')->insert(['ID' => 1, 'profile' => json_encode(config('rental.company')), 'revision' => 1, 'created_at' => now(), 'updated_at' => now()]);
        Schema::create('business_profile_audit_tb', function (Blueprint $t) {
            $t->bigIncrements('ID');
            $t->unsignedInteger('revision');
            $t->json('snapshot');
            $t->unsignedBigInteger('recorded_by');
            $t->timestamps();
        });
        Schema::table('users_tb', fn (Blueprint $t) => $t->string('profile_photo_path')->nullable());
        // Preserve original business identity before any configurable branding edits.
        if (Schema::hasTable('invoice_tb')) {
            DB::table('invoice_tb')->orderBy('ID')->chunkById(100, function ($rows) {
                foreach ($rows as $r) {
                    $s = json_decode($r->snapshot, true);
                    if (! isset($s['company'])) {
                        $s['company'] = app(BusinessProfileService::class)->snapshot();
                        DB::table('invoice_tb')->where('ID', $r->ID)->update(['snapshot' => json_encode($s, JSON_THROW_ON_ERROR)]);
                    }
                }
            }, 'ID');
        }
    }

    public function down(): void
    {
        Schema::table('users_tb', fn (Blueprint $t) => $t->dropColumn('profile_photo_path'));
        Schema::dropIfExists('business_profile_audit_tb');
        Schema::dropIfExists('business_profile_tb');
    }
};
