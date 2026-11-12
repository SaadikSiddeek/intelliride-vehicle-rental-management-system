<?php

use App\Models\Customer;
use App\Models\CustomerDocument;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    // Never migrate or reset the user's MySQL database from this suite.
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') {
        throw new RuntimeException('Customer tests require an isolated SQLite :memory: database.');
    }
    (require database_path('migrations/2026_11_11_071730_create_customer_tables.php'))->up();
    Storage::fake('customer_documents');
    config(['customer_access.users' => ['701']]);
    Sanctum::actingAs((new User)->forceFill(['ID' => 701, 'status' => true]));
});

function customerPayload(array $changes = []): array
{
    return array_replace([
        'customer_type' => 'Local', 'full_name' => 'Test Customer',
        'mobile' => '+94 77 123 4567', 'email' => 'customer@example.test',
        'status' => 'Active',
    ], $changes);
}

test('customer create fetch update filter and deactivate preserve the record', function () {
    $id = $this->postJson('/api/save_customer', customerPayload())
        ->assertCreated()->assertJsonPath('status', true)->json('data.ID');
    $this->postJson('/api/fetch_customer_data', ['upd_id' => $id])
        ->assertOk()->assertJsonPath('data.full_name', 'Test Customer')
        ->assertJsonPath('data.customer_code', 'CUS-000001');
    $this->postJson('/api/get_customers', ['q' => 'Customer', 'status' => 'Active'])
        ->assertOk()->assertJsonCount(1, 'data');
    $this->postJson('/api/customer_filter', ['q' => '123'])
        ->assertOk()->assertJsonPath('success', true)->assertJsonCount(1, 'data');
    $this->postJson('/api/save_customer', customerPayload(['upd_id' => $id, 'full_name' => 'Updated Customer', 'status' => 'Inactive']))
        ->assertOk();
    expect(Customer::findOrFail($id)->full_name)->toBe('Updated Customer');
    $this->postJson('/api/customer_filter')->assertOk()->assertJsonCount(0, 'data');
    $this->postJson('/api/get_customers', ['status' => 'Inactive'])->assertOk()->assertJsonCount(1, 'data');
    expect(Customer::count())->toBe(1);
});

test('customer access is denied outside the explicit allowlist', function () {
    config(['customer_access.users' => []]);
    foreach (['save_customer', 'get_customers', 'fetch_customer_data', 'customer_filter'] as $route) {
        $this->postJson('/api/'.$route, customerPayload())->assertForbidden();
    }
    $this->getJson('/api/customer_documents/1')->assertForbidden();
    expect(Customer::count())->toBe(0);
});

test('customer conditional fields phones emails dates and file types are validated', function () {
    $this->postJson('/api/save_customer', customerPayload([
        'customer_type' => 'Tourist', 'status' => 'Blocked', 'mobile' => '123',
        'email' => 'invalid', 'document_expiry' => 'yesterday', 'licence_number' => 'DL123',
    ]))->assertUnprocessable()->assertJsonValidationErrors([
        'country', 'block_reason', 'mobile', 'email', 'document_type', 'document_expiry', 'licence_country',
    ]);
    $this->post('/api/save_customer', customerPayload([
        'passport' => UploadedFile::fake()->create('payload.html', 10, 'text/html'),
    ]), ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('passport');
    expect(Customer::count())->toBe(0);
});

test('customer documents remain private and support download replacement and removal', function () {
    // Valid one-pixel PNG; does not require the GD extension.
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=');
    $id = $this->post('/api/save_customer', customerPayload([
        'passport' => UploadedFile::fake()->createWithContent('passport.png', $png),
    ]), ['Accept' => 'application/json'])->assertCreated()->json('data.ID');
    $document = Customer::findOrFail($id)->documents()->firstOrFail();
    Storage::disk('customer_documents')->assertExists($document->getRawOriginal('path'));
    $this->postJson('/api/fetch_customer_data', ['upd_id' => $id])->assertOk()
        ->assertJsonPath('data.documents.passport', $document->ID);
    expect($document->toArray())->not->toHaveKey('path');
    $this->get('/api/customer_documents/'.$document->ID)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
    $this->post('/api/save_customer', customerPayload([
        'upd_id' => $id, 'passport' => UploadedFile::fake()->createWithContent('replacement.png', $png),
    ]), ['Accept' => 'application/json'])->assertOk();
    Storage::disk('customer_documents')->assertMissing($document->getRawOriginal('path'));
    $newPath = CustomerDocument::findOrFail($document->ID)->getRawOriginal('path');
    $this->postJson('/api/save_customer', customerPayload(['upd_id' => $id, 'remove' => ['passport']]))->assertOk();
    Storage::disk('customer_documents')->assertMissing($newPath);
    expect(CustomerDocument::count())->toBe(0);
    $this->getJson('/api/customer_documents/'.$document->ID)->assertNotFound();
});

test('saved licence validation rolls back invalid edits and preserves scans', function () {
    $id = $this->postJson('/api/save_customer', customerPayload(['licence_country' => 'Sri Lanka']))
        ->assertCreated()->json('data.ID');
    Storage::disk('customer_documents')->put('existing.png', 'test content');
    CustomerDocument::create(['customer_id' => $id, 'kind' => 'licence_front', 'path' => 'existing.png']);
    $this->postJson('/api/save_customer', customerPayload(['upd_id' => $id, 'full_name' => 'Must roll back']))
        ->assertUnprocessable()->assertJsonValidationErrors('licence_country');
    expect(Customer::findOrFail($id)->full_name)->toBe('Test Customer');
    Storage::disk('customer_documents')->assertExists('existing.png');
});

test('missing customer and invalid filter requests return clear errors', function () {
    $this->postJson('/api/fetch_customer_data', ['upd_id' => 999])->assertNotFound();
    $this->postJson('/api/save_customer', customerPayload(['upd_id' => 999]))->assertNotFound();
    $this->postJson('/api/get_customers', ['status' => 'unexpected'])->assertUnprocessable();
    $this->postJson('/api/customer_filter', ['id' => -1])->assertUnprocessable();
});
