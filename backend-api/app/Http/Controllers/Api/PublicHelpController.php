<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AIServiceGateway;
use Illuminate\Http\Request;

class PublicHelpController extends Controller
{
    public function aiHealth()
    {
        return app(AIServiceGateway::class)->forward('health');
    }

    public function product()
    {
        return response()->json($this->knowledge())->header('Cache-Control', 'public, max-age=300');
    }

    private function knowledge(): array
    {
        return json_decode(file_get_contents(resource_path('public/product.json')), true, 512, JSON_THROW_ON_ERROR);
    }

    public function chat(Request $request)
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:2000', 'regex:/\S/u'], 'history' => ['sometimes', 'array', 'max:10'], 'history.*' => ['array:role,content'], 'history.*.role' => ['required', 'in:user,assistant'], 'history.*.content' => ['required', 'string', 'max:2000', 'regex:/\S/u']]);
        $history = $data['history'] ?? [];
        abort_if(count($history) % 2 !== 0, 422, 'Conversation history is invalid.');
        foreach ($history as $i => $turn) {
            abort_if($turn['role'] !== ($i % 2 === 0 ? 'user' : 'assistant'), 422, 'Conversation history is invalid.');
        }
        abort_if(mb_strlen($data['message']) + collect($history)->sum(fn ($turn) => mb_strlen($turn['content'])) > 12000, 422, 'Please start a new conversation.');
        $product = $this->knowledge();
        $response = app(AIServiceGateway::class)->forward('public/chat', ['message' => $data['message'], 'history' => $history, 'knowledge' => json_encode($product, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        if ($response->isSuccessful()) {
            $response->setData([...$response->getData(true), 'source' => 'ai', 'links' => [['label' => 'Sign in', 'href' => $product['login']], ['label' => 'Contact Sales', 'href' => $product['contact']]]]);
        }
        return $response;
    }
}
