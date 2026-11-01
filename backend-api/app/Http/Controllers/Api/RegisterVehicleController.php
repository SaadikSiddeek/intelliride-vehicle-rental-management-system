<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

    // ================= IMAGE FUNCTIONALITY: HELPERS =================

    private function managedImagePath(?string $path): bool
    {
        return $path && preg_match(
            '/\Avehicle_[1-9][0-9]*\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)\z/',
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
            ]);

            if ($idValidator->fails()) {
                return response()->json([
                    'status' => false,
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
                    'model' => ['required', 'integer', 'min:1'],
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
                    'features' => ['required', 'json'],

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
                    'fuel_type.required' => 'Please select a fuel type.',
                    'transmission.required' => 'Please select a transmission.',
                    'daily_rental_rate.required' => 'Daily rental rate is required.',
                    'vehicle_status.required' => 'Please select a vehicle status.',
                    'images.max' => 'A vehicle can have at most 10 images.',
                    'images.*.image' => 'Each uploaded file must be an image.',
                    'images.*.mimes' => 'Images must be JPG, PNG or WebP.',
                    'images.*.max' => 'Each image must not exceed 2 MB.',
                    'images.*.dimensions' =>
                    'Image dimensions cannot exceed 6000 × 6000 pixels.',
                ]
            );

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            $featureIds = json_decode(
                $validated['features'],
                true,
                512,
                JSON_THROW_ON_ERROR
            );

            $referenceValidator = Validator::make(
                [
                    'model' => $validated['model'],
                    'features' => $featureIds,
                ],
                [
                    'model' => [
                        Rule::exists('vehicle_model_tb', 'ID')
                            ->where('brand_id', $validated['brand']),
                    ],
                    'features' => ['present', 'array', 'max:200'],
                    'features.*' => [
                        'required',
                        'integer',
                        'min:1',
                        'distinct',
                        Rule::exists('vehicle_feature_tb', 'ID'),
                    ],
                ],
                [
                    'model.exists' =>
                    'Please select a model belonging to the selected brand.',
                    'features.*.exists' =>
                    'One of the selected vehicle features no longer exists.',
                ]
            );

            if ($referenceValidator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $referenceValidator->errors(),
                ], 422);
            }

            $featureIds = array_map('intval', $featureIds);

            $data = [];

            foreach (self::FIELD_MAP as $formField => $databaseField) {
                $data[$databaseField] = $validated[$formField] ?? null;
            }

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
                        ];
                    }
                }

                $currentCount = $isUpdate
                    ? DB::table(self::IMAGE_TABLE)
                    ->where('vehicle_id', $vehicleId)
                    ->count()
                    : 0;

                $uploads = $request->file('images', []);

                if (
                    $currentCount - $imagesToRemove->count() + count($uploads)
                    > self::MAX_IMAGES
                ) {
                    return [
                        'error' => 'A vehicle can have at most 10 images.',
                        'code' => 422,
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

                    Storage::disk(self::IMAGE_DISK)
                        ->putFileAs($folder, $file, $filename);

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
                return response()->json([
                    'status' => false,
                    'message' => $result['error'],
                ], $result['code']);
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

            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save vehicle. Please try again.',
            ], 500);
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
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load vehicles. Please try again.',
            ], 500);
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
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
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
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch vehicle. Please try again.',
            ], 500);
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
