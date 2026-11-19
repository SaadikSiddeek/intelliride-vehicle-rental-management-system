<?php

namespace App\Http\Middleware;

use App\Helpers\Helpers;
use App\Services\CodeGenerator;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EncryptedIdentifiers
{
    private function identifier(string $key): bool
    {
        return in_array($key, ['ID', 'id', 'upd_id', 'created_by', 'updated_by', 'recorded_by', 'received_by', 'actor_user_id', 'target_user_id', 'branch', 'category', 'brand', 'model', 'designation', 'department', 'fuel_type', 'transmission'], true) || str_ends_with($key, '_id');
    }

    private function decode($value, string $key = '')
    {
        if ($key === 'features' && is_string($value) && str_starts_with($value, '[')) {
            $features = json_decode($value, true);
            if (is_array($features)) return json_encode($this->decode($features, 'features'));
        }
        if (is_array($value)) {
            foreach ($value as $name => $item) $value[$name] = $this->decode($item, is_int($name) ? $key : $name);
            return $value;
        }
        if (($this->identifier($key) || str_ends_with($key, '_ids') || $key === 'features') && is_string($value) && str_starts_with($value, 'ir1.')) return Helpers::decryptVal($value);
        return $value;
    }

    private function encode($value, string $key = '')
    {
        if (is_array($value)) {
            foreach (['booking_id' => 'booking', 'rental_id' => 'rental', 'invoice_id' => 'invoice'] as $field => $type) {
                if (isset($value[$field]) && ctype_digit((string) $value[$field])) $value[$type.'_number'] ??= CodeGenerator::reference($type, $value[$field]);
            }
            if (isset($value['id'], $value['pickup_at'], $value['status'])) $value['booking_code'] ??= CodeGenerator::reference('booking', $value['id']);
            if (isset($value['ID'], $value['rental_snapshot'])) $value['rental_number'] ??= CodeGenerator::reference('rental', $value['ID']);
            foreach ($value as $name => $item) $value[$name] = $this->encode($item, is_int($name) ? $key : $name);
            return $value;
        }
        if (($this->identifier($key) || in_array($key, ['features', 'feature_ids', 'remove_images', 'removed_image_ids'], true)) && (is_int($value) || is_string($value)) && ctype_digit((string) $value) && (int) $value > 0) return Helpers::encryptVal($value);
        // Preserve existing public image routes while hiding their numeric folder suffix.
        if (is_string($value) && preg_match('#/(registered-vehicle-images|vehicle-brand-images)/#', $value)) {
            return preg_replace_callback('#(/(?:registered-vehicle-images|vehicle-brand-images)/[a-z0-9-]+_)([1-9][0-9]*)(/)#', fn ($match) => $match[1].Helpers::encryptVal($match[2]).$match[3], $value);
        }
        // Dashboard links contain identifiers in their query, not document references.
        if (is_string($value) && str_starts_with($value, '/') && str_contains($value, '?open=')) {
            return preg_replace_callback('/([?&]open=)([1-9][0-9]*)/', fn ($match) => $match[1].Helpers::encryptVal($match[2]), $value);
        }
        return $value;
    }

    public function handle(Request $request, Closure $next)
    {
        $request->query->replace($this->decode($request->query->all()));
        $request->request->replace($this->decode($request->request->all()));
        if ($request->isJson()) $request->json()->replace($this->decode($request->json()->all()));
        foreach ($request->route()?->parameters() ?? [] as $name => $value) {
            if (is_string($value) && str_starts_with($value, 'ir1.')) $request->route()->setParameter($name, Helpers::decryptVal($value));
            elseif ($name === 'folder' && is_string($value) && preg_match('/^([a-z0-9-]+_)(ir1\..+)$/', $value, $parts)) $request->route()->setParameter($name, $parts[1].Helpers::decryptVal($parts[2]));
        }
        $response = $next($request);
        if ($request->header('X-IntelliRide-Identifiers') === 'encrypted-v1' && $response instanceof JsonResponse && $response->isSuccessful()) {
            $body = $response->getData(true);
            if ($request->is('api/fetch_booking_data') && isset($body['data']['ID'])) $body['data']['booking_code'] = CodeGenerator::reference('booking', $body['data']['ID']);
            $response->setData($this->encode($body));
            $response->headers->set('Vary', 'X-IntelliRide-Identifiers');
            $response->headers->set('Cache-Control', 'private, no-store');
        }
        return $response;
    }
}
