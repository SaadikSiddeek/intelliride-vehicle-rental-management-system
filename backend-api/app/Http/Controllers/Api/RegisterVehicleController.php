<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RegisterVehicleController extends Controller

{

    private const TABLE = 'vehicle_tb';

    private const IMAGE_TABLE = 'vehicle_images_tb';

    private const FEATURE_MAP_TABLE = 'vehicle_feature_map_tb';

    private const IMAGE_DISK = 'registered_vehicles';

    private const MAX_IMAGES = 10;

    private const IMAGE_STORE_FAILED = 'IMAGE_STORE_FAILED';



    private const STATUSES = [

        'Available',

        'Rented',

        'Under Maintenance',

        'Out of Service',

    ];



    // Frontend field => database column.

    private const FIELD_MAP = [

        'number_plate' => 'vehicle_number',

        'category' => 'category_id',

        'brand' => 'brand_id',

        'model' => 'model_id',

        'fuel_type' => 'fuel_type_id',

        'transmission' => 'transmission_type_id',

        'manufacture_year' => 'manufacture_year',

        'color' => 'color',

        'engine_number' => 'engine_number',

        'chassis_number' => 'chassis_number',

        'mileage' => 'mileage',

        'seating_capacity' => 'seating_capacity',

        'purchase_date' => 'purchase_date',

        'purchase_price' => 'purchase_price',

        'daily_rental_rate' => 'daily_rate',

        'weekly_rental_rate' => 'weekly_rate',

        'monthly_rental_rate' => 'monthly_rate',

        'insurance_expiry_date' => 'insurance_expiry_date',

        'registration_expiry_date' => 'registration_expiry_date',

        'vehicle_status' => 'status',

    ];

    // Human readable names used in validation messages.

    private const ATTRIBUTES = [

        'number_plate' => 'vehicle number plate',
        'category' => 'category',
        'brand' => 'brand',
        'model' => 'model',
        'fuel_type' => 'fuel type',
        'transmission' => 'transmission',
        'manufacture_year' => 'manufacture year',
        'color' => 'color',
        'engine_number' => 'engine number',
        'chassis_number' => 'chassis number',
        'mileage' => 'mileage',
        'seating_capacity' => 'seating capacity',
        'purchase_date' => 'purchase date',
        'purchase_price' => 'purchase price',
        'daily_rental_rate' => 'daily rental rate',
        'weekly_rental_rate' => 'weekly rental rate',
        'monthly_rental_rate' => 'monthly rental rate',
        'insurance_expiry_date' => 'insurance expiry date',
        'registration_expiry_date' => 'registration expiry date',
        'vehicle_status' => 'vehicle status',
        'features' => 'features',
        'images' => 'images',
        'images.*' => 'image',
        'removed_image_ids' => 'removed images',
        'removed_image_ids.*' => 'removed image',
        'upd_id' => 'vehicle',

    ];



    // ================= IMAGE FUNCTIONALITY: HELPERS =================



    private function managedImagePath(?string $path): bool

    {

        return $path !== null && preg_match(

            '#\Avehicle_[1-9][0-9]*/[a-f0-9-]{36}\.(?:jpg|jpeg|png|webp)\z#D',

            $path

        ) === 1;
    }



    private function formatImage(object $image): array

    {

        return [

            'ID' => $image->ID,

            'url' => url('/api/registered-vehicle-images/' . $image->path),

        ];
    }



    private function deleteImageSafely(string $path): void

    {

        if (!$this->managedImagePath($path)) {

            return;
        }



        try {

            Storage::disk(self::IMAGE_DISK)->delete($path);
        } catch (\Throwable $th) {

            // Cleanup failures must not reverse a committed database save.

            report($th);
        }
    }

    // ================= ERROR HELPERS =================

    /**
     * Unexpected failure: log it with a reference so the exact cause can be
     * found in storage/logs/laravel.log, and tell the user the reference.
     * The raw exception text is only returned when APP_DEBUG=true.
     */
    private function serverError(\Throwable $th, string $message, string $action)
    {
        $reference = strtoupper(Str::random(8));

        report($th);
        Log::error("[{$reference}] {$action} failed: " . $th->getMessage());

        $body = [
            'status' => false,
            'message' => $message . ' (Ref: ' . $reference . ')',
            'reference' => $reference,
        ];

        if (config('app.debug')) {
            $body['debug'] = $th->getMessage();
        }

        return response()->json($body, 500);
    }

    private function extractColumn(string $message): ?string
    {
        if (preg_match("/(?:column|field)\s+([`'\w.]+)/i", $message, $match)) {
            $parts = preg_split('/[`\'.]+/', $match[1], -1, PREG_SPLIT_NO_EMPTY);

            return $parts ? end($parts) : null;
        }

        return null;
    }

    /**
     * Translate known database failures into messages the user can act on.
     * Returns null when the error is not one we recognise.
     */
    private function describeDatabaseError(QueryException $e): ?array
    {
        $code = (int) ($e->errorInfo[1] ?? 0);
        $dbMessage = (string) ($e->errorInfo[2] ?? $e->getMessage());
        $columnToField = array_flip(self::FIELD_MAP);

        // Duplicate entry (race between validation and insert).
        if ($code === 1062) {
            if (stripos($dbMessage, 'chassis') !== false) {
                return [
                    'status' => 422,
                    'message' => 'This chassis number already exists.',
                    'errors' => ['chassis_number' => ['This chassis number already exists.']],
                ];
            }

            if (stripos($dbMessage, 'vehicle_number') !== false) {
                return [
                    'status' => 422,
                    'message' => 'This vehicle number plate already exists.',
                    'errors' => ['number_plate' => ['This vehicle number plate already exists.']],
                ];
            }

            return [
                'status' => 422,
                'message' => 'A record with the same unique value already exists.',
                'errors' => [],
            ];
        }

        // Required column is empty / has no default.
        if (in_array($code, [1048, 1364], true)) {
            $column = $this->extractColumn($dbMessage);
            $field = $column !== null ? ($columnToField[$column] ?? null) : null;
            $label = $field ? (self::ATTRIBUTES[$field] ?? $field) : ($column ?? 'A field');
            $message = ucfirst($label) . ' is required.';

            return [
                'status' => 422,
                'message' => $message,
                'errors' => $field ? [$field => [$message]] : [],
            ];
        }

        // Value too long.
        if ($code === 1406) {
            $column = $this->extractColumn($dbMessage);
            $field = $column !== null ? ($columnToField[$column] ?? null) : null;
            $label = $field ? (self::ATTRIBUTES[$field] ?? $field) : ($column ?? 'A field');
            $message = ucfirst($label) . ' is too long.';

            return [
                'status' => 422,
                'message' => $message,
                'errors' => $field ? [$field => [$message]] : [],
            ];
        }

        // Out of range / incorrect value.
        if (in_array($code, [1264, 1265, 1292, 1366], true)) {
            $column = $this->extractColumn($dbMessage);
            $field = $column !== null ? ($columnToField[$column] ?? null) : null;
            $label = $field ? (self::ATTRIBUTES[$field] ?? $field) : ($column ?? 'A field');
            $message = ucfirst($label) . ' has an invalid or out of range value.';

            return [
                'status' => 422,
                'message' => $message,
                'errors' => $field ? [$field => [$message]] : [],
            ];
        }

        // Foreign key failure: a referenced record was removed meanwhile.
        if ($code === 1452) {
            return [
                'status' => 422,
                'message' => 'A selected category, brand, model, fuel type or transmission '
                    . 'no longer exists. Refresh the page and try again.',
                'errors' => [],
            ];
        }

        // Lock wait timeout / deadlock.
        if (in_array($code, [1205, 1213], true)) {
            return [
                'status' => 409,
                'message' => 'The server is busy updating this vehicle. Please try again in a moment.',
                'errors' => [],
            ];
        }

        return null;
    }



    // ================= CREATE / UPDATE =================



    public function saveVehicle(Request $request)

    {
        $branchId = (int) $request->user()->branch_id;

        if ($branchId < 1) {
            return response()->json([
                'status' => false,
                'message' => 'Your account does not have a valid branch.',
            ], 422);
        }

        $newPaths = [];
        $deletedPaths = [];
        $committed = false;

        try {
            $idValidator = Validator::make($request->all(), [
                'upd_id' => ['nullable', 'integer', 'min:1'],
            ], [], self::ATTRIBUTES);

            if ($idValidator->fails()) {
                return response()->json([
                    'status' => false,
                    'message' => $idValidator->errors()->first(),
                    'errors' => $idValidator->errors(),
                ], 422);
            }

            $updateId = $request->input('upd_id');
            $existingVehicle = null;

            if ($updateId !== null && $updateId !== '') {

                $existingVehicle = DB::table(self::TABLE)
                    ->where('branch_id', $branchId)
                    ->where('ID', $updateId)
                    ->first(['ID']);

                if (!$existingVehicle) {

                    return response()->json([
                        'status' => false,
                        'message' => 'Vehicle not found.',
                    ], 404);
                }
            }

            $isUpdate = $existingVehicle !== null;
            $numberRule = Rule::unique(self::TABLE, 'vehicle_number');
            $chassisRule = Rule::unique(self::TABLE, 'chassis_number');

            if ($isUpdate) {
                $numberRule->ignore($existingVehicle->ID, 'ID');
                $chassisRule->ignore($existingVehicle->ID, 'ID');
            }

            $validator = Validator::make(
                $request->all(),
                [
                    'number_plate' => [
                        'required',
                        'string',
                        'max:50',
                        $numberRule,
                    ],

                    'category' => [
                        'required',
                        'integer',
                        'min:1',
                        Rule::exists('vehicle_category_tb', 'ID'),
                    ],

                    'brand' => [
                        'required',
                        'integer',
                        'min:1',
                        Rule::exists('vehicle_brand_tb', 'ID'),
                    ],

                    // Model must exist AND belong to the selected brand.
                    // Checked here so every error is returned in one response.
                    'model' => [
                        'required',
                        'integer',
                        'min:1',
                        Rule::exists('vehicle_model_tb', 'ID')
                            ->where('brand_id', (int) $request->input('brand')),
                    ],

                    'fuel_type' => [
                        'required',
                        'integer',
                        'min:1',
                        Rule::exists('fuel_type_tb', 'ID'),
                    ],

                    'transmission' => [
                        'required',
                        'integer',
                        'min:1',
                        Rule::exists('transmission_type_tb', 'ID'),
                    ],

                    'manufacture_year' => [
                        'nullable',
                        'integer',
                        'min:1886',
                        'max:' . (now()->year + 1),
                    ],

                    'color' => ['nullable', 'string', 'max:50'],
                    'engine_number' => ['nullable', 'string', 'max:100'],
                    'chassis_number' => [
                        'nullable',
                        'string',
                        'max:100',
                        $chassisRule,
                    ],

                    'mileage' => ['nullable', 'numeric', 'min:0'],
                    'seating_capacity' => [
                        'nullable',
                        'integer',
                        'min:1',
                        'max:200',
                    ],

                    'purchase_date' => ['nullable', 'date_format:Y-m-d'],
                    'purchase_price' => ['nullable', 'numeric', 'min:0'],
                    'daily_rental_rate' => ['required', 'numeric', 'min:0'],
                    'weekly_rental_rate' => ['nullable', 'numeric', 'min:0'],
                    'monthly_rental_rate' => ['nullable', 'numeric', 'min:0'],
                    'insurance_expiry_date' => [
                        'nullable',
                        'date_format:Y-m-d',
                    ],
                    'registration_expiry_date' => [
                        'nullable',
                        'date_format:Y-m-d',
                    ],
                    'vehicle_status' => [
                        'required',
                        Rule::in(self::STATUSES),
                    ],

                    // JSON allows an explicitly empty feature selection.
                    // The closure validates every id so the user sees the
                    // feature problem together with all other problems.
                    'features' => [
                        'bail',
                        'required',
                        'json',
                        function (string $attribute, mixed $value, \Closure $fail) {
                            $ids = json_decode((string) $value, true);

                            if (!is_array($ids)) {
                                $fail('The selected features are invalid.');
                                return;
                            }

                            if (count($ids) > 200) {
                                $fail('You can select at most 200 features.');
                                return;
                            }

                            $clean = [];

                            foreach ($ids as $id) {
                                if (
                                    is_bool($id)
                                    || is_array($id)
                                    || filter_var($id, FILTER_VALIDATE_INT) === false
                                    || (int) $id < 1
                                ) {
                                    $fail('The selected features are invalid.');
                                    return;
                                }

                                $clean[] = (int) $id;
                            }

                            if (count($clean) !== count(array_unique($clean))) {
                                $fail('The same feature was selected more than once.');
                                return;
                            }

                            if (
                                $clean
                                && DB::table('vehicle_feature_tb')
                                ->whereIn('ID', $clean)
                                ->count() !== count($clean)
                            ) {
                                $fail('One of the selected vehicle features no longer exists.');
                            }
                        },
                    ],

                    // IMAGE FUNCTIONALITY: newly uploaded images.

                    'images' => ['sometimes', 'array', 'max:10'],
                    'images.*' => [
                        'required',
                        'image',
                        'mimes:jpg,jpeg,png,webp',
                        'max:2048',
                        'dimensions:max_width=6000,max_height=6000',
                    ],

                    // IMAGE FUNCTIONALITY: existing image rows to remove.
                    'removed_image_ids' => ['sometimes', 'array', 'max:10'],
                    'removed_image_ids.*' => [
                        'required',
                        'integer',
                        'min:1',
                        'distinct',
                    ],
                ],

                [

                    'number_plate.required' => 'Vehicle number plate is required.',
                    'number_plate.unique' => 'This vehicle number plate already exists.',
                    'chassis_number.unique' => 'This chassis number already exists.',
                    'category.required' => 'Please select a category.',
                    'category.exists' => 'The selected category does not exist.',
                    'brand.required' => 'Please select a brand.',
                    'brand.exists' => 'The selected brand does not exist.',
                    'model.required' => 'Please select a model.',
                    'model.exists' => 'Please select a model belonging to the selected brand.',
                    'fuel_type.required' => 'Please select a fuel type.',
                    'fuel_type.exists' => 'The selected fuel type does not exist.',
                    'transmission.required' => 'Please select a transmission.',
                    'transmission.exists' => 'The selected transmission does not exist.',
                    'daily_rental_rate.required' => 'Daily rental rate is required.',
                    'vehicle_status.required' => 'Please select a vehicle status.',
                    'vehicle_status.in' => 'Please select a valid vehicle status.',
                    'purchase_date.date_format' => 'Purchase date must be a valid date.',
                    'insurance_expiry_date.date_format' => 'Insurance expiry date must be a valid date.',
                    'registration_expiry_date.date_format' => 'Registration expiry date must be a valid date.',
                    'features.required' => 'Features data is missing. Reload the page and try again.',
                    'features.json' => 'The selected features are invalid.',
                    'images.max' => 'A vehicle can have at most 10 images.',
                    'images.*.uploaded' =>
                    'An image failed to upload. It may exceed the server upload size limit.',
                    'images.*.image' => 'Each uploaded file must be an image.',
                    'images.*.mimes' => 'Images must be JPG, PNG or WebP.',
                    'images.*.max' => 'Each image must not exceed 2 MB.',
                    'images.*.dimensions' =>
                    'Image dimensions cannot exceed 6000 × 6000 pixels.',
                ],

                self::ATTRIBUTES

            );



            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'message' => 'Please correct the highlighted fields.',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            $featureIds = array_values(array_unique(array_map(
                'intval',
                json_decode($validated['features'], true) ?? []
            )));

            $data = [];

            foreach (self::FIELD_MAP as $formField => $databaseField) {
                $data[$databaseField] = $validated[$formField] ?? null;
            }

            // Store 0 when mileage is left blank because the database requires a value.
            $data['mileage'] = ($data['mileage'] === null || $data['mileage'] === '')
                ? 0
                : $data['mileage'];

            $data['updated_at'] = now();

            $result = DB::transaction(function () use (
                $request,
                $validated,
                $data,
                $featureIds,
                $branchId,
                $existingVehicle,
                $isUpdate,
                &$newPaths,
                &$deletedPaths
            ) {

                if ($isUpdate) {

                    // Serialize changes to the same vehicle.

                    $vehicle = DB::table(self::TABLE)
                        ->where('branch_id', $branchId)
                        ->where('ID', $existingVehicle->ID)
                        ->lockForUpdate()
                        ->first(['ID']);

                    if (!$vehicle) {
                        return [
                            'error' => 'Vehicle not found.',
                            'code' => 404,
                        ];
                    }

                    $vehicleId = $vehicle->ID;
                } else {
                    $vehicleId = null;
                }

                // IMAGE FUNCTIONALITY: validate removal ownership.

                $removeIds = array_map(
                    'intval',
                    $validated['removed_image_ids'] ?? []
                );

                $imagesToRemove = collect();

                if ($removeIds) {
                    if (!$isUpdate) {
                        return [
                            'error' => 'A new vehicle has no saved images to remove.',
                            'code' => 422,
                            'field' => 'images',
                        ];
                    }

                    $imagesToRemove = DB::table(self::IMAGE_TABLE)
                        ->where('vehicle_id', $vehicleId)
                        ->whereIn('ID', $removeIds)
                        ->get(['ID', 'path']);

                    if ($imagesToRemove->count() !== count($removeIds)) {
                        return [
                            'error' =>
                            'Some images no longer exist. Reopen the vehicle.',
                            'code' => 422,
                            'field' => 'images',
                        ];
                    }
                }

                $currentCount = $isUpdate
                    ? DB::table(self::IMAGE_TABLE)
                    ->where('vehicle_id', $vehicleId)
                    ->count()
                    : 0;

                $uploads = $request->file('images', []);

                if ($currentCount - $imagesToRemove->count() + count($uploads) > self::MAX_IMAGES) {

                    return [
                        'error' => 'A vehicle can have at most 10 images.',
                        'code' => 422,
                        'field' => 'images',
                    ];
                }

                if ($isUpdate) {
                    DB::table(self::TABLE)
                        ->where('ID', $vehicleId)
                        ->update($data);
                } else {

                    // Get the actual auto-increment vehicle ID.

                    $vehicleId = DB::table(self::TABLE)->insertGetId(
                        array_merge($data, [
                            'branch_id' => $branchId,
                            'created_at' => now(),
                        ]),
                        'ID'
                    );
                }

                // ================= SAVE FEATURE MAPPINGS =================

                $existingFeatureIds = DB::table(self::FEATURE_MAP_TABLE)
                    ->where('vehicle_id', $vehicleId)
                    ->pluck('feature_id')
                    ->map(fn($id) => (int) $id)
                    ->all();

                $featuresToDelete = array_diff(
                    $existingFeatureIds,
                    $featureIds
                );

                if ($featuresToDelete) {
                    DB::table(self::FEATURE_MAP_TABLE)
                        ->where('vehicle_id', $vehicleId)
                        ->whereIn('feature_id', $featuresToDelete)
                        ->delete();
                }

                foreach (array_diff($featureIds, $existingFeatureIds) as $id) {

                    DB::table(self::FEATURE_MAP_TABLE)->insert([
                        'vehicle_id' => $vehicleId,
                        'feature_id' => $id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                // ================= IMAGE FUNCTIONALITY: REMOVE =================

                foreach ($imagesToRemove as $image) {
                    $deletedPaths[] = $image->path;
                }

                if ($removeIds) {
                    DB::table(self::IMAGE_TABLE)
                        ->where('vehicle_id', $vehicleId)
                        ->whereIn('ID', $removeIds)
                        ->delete();
                }

                // ================= IMAGE FUNCTIONALITY: UPLOAD =================

                foreach ($uploads as $file) {
                    $folder = 'vehicle_' . $vehicleId;
                    $filename = Str::uuid()->toString()
                        . '.' . $file->extension();

                    $path = $folder . '/' . $filename;

                    // Track writes so rollback can clean them up.

                    $newPaths[] = $path;

                    $stored = Storage::disk(self::IMAGE_DISK)
                        ->putFileAs($folder, $file, $filename);

                    // putFileAs returns false (it does not throw) on failure.
                    if ($stored === false) {
                        throw new \RuntimeException(self::IMAGE_STORE_FAILED);
                    }

                    DB::table(self::IMAGE_TABLE)->insert([
                        'vehicle_id' => $vehicleId,
                        'path' => $path,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                return ['ID' => $vehicleId];
            });

            if (isset($result['error'])) {
                $body = [
                    'status' => false,
                    'message' => $result['error'],
                ];

                if (isset($result['field'])) {
                    $body['errors'] = [$result['field'] => [$result['error']]];
                }

                return response()->json($body, $result['code']);
            }

            $committed = true;

            // IMAGE FUNCTIONALITY: delete physical files after commit.

            foreach ($deletedPaths as $path) {
                $this->deleteImageSafely($path);
            }

            return response()->json([
                'status' => true,
                'data' => ['ID' => $result['ID']],
                'message' => $isUpdate
                    ? 'Vehicle updated successfully.'
                    : 'Vehicle registered successfully.',

            ], $isUpdate ? 200 : 201);
        } catch (\Throwable $th) {

            // IMAGE FUNCTIONALITY: filesystem writes are not transactional.

            if (!$committed) {
                foreach ($newPaths as $path) {
                    $this->deleteImageSafely($path);
                }
            }

            // Known database problems: tell the user exactly what is wrong.
            if ($th instanceof QueryException) {
                $known = $this->describeDatabaseError($th);

                if ($known !== null) {
                    report($th);

                    $body = [
                        'status' => false,
                        'message' => $known['message'],
                    ];

                    if (!empty($known['errors'])) {
                        $body['errors'] = $known['errors'];
                    }

                    return response()->json($body, $known['status']);
                }
            }

            // Image could not be written to disk.
            if (
                $th instanceof \RuntimeException
                && $th->getMessage() === self::IMAGE_STORE_FAILED
            ) {
                report($th);

                $message = 'An image could not be stored on the server. '
                    . 'Please try again or contact support.';

                return response()->json([
                    'status' => false,
                    'message' => $message,
                    'errors' => ['images' => [$message]],
                ], 500);
            }

            return $this->serverError($th, 'Unable to save vehicle. Please try again.', 'saveVehicle');
        }
    }

    // ================= GET TABLE AND DROPDOWNS =================

    public function getVehicles(Request $request)
    {

        $branchId = (int) $request->user()->branch_id;

        if ($branchId < 1) {
            return response()->json([
                'status' => false,
                'message' => 'Your account does not have a valid branch.',
            ], 422);
        }

        try {

            $vehicles = DB::table(self::TABLE . ' as vehicle')
                ->leftJoin(
                    'vehicle_brand_tb as brand',
                    'vehicle.brand_id',
                    '=',
                    'brand.ID'
                )
                ->leftJoin(
                    'vehicle_model_tb as model',
                    'vehicle.model_id',
                    '=',
                    'model.ID'
                )
                ->leftJoin(
                    'vehicle_category_tb as category',
                    'vehicle.category_id',
                    '=',
                    'category.ID'
                )
                ->leftJoin(
                    'fuel_type_tb as fuel',
                    'vehicle.fuel_type_id',
                    '=',
                    'fuel.ID'
                )
                ->where('vehicle.branch_id', $branchId)
                ->orderByDesc('vehicle.ID')
                ->get([
                    'vehicle.ID as id',
                    'vehicle.vehicle_number as number_plate',
                    'brand.brand_name as brand',
                    'model.model_name as model',
                    'category.category_name as category',
                    'fuel.fuel_type_name as fuel_type',
                    'vehicle.daily_rate as daily_rental_rate',
                    'vehicle.status',
                ]);

            return response()->json([
                'status' => true,
                'data' => $vehicles,

                'options' => [

                    'categories' => DB::table('vehicle_category_tb')
                        ->orderBy('category_name')
                        ->get(['ID', 'category_name']),

                    'brands' => DB::table('vehicle_brand_tb')
                        ->orderBy('brand_name')
                        ->get(['ID', 'brand_name']),

                    'models' => DB::table('vehicle_model_tb')
                        ->orderBy('model_name')
                        ->get([
                            'ID',
                            'brand_id',
                            'model_name',
                            'manufacture_year',
                        ]),

                    'fuels' => DB::table('fuel_type_tb')
                        ->orderBy('fuel_type_name')
                        ->get(['ID', 'fuel_type_name']),

                    'transmissions' => DB::table('transmission_type_tb')
                        ->orderBy('transmission_name')
                        ->get(['ID', 'transmission_name']),

                    'features' => DB::table('vehicle_feature_tb')
                        ->orderBy('feature_name')
                        ->get(['ID', 'feature_name']),

                ],
                'message' => 'Vehicles retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            return $this->serverError($th, 'Unable to load vehicles. Please try again.', 'getVehicles');
        }
    }

    // ================= FETCH FOR EDIT =================

    public function fetchVehicleData(Request $request)
    {

        $branchId = (int) $request->user()->branch_id;

        if ($branchId < 1) {
            return response()->json([
                'status' => false,
                'message' => 'Your account does not have a valid branch.',
            ], 422);
        }

        try {

            $validator = Validator::make($request->all(), [
                'upd_id' => ['required', 'integer', 'min:1'],
            ], [], self::ATTRIBUTES);

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'message' => $validator->errors()->first(),
                    'errors' => $validator->errors(),
                ], 422);
            }

            $vehicle = DB::table(self::TABLE)
                ->where('branch_id', $branchId)
                ->where('ID', $validator->validated()['upd_id'])
                ->first();

            if (!$vehicle) {
                return response()->json([
                    'status' => false,
                    'message' => 'Vehicle not found.',
                ], 404);
            }

            $data = ['ID' => $vehicle->ID];

            foreach (self::FIELD_MAP as $formField => $databaseField) {
                $data[$formField] = $vehicle->{$databaseField};
            }

            foreach (
                [
                    'purchase_date',
                    'insurance_expiry_date',
                    'registration_expiry_date',
                ] as $field

            ) {
                $data[$field] = $data[$field]
                    ? substr((string) $data[$field], 0, 10)
                    : '';
            }


            $data['features'] = DB::table(self::FEATURE_MAP_TABLE)
                ->where('vehicle_id', $vehicle->ID)
                ->pluck('feature_id')
                ->map(fn($id) => (string) $id)
                ->values();

            // IMAGE FUNCTIONALITY: saved photo URLs for editing.

            $data['images'] = DB::table(self::IMAGE_TABLE)
                ->where('vehicle_id', $vehicle->ID)
                ->orderBy('ID')
                ->get(['ID', 'path'])
                ->map(fn($image) => $this->formatImage($image));

            return response()->json([
                'status' => true,
                'data' => $data,
                'message' => 'Vehicle retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            return $this->serverError($th, 'Unable to fetch vehicle. Please try again.', 'fetchVehicleData');
        }
    }

    // ================= IMAGE FUNCTIONALITY: DISPLAY =================

    public function showImage(string $folder, string $filename)
    {
        $path = $folder . '/' . $filename;

        abort_unless($this->managedImagePath($path), 404);

        abort_unless(
            DB::table(self::IMAGE_TABLE)->where('path', $path)->exists(),
            404
        );

        $disk = Storage::disk(self::IMAGE_DISK);

        abort_unless($disk->exists($path), 404);

        return response()->file($disk->path($path), [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'no-store',
        ]);
    }
}
