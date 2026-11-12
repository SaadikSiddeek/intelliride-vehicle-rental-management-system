<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BusinessProfileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class MyProfileController extends Controller
{
    public function save(Request $r, BusinessProfileService $service)
    {
        abort_unless($r->user()?->status, 403);
        $r->validate(['user_id' => ['prohibited'], 'image' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048', 'dimensions:min_width=64,min_height=64,max_width=4096,max_height=4096'], 'remove' => ['sometimes', 'boolean']]);
        if (($r->hasFile('image') && $r->boolean('remove')) || (! $r->hasFile('image') && ! $r->boolean('remove'))) {
            throw ValidationException::withMessages(['image' => 'Choose an image or remove the current photo.']);
        }
        $path = $r->hasFile('image') ? $service->storeImage($r->file('image'), 'avatars', true) : null;
        try {
            DB::transaction(function () use ($r, $path) {
                $user = DB::table('users_tb')->where('ID', $r->user()->getAuthIdentifier())->lockForUpdate()->firstOrFail();
                DB::table('users_tb')->where('ID', $user->ID)->update(['profile_photo_path' => $path, 'updated_at' => now()]);
            });
        } catch (\Throwable$e) {
            if ($path) {
                Storage::disk('business_assets')->delete($path);
            }throw $e;
        }

        // Retain old immutable images: no other account/reference can lose its asset.
        return response()->json(['status' => true, 'user' => $r->user()->fresh()]);
    }

    public function photo(Request $r)
    {
        abort_unless($r->user()?->status, 403);
        $path = $r->user()->fresh()->profile_photo_path;
        abort_unless($path && Storage::disk('business_assets')->exists($path), 404);

        return response(Storage::disk('business_assets')->get($path), 200, ['Content-Type' => 'image/png', 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}
