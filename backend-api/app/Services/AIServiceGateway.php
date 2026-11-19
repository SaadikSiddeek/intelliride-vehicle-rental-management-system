<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class AIServiceGateway
{
    public function forward(string $path, ?array $payload = null)
    {
        abort_unless(in_array($path, ['health', 'chat', 'public/chat'], true), 500);
        $token = config('services.intelliride_ai.token');
        $url = rtrim((string) config('services.intelliride_ai.url'), '/');
        if (! $token || ! $url) {
            return response()->json(['message' => 'The AI service is not configured.'], 503);
        }
        try {
            $client = Http::acceptJson()->withToken($token)->connectTimeout(3)->timeout($path === 'health' ? 5 : 40);
            $response = $payload === null ? $client->get($url.'/'.$path) : $client->post($url.'/'.$path, $payload);
        } catch (ConnectionException) {
            return response()->json(['message' => 'The AI service is unavailable. Start it and retry.'], 503);
        }
        if (! $response->successful()) {
            $status = in_array($response->status(), [429, 503, 504]) ? $response->status() : 502;
            $message = match ($status) {
                429 => 'The assistant is busy. Wait a moment and retry.',
                504 => 'The assistant took too long. Please retry.',
                default => 'The assistant could not respond. Check the AI service and retry.',
            };

            return response()->json(['message' => $message], $status);
        }
        if ($path === 'health') {
            return response()->json([
                'available' => $response->json('status') === 'ready',
                'provider_configured' => $response->json('provider_configured') === true,
                'provider_verified' => false,
            ])->header('Cache-Control', 'private, no-store');
        }
        $reply = $response->json('reply');
        if (! is_string($reply) || trim($reply) === '') {
            return response()->json(['message' => 'The assistant returned an invalid response. Please retry.'], 502);
        }

        return response()->json(['reply' => $reply])->header('Cache-Control', 'private, no-store');
    }
}
