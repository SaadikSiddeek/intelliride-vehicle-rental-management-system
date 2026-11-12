<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Match the actual MySQL type of vehicle_tb.ID.
        // This supports both increments('ID') and bigIncrements('ID').
        $vehicleKey = DB::getDriverName() === 'sqlite'
            ? (Schema::hasColumn('vehicle_tb', 'ID') ? (object) ['data_type' => 'bigint', 'column_type' => 'bigint unsigned'] : null)
            : DB::selectOne(
            'SELECT DATA_TYPE AS data_type, COLUMN_TYPE AS column_type
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND COLUMN_NAME = ?',
            ['vehicle_tb', 'ID']
        );

        if (!$vehicleKey) {
            throw new RuntimeException('Create vehicle_tb before rental_package_tb.');
        }

        $integerTypes = [
            'tinyint' => 'tinyInteger',
            'smallint' => 'smallInteger',
            'mediumint' => 'mediumInteger',
            'int' => 'integer',
            'bigint' => 'bigInteger',
        ];

        $method = $integerTypes[strtolower($vehicleKey->data_type)] ?? null;

        if (!$method) {
            throw new RuntimeException('vehicle_tb.ID must be an integer column.');
        }

        $unsigned = str_contains(strtolower($vehicleKey->column_type), 'unsigned');

        Schema::create('rental_package_tb', function (Blueprint $table) use ($method, $unsigned) {
            $table->bigIncrements('ID');
            $table->{$method}('vehicle_id')->unsigned($unsigned);

            $table->string('package_name', 100);
            $table->enum('billing_unit', ['day', 'week', 'month']);
            $table->decimal('rate_per_unit', 12, 2);

            // NULL = unlimited kilometres. Zero = no kilometres included.
            $table->unsignedInteger('included_km_per_unit')->nullable();
            $table->decimal('extra_km_charge', 12, 2)->default(0);

            $table->decimal('security_deposit', 12, 2)->default(0);
            $table->unsignedInteger('minimum_units')->default(1);
            $table->boolean('status')->default(true);
            $table->timestamps();

            $table->unique(
                ['vehicle_id', 'package_name'],
                'rental_package_vehicle_name_unique'
            );

            $table->index(['vehicle_id', 'status']);

            $table->foreign('vehicle_id')
                ->references('ID')
                ->on('vehicle_tb')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_package_tb');
    }
};
