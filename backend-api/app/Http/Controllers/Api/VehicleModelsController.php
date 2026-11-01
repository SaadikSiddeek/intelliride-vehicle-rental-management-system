<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class VehicleModelsController extends Controller
{
    private const TABLE = 'vehicle_model_tb';

    // ================= CREATE / UPDATE =================

    public function saveVehicleModel(Request $request)
    {
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
            $existingModel = null;

            if ($updateId !== null && $updateId !== '') {
                $existingModel = DB::table(self::TABLE)
                    ->where('ID', $updateId)
                    ->first(['ID']);

                if (!$existingModel) {
                    return response()->json([
                        'status' => false,
                        'message' => 'Vehicle model not found.',
                    ], 404);
                }
            }

            $isUpdate = $existingModel !== null;

            $validator = Validator::make(
                $request->all(),
                [
                    'brand' => [
                        'required',
                        'integer',
                        'min:1',
                        Rule::exists('vehicle_brand_tb', 'ID'),
                    ],
                    'model_name' => [
                        'required',
                        'string',
                        'max:100',
                    ],
                    'year' => [
                        'nullable',
                        'integer',
                        'min:1886',
                        'max:' . (now()->year + 1),
                    ],
                    'engine_capacity' => [
                        'nullable',
                        'string',
                        'max:50',
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
                    'status' => ['required', 'boolean'],
                ],
                [
                    'brand.required' => 'Please select a brand.',
                    'brand.exists' => 'The selected brand does not exist.',
                    'model_name.required' => 'Model name is required.',
                    'model_name.max' => 'Model name cannot exceed 100 characters.',
                    'year.integer' => 'Year must be a whole number.',
                    'year.min' => 'Year must be 1886 or later.',
                    'year.max' => 'Year cannot exceed next year.',
                    'engine_capacity.max' => 'Engine capacity cannot exceed 50 characters.',
                    'fuel_type.required' => 'Please select a fuel type.',
                    'fuel_type.exists' => 'The selected fuel type does not exist.',
                    'transmission.required' => 'Please select a transmission type.',
                    'transmission.exists' => 'The selected transmission type does not exist.',
                    'status.required' => 'Status is required.',
                    'status.boolean' => 'Status must be active or inactive.',
                ]
            );

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            // Duplicate check: same brand, model name and manufacturing year.
            $nameRule = Rule::unique(self::TABLE, 'model_name')
                ->where(function ($query) use ($validated) {
                    $query->where('brand_id', $validated['brand']);

                    if (isset($validated['year'])) {
                        $query->where(
                            'manufacture_year',
                            $validated['year']
                        );
                    } else {
                        $query->whereNull('manufacture_year');
                    }
                });

            if ($isUpdate) {
                $nameRule->ignore($existingModel->ID, 'ID');
            }

            $uniqueValidator = Validator::make(
                $validated,
                ['model_name' => [$nameRule]],
                [
                    'model_name.unique' =>
                    'This model already exists for the selected brand and year.',
                ]
            );

            if ($uniqueValidator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $uniqueValidator->errors(),
                ], 422);
            }

            // Map form fields to the actual database columns.
            $data = [
                'brand_id' => (int) $validated['brand'],
                'fuel_type_id' => (int) $validated['fuel_type'],
                'transmission_type_id' => (int) $validated['transmission'],
                'model_name' => $validated['model_name'],
                'manufacture_year' => isset($validated['year'])
                    ? (int) $validated['year']
                    : null,
                'engine_capacity' => $validated['engine_capacity'] ?? null,
                'status' => (int) $validated['status'],
                'updated_at' => now(),
            ];

            if ($isUpdate) {
                $modelId = $existingModel->ID;

                DB::table(self::TABLE)
                    ->where('ID', $modelId)
                    ->update($data);

                $message = 'Vehicle model updated successfully.';
                $responseCode = 200;
            } else {
                $data['created_at'] = now();

                $modelId = DB::table(self::TABLE)
                    ->insertGetId($data, 'ID');

                $message = 'Vehicle model created successfully.';
                $responseCode = 201;
            }

            return response()->json([
                'status' => true,
                'data' => array_merge(['ID' => $modelId], $data),
                'message' => $message,
            ], $responseCode);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save vehicle model. Please try again.',
            ], 500);
        }
    }

    // ================= GET TABLE RECORDS =================

    public function getVehicleModels(Request $request)
    {
        try {
            $models = DB::table(self::TABLE . ' as model')
                ->leftJoin(
                    'vehicle_brand_tb as brand',
                    'model.brand_id',
                    '=',
                    'brand.ID'
                )
                ->leftJoin(
                    'fuel_type_tb as fuel',
                    'model.fuel_type_id',
                    '=',
                    'fuel.ID'
                )
                ->leftJoin(
                    'transmission_type_tb as transmission',
                    'model.transmission_type_id',
                    '=',
                    'transmission.ID'
                )
                ->orderByDesc('model.ID')
                ->get([
                    'model.ID as id',
                    'model.brand_id',
                    'brand.brand_name as brand',
                    'model.model_name',
                    'model.manufacture_year as year',
                    'model.engine_capacity',
                    'model.fuel_type_id',
                    'fuel.fuel_type_name as fuel_type',
                    'model.transmission_type_id',
                    'transmission.transmission_name as transmission',
                    'model.status',
                ]);

            $models->transform(function ($model) {
                $model->status = (int) $model->status;

                return $model;
            });

            // Return brand options with the table response.
            $brands = DB::table('vehicle_brand_tb')
                ->orderBy('brand_name')
                ->get(['ID', 'brand_name', 'status']);

            return response()->json([
                'status' => true,
                'data' => $models,
                'brands' => $brands,
                'message' => 'Vehicle models retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load vehicle models. Please try again.',
            ], 500);
        }
    }

    // ================= FETCH ONE RECORD FOR EDIT =================

    public function fetchVehicleModelData(Request $request)
    {
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

            $model = DB::table(self::TABLE)
                ->where('ID', $validator->validated()['upd_id'])
                ->first([
                    'ID',
                    'brand_id',
                    'fuel_type_id',
                    'transmission_type_id',
                    'model_name',
                    'manufacture_year',
                    'engine_capacity',
                    'status',
                ]);

            if (!$model) {
                return response()->json([
                    'status' => false,
                    'message' => 'Vehicle model not found.',
                ], 404);
            }

            $model->status = (int) $model->status;

            return response()->json([
                'status' => true,
                'data' => $model,
                'message' => 'Vehicle model retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch vehicle model. Please try again.',
            ], 500);
        }
    }
}
