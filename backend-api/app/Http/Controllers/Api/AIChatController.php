<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AIChatController extends Controller
{
    public function health()
    {
        return $this->forward('health');
    }

    public function chat(Request $request)
    {
        $payload = $request->validate([
            'message' => ['required', 'string', 'max:6000', 'regex:/\S/u'],
            'history' => ['sometimes', 'array', 'max:20'],
            'history.*' => ['required', 'array:role,content'],
            'history.*.role' => ['required', Rule::in(['user', 'assistant'])],
            'history.*.content' => ['required', 'string', 'max:6000', 'regex:/\S/u'],
        ]);
        $history = $payload['history'] ?? [];
        abort_if(count($history) % 2 !== 0, 422, 'History must contain complete conversation turns.');
        foreach ($history as $index => $turn) {
            abort_if($turn['role'] !== ($index % 2 === 0 ? 'user' : 'assistant'), 422, 'History order is invalid.');
        }
        $size = mb_strlen($payload['message']) + collect($payload['history'] ?? [])->sum(fn($turn) => mb_strlen($turn['content']));
        abort_if($size > 24000, 422, 'Conversation is too long. Start a new chat.');
        return $this->forward('chat', $payload);
    }

    private function forward(string $path, ?array $payload = null)
    {
        return app(\App\Services\AIServiceGateway::class)->forward($path, $payload);
    }
}
