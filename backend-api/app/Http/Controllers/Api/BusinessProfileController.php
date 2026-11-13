<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BusinessProfileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BusinessProfileController extends Controller
{
    private function admin(Request $r): void
    {
        abort_unless($r->user()?->can_manage_business, 403, 'Administrator access is required.');
    }

    public function show(Request $r, BusinessProfileService $service)
    {
        $this->admin($r);
        $v = $service->current();

        return response()->json(['status' => true, 'data' => [...$v['profile'], 'revision' => $v['revision'], 'logo_data' => $service->logoData($v['logo_path']), 'has_custom_logo' => (bool) $v['logo_path'], 'logo_missing' => (bool) $v['logo_path'] && ! Storage::disk('business_assets')->exists($v['logo_path']), 'return_policy' => $service->policy()]])->header('Cache-Control', 'private, no-store');
    }

    public function branding(Request $r, BusinessProfileService $service)
    {
        abort_unless($r->user()?->status, 403);
        $v = $service->current();

        return response()->json(['status' => true, 'data' => ['name' => $v['profile']['display_name'] ?? $v['profile']['name'], 'logo_data' => $service->logoData($v['logo_path']), 'custom' => (bool) $v['logo_path']]])->header('Cache-Control', 'private, no-store');
    }

    public function save(Request $r, BusinessProfileService $service)
    {
        $this->admin($r);
        $data = $r->validate(['revision' => ['required', 'integer', 'min:1'], 'name' => ['required', 'string', 'max:120'], 'display_name' => ['nullable', 'string', 'max:120'], 'address' => ['nullable', 'string', 'max:500'], 'phone' => ['nullable', 'string', 'max:40'], 'email' => ['nullable', 'email', 'max:150'], 'website' => ['nullable', 'url:http,https', 'max:250'], 'registration_number' => ['nullable', 'string', 'max:100'], 'tax_identifier' => ['nullable', 'string', 'max:100'], 'invoice_notes' => ['nullable', 'string', 'max:1000'], 'currency' => ['required', Rule::in(['LKR'])], 'reset_logo' => ['sometimes', 'boolean'], 'logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048', 'dimensions:min_width=32,min_height=32,max_width=4096,max_height=4096'], 'grace_minutes' => ['required', 'integer', 'between:0,1440'], 'daily_hourly_basis_points' => ['required', 'integer', 'between:0,10000'], 'weekly_monthly_hourly_rate' => ['nullable', 'regex:/^\d{1,8}(\.\d{1,2})?$/'], 'weekly_monthly_24h_cap' => ['nullable', 'regex:/^\d{1,8}(\.\d{1,2})?$/'], 'fuel_price_per_litre' => ['nullable', 'regex:/^\d{1,8}(\.\d{1,2})?$/'], 'fuel_service_charge' => ['required', 'regex:/^\d{1,8}(\.\d{1,2})?$/']]);
        if ($r->hasFile('logo') && $r->boolean('reset_logo')) {
            throw ValidationException::withMessages(['logo' => 'Choose a new logo or reset to default, not both.']);
        }
        $new = $r->hasFile('logo') ? $service->storeImage($r->file('logo'), 'logos') : null;
        try {
            DB::transaction(function () use ($r, $data, $new) {
                $row = DB::table('business_profile_tb')->where('ID', 1)->lockForUpdate()->first();
                if (! $row || (int) $row->revision !== (int) $data['revision']) {
                    throw ValidationException::withMessages(['revision' => 'Settings changed. Reload before saving.']);
                }$profile = collect($data)->except(['revision', 'logo', 'reset_logo', 'grace_minutes', 'daily_hourly_basis_points', 'weekly_monthly_hourly_rate', 'weekly_monthly_24h_cap', 'fuel_price_per_litre', 'fuel_service_charge'])->all();
                $profile['return_policy'] = array_replace(config('rental.return_policy'), collect($data)->only(['grace_minutes', 'daily_hourly_basis_points', 'weekly_monthly_hourly_rate', 'weekly_monthly_24h_cap', 'fuel_price_per_litre', 'fuel_service_charge'])->all());
                $logo = $new ?? ($r->boolean('reset_logo') ? null : $row->logo_path);
                DB::table('business_profile_audit_tb')->insert(['revision' => $row->revision, 'snapshot' => json_encode(['profile' => json_decode($row->profile, true), 'logo_path' => $row->logo_path]), 'recorded_by' => $r->user()->getAuthIdentifier(), 'created_at' => now(), 'updated_at' => now()]);
                DB::table('business_profile_tb')->where('ID', 1)->update(['profile' => json_encode($profile, JSON_THROW_ON_ERROR), 'logo_path' => $logo, 'revision' => $row->revision + 1, 'updated_by' => $r->user()->getAuthIdentifier(), 'updated_at' => now()]);
            });
        } catch (\Throwable $e) {
            if ($new) {
                Storage::disk('business_assets')->delete($new);
            }throw $e;
        }

        // Immutable logo files are retained for historical documents/audit.
        return $this->show($r, $service);
    }
}
