<?php

namespace App\Services;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BusinessProfileService
{
    public function current(): array
    {
        $row = Schema::hasTable('business_profile_tb') ? DB::table('business_profile_tb')->where('ID', 1)->first() : null;

        return ['profile' => array_replace(config('rental.company'), $row ? json_decode($row->profile, true) : []), 'logo_path' => $row->logo_path ?? null, 'revision' => $row->revision ?? 1];
    }

    public function snapshot(): array
    {
        $v = $this->current();

        return [...$v['profile'], 'currency' => 'LKR', 'logo_data' => $this->logoData($v['logo_path'])];
    }

    public function policy(): array
    {
        return array_replace(config('rental.return_policy'), $this->current()['profile']['return_policy'] ?? []);
    }

    public function logoData(?string $path): ?string
    {
        $disk = Storage::disk('business_assets');
        $bytes = $path && $disk->exists($path) ? $disk->get($path) : null;
        if (! $bytes) {
            $asset = resource_path('images/intelliride-wordmark.webp');
            $bytes = is_file($asset) ? file_get_contents($asset) : null;
        }
        if (! $bytes || ! $this->imageProcessingAvailable()) {
            return null;
        }
        $image = @imagecreatefromstring($bytes);
        if (! $image) {
            return null;
        }ob_start();
        imagepng($image);
        $png = ob_get_clean();
        imagedestroy($image);

        return 'data:image/png;base64,'.base64_encode($png);
    }

    public function logoDimensions(?string $data, int $width, int $height): array
    {
        $size = $data ? @getimagesizefromstring(base64_decode(explode(',', $data, 2)[1] ?? '')) : false;
        if (! $size) {
            return ['width' => 0, 'height' => 0];
        }$scale = min($width / $size[0], $height / $size[1], 1);

        return ['width' => round($size[0] * $scale, 2), 'height' => round($size[1] * $scale, 2)];
    }

    public function imageProcessingAvailable(): bool
    {
        return extension_loaded('gd') && function_exists('imagecreatefromstring') && function_exists('imagecreatetruecolor') && function_exists('imagepng');
    }

    public function storeImage($file, string $folder, bool $avatar = false): string
    {
        if (! $this->imageProcessingAvailable()) {
            throw new HttpResponseException(response()->json([
                'status' => false, 'error_code' => 'IMAGE_PROCESSING_UNAVAILABLE',
                'message' => 'Image uploads are temporarily unavailable. Contact your administrator.',
            ], 503));
        }
        $source = @imagecreatefromstring(file_get_contents($file->getRealPath()));
        if (! $source) {
            throw ValidationException::withMessages([($avatar ? 'image' : 'logo') => 'Image content could not be decoded.']);
        }
        $w = imagesx($source);
        $h = imagesy($source);
        $scale = min(1, ($avatar ? 512 : 1200) / max($w, $h));
        $out = imagecreatetruecolor(max(1, (int) round($w * $scale)), max(1, (int) round($h * $scale)));
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
        imagecopyresampled($out, $source, 0, 0, 0, 0, imagesx($out), imagesy($out), $w, $h);
        ob_start();
        imagepng($out);
        $bytes = ob_get_clean();
        imagedestroy($source);
        imagedestroy($out);
        $path = $folder.'/'.Str::uuid().'.png';
        if (! Storage::disk('business_assets')->put($path, $bytes)) {
            throw new \RuntimeException('Image storage failed.');
        }

        return $path;
    }
}
