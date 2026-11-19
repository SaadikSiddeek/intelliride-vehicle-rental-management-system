<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') throw new RuntimeException('Disposable SQLite required.');
});
it('has no submission or retry routes and does not install an outbox on fresh databases', function () {
    $this->postJson('/api/public/enquiries', [])->assertNotFound();
    $this->postJson('/api/notification_retry', [])->assertNotFound();
    $migration = require database_path('migrations/2026_11_18_160000_create_notification_outbox.php');
    $migration->up();
    expect(Schema::hasTable('notification_outbox_tb'))->toBeFalse();
    expect(class_exists(\PHPMailer\PHPMailer\PHPMailer::class))->toBeFalse();
});
it('preserves previously captured records when the retired migration is visited', function () {
    Schema::create('notification_outbox_tb', function ($table) { $table->id('ID'); $table->text('payload'); });
    DB::table('notification_outbox_tb')->insert(['payload' => 'synthetic archive']);
    $migration = require database_path('migrations/2026_11_18_160000_create_notification_outbox.php');
    $migration->up(); $migration->down();
    expect(DB::table('notification_outbox_tb')->value('payload'))->toBe('synthetic archive');
});
