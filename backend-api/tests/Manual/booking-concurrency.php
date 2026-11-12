<?php

// Run explicitly against local MySQL after applying the Booking migration.
// Credentials are read from stdin; never saved. Uses only the named synthetic
// customer/package from browser verification, leaving one cancelled test booking.
$root = dirname(__DIR__, 2);
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

function api($kernel, string $route, array $data, ?string $token = null): array
{
    // A fresh guard per request reproduces independent HTTP authentication.
    app('auth')->forgetGuards();
    $headers = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];
    if ($token) $headers['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
    $request = Request::create('/api/'.$route, 'POST', [], [], [], $headers, json_encode($data));
    $response = $kernel->handle($request);
    $result = ['status' => $response->getStatusCode(), 'body' => json_decode($response->getContent(), true)];
    $kernel->terminate($request, $response);
    return $result;
}

$input = json_decode(trim(fgets(STDIN)), true, 512, JSON_THROW_ON_ERROR);
if (($argv[1] ?? '') === '--worker') {
    while (microtime(true) < $input['start']) usleep(10000);
    // Hold the actual vehicle lock briefly to ensure the two transactions contend.
    DB::listen(function ($query) {
        if (str_contains($query->sql, '`vehicle_tb`') && str_contains($query->sql, 'for update')) usleep(400000);
    });
    $start = microtime(true);
    $result = api($kernel, 'save_booking', $input['payload'], $input['token']);
    echo json_encode(['status' => $result['status'], 'id' => $result['body']['data']['ID'] ?? null,
        'vehicle_error' => isset($result['body']['errors']['vehicle_id']), 'elapsed_ms' => round((microtime(true) - $start) * 1000)]);
    exit;
}

if (DB::connection()->getDriverName() !== 'mysql' || !app()->environment('local')) {
    throw new RuntimeException('Run this explicit smoke check only against local MySQL.');
}
$customer = DB::table('customer_tb')->where('full_name', 'CODEX TEST CUSTOMER 2026-11-11')->where('status', 'Inactive')->first();
$package = DB::table('rental_package_tb')->where('package_name', 'CODEX TEST PACKAGE 2026-11-11')->where('status', 0)->first();
if (!$customer || !$package) throw new RuntimeException('Expected inactive synthetic browser fixtures are missing.');
$vehicle = DB::table('vehicle_tb')->where('ID', $package->vehicle_id)->where('status', 'Available')->first();
if (!$vehicle) throw new RuntimeException('The synthetic package vehicle is not available.');
$login = api($kernel, 'login', $input);
unset($input);
if ($login['status'] !== 200 || empty($login['body']['token'])) throw new RuntimeException('Local sign-in failed.');
$token = $login['body']['token'];
unset($login);
$bookingId = null;
$processes = [];
try {
    DB::table('customer_tb')->where('ID', $customer->ID)->update(['status' => 'Active']);
    DB::table('rental_package_tb')->where('ID', $package->ID)->update(['status' => 1]);
    $pickup = now('Asia/Colombo')->addDays(30)->setTime(10, 0);
    $payload = ['customer_id' => $customer->ID, 'vehicle_id' => $vehicle->ID, 'package_id' => $package->ID,
        'pickup_branch_id' => $vehicle->branch_id, 'return_branch_id' => $vehicle->branch_id,
        'pickup_at' => $pickup->format('Y-m-d\TH:i'), 'expected_return_at' => $pickup->copy()->addDay()->format('Y-m-d\TH:i'),
        'status' => 'Confirmed', 'advance_amount' => '0.00', 'discount' => '0.00', 'extras' => [],
        'notes' => 'CODEX CONCURRENCY TEST: simultaneous reservation verification; cancel after test.'];
    $start = microtime(true) + 2;
    for ($i = 0; $i < 2; $i++) {
        $pipes = [];
        $process = proc_open([PHP_BINARY, __FILE__, '--worker'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $root);
        if (!is_resource($process)) throw new RuntimeException('Could not start confirmation worker.');
        fwrite($pipes[0], json_encode(['token' => $token, 'payload' => $payload, 'start' => $start])."\n");
        fclose($pipes[0]);
        $processes[] = [$process, $pipes];
    }
    $results = [];
    foreach ($processes as [$process, $pipes]) {
        $output = stream_get_contents($pipes[1]);
        $errors = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        if (proc_close($process) !== 0) throw new RuntimeException('Confirmation worker failed: '.$errors);
        $result = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
        if ($result['id']) $bookingId = $result['id'];
        $results[] = $result;
    }
    $statuses = array_column($results, 'status'); sort($statuses);
    if ($statuses !== [201, 422] || !in_array(true, array_column($results, 'vehicle_error'), true)) {
        throw new RuntimeException('Expected exactly one successful confirmation and one availability rejection: '.json_encode($results));
    }
    $summary = ['result' => 'passed', 'workers' => $results, 'test_booking_id' => $bookingId];
} finally {
    // Preserve every row, including the test's history. Restore only known test fixtures.
    if ($bookingId) {
        $cancel = api($kernel, 'booking_status', ['upd_id' => $bookingId, 'status' => 'Cancelled'], $token);
        if ($cancel['status'] !== 200) throw new RuntimeException('Test booking cancellation failed; inspect booking '.$bookingId);
    }
    DB::table('customer_tb')->where('ID', $customer->ID)->update(['status' => 'Inactive']);
    DB::table('rental_package_tb')->where('ID', $package->ID)->update(['status' => 0]);
    api($kernel, 'logout', [], $token);
}

echo json_encode($summary, JSON_PRETTY_PRINT)."\n";
