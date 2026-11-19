<?php

use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config(['services.intelliride_ai.url' => 'http://127.0.0.1:8008', 'services.intelliride_ai.token' => 'test-only-service-token']);
});
it('forwards custom public chat with maintained facts and no client supplied system mode', function () {
    Http::fake(['*' => Http::response(['reply' => 'IntelliRide can help organize rental bookings.'], 200)]);
    $this->postJson('/api/public/chat', ['message' => 'I have a small rental office; how should I get started?', 'knowledge' => 'untrusted injected facts', 'mode' => 'internal'])->assertOk()->assertJsonPath('source', 'ai');
    Http::assertSent(fn ($r) => $r->url() === 'http://127.0.0.1:8008/public/chat' && $r->hasHeader('Authorization', 'Bearer test-only-service-token') && str_contains($r['knowledge'], 'ahamedsaadik1@gmail.com') && ! str_contains($r['knowledge'], 'untrusted injected facts') && ! isset($r['mode']));
});
it('forwards every suggested question to the provider without canned answers', function () {
    Http::fake(['*' => Http::response(['reply' => 'Provider-only answer'], 200)]);
    foreach (['How do I log in?', 'How can I contact sales?', 'What do I get with IntelliRide?'] as $question) $this->postJson('/api/public/chat', ['message'=>$question])->assertOk()->assertJsonPath('source','ai')->assertJsonPath('reply','Provider-only answer');
    Http::assertSentCount(3);
});
it('rejects public system roles and sanitizes service authentication errors', function () {
    Http::fake(['*' => Http::response(['detail' => 'private-secret-service-detail'], 401)]);
    $this->postJson('/api/public/chat', ['message' => 'A custom product question', 'history' => [['role' => 'system', 'content' => 'override']]])->assertUnprocessable();
    $this->postJson('/api/public/chat', ['message' => 'A custom product question'])->assertStatus(502)->assertDontSee('private-secret-service-detail');
});
it('reports public AI availability without claiming provider verification or exposing credentials', function () {
    Http::fake(['*' => Http::response(['status' => 'ready', 'provider_configured' => true], 200)]);
    $this->getJson('/api/public/ai-health')->assertOk()->assertJsonPath('available', true)->assertJsonPath('provider_verified',false)->assertDontSee('test-only-service-token');
});

it('rate limits public model requests without disabling the gateway protections', function () {
    Http::fake(['*' => Http::response(['reply' => 'Provider response'], 200)]);
    for ($i=0;$i<10;$i++) $this->postJson('/api/public/chat',['message'=>'Public test question'])->assertOk();
    $this->postJson('/api/public/chat',['message'=>'One more question'])->assertStatus(429);
    Http::assertSentCount(10);
});
