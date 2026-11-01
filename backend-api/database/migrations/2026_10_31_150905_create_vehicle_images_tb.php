<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Match the foreign key to the actual vehicle_tb.ID type.
        $primaryKey = DB::selectOne(
            'SELECT DATA_TYPE AS data_type, COLUMN_TYPE AS column_type
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND COLUMN_NAME = ?',
            ['vehicle_tb', 'ID']
        );

        if (!$primaryKey) {
            throw new RuntimeException('vehicle_tb.ID was not found.');
        }

        $integerTypes = [
            'tinyint' => 'tinyInteger',
            'smallint' => 'smallInteger',
            'mediumint' => 'mediumInteger',
            'int' => 'integer',
            'bigint' => 'bigInteger',
        ];

        $type = $integerTypes[$primaryKey->data_type] ?? null;

        if (!$type) {
            throw new RuntimeException(
                'vehicle_tb.ID must be an integer primary key.'
            );
        }

        $unsigned = str_contains(
            strtolower($primaryKey->column_type),
            'unsigned'
        );

        Schema::create('vehicle_images_tb', function (Blueprint $table) use (
            $type,
            $unsigned
        ) {
            $table->bigIncrements('ID');

            $table->{$type}('vehicle_id')->unsigned($unsigned);

            $table->string('path', 255)->unique();
            $table->timestamps();

            $table->foreign('vehicle_id')
                ->references('ID')
                ->on('vehicle_tb')
                ->onDelete('cascade');
        });

        // IMAGE FUNCTIONALITY:
        // Preserve any existing JSON image references.
        if (Schema::hasColumn('vehicle_tb', 'vehicle_image')) {
            DB::table('vehicle_tb')
                ->select(['ID', 'vehicle_image'])
                ->chunkById(200, function ($vehicles) {
                    foreach ($vehicles as $vehicle) {
                        $images = $vehicle->vehicle_image
                            ? json_decode(
                                $vehicle->vehicle_image,
                                true,
                                512,
                                JSON_THROW_ON_ERROR
                            )
                            : [];

                        if (!is_array($images)) {
                            throw new RuntimeException(
                                'Invalid image metadata for vehicle '
                                    . $vehicle->ID
                            );
                        }

                        foreach ($images as $image) {
                            if (
                                !is_array($image) ||
                                empty($image['path']) ||
                                !is_string($image['path'])
                            ) {
                                throw new RuntimeException(
                                    'Invalid image path for vehicle '
                                        . $vehicle->ID
                                );
                            }

                            DB::table('vehicle_images_tb')->insert([
                                'vehicle_id' => $vehicle->ID,
                                'path' => $image['path'],
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                        }
                    }
                }, 'ID');

            // Remove the old column after its references are copied.
            Schema::table('vehicle_tb', function (Blueprint $table) {
                $table->dropColumn('vehicle_image');
            });
        }
    }

    public function down(): void
    {
        // Restore JSON references if this migration is rolled back.
        Schema::table('vehicle_tb', function (Blueprint $table) {
            $table->json('vehicle_image')->nullable();
        });

        DB::table('vehicle_tb')
            ->select('ID')
            ->chunkById(200, function ($vehicles) {
                foreach ($vehicles as $vehicle) {
                    $images = DB::table('vehicle_images_tb')
                        ->where('vehicle_id', $vehicle->ID)
                        ->orderBy('ID')
                        ->get(['ID', 'path'])
                        ->map(fn($image) => [
                            'ID' => (string) $image->ID,
                            'path' => $image->path,
                        ])
                        ->all();

                    DB::table('vehicle_tb')
                        ->where('ID', $vehicle->ID)
                        ->update([
                            'vehicle_image' => json_encode(
                                $images,
                                JSON_THROW_ON_ERROR
                            ),
                        ]);
                }
            }, 'ID');

        Schema::dropIfExists('vehicle_images_tb');
    }
};
