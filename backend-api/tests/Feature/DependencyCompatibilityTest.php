<?php

use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Promise\Utils;
use GuzzleHttp\Psr7\Response;
use Illuminate\Support\Facades\Http;

it('supports async HTTP requests, PSR messages and promise aggregation with the security dependency set', function () {
    $mock = new MockHandler([new Response(200, ['Content-Type' => 'application/json'], '{"ok":true}'), new Response(201, ['Content-Type' => 'application/json'], '{"created":true}')]);
    $client = new Client(['handler' => HandlerStack::create($mock)]);
    $responses = Utils::all([$client->getAsync('https://isolated.example.test/status'), $client->postAsync('https://isolated.example.test/records', ['json' => ['name' => 'Synthetic'], 'headers' => ['Authorization' => 'Bearer synthetic-only']])])->wait();
    expect($responses[0]->getStatusCode())->toBe(200)->and(json_decode((string) $responses[0]->getBody(), true))->toBe(['ok' => true])->and($responses[1]->getStatusCode())->toBe(201);
});

it('preserves Laravel HTTP integration response and request handling without external traffic', function () {
    Http::preventStrayRequests();
    Http::fake(['isolated.example.test/*' => Http::response(['ok' => true], 200)]);
    $response = Http::withToken('synthetic-only')->post('https://isolated.example.test/check', ['reference' => 'Synthetic']);
    expect($response->successful())->toBeTrue()->and($response->json('ok'))->toBeTrue();
    Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer synthetic-only') && $request['reference'] === 'Synthetic');
});
