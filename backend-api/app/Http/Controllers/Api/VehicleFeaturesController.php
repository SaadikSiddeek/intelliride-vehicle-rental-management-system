<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class VehicleFeaturesController extends Controller
{
    private const TABLE = 'vehicle_feature_tb';

    // ================= CREATE / UPDATE =================

    public function saveVehicleFeature(Request $request)
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
            $existingFeature = null;

            if ($updateId !== null && $updateId !== '') {
                $existingFeature = DB::table(self::TABLE)
                    ->where('ID', $updateId)
                    ->first(['ID']);

                if (!$existingFeature) {
                    return response()->json([
                        'status' => false,
                        'message' => 'Vehicle feature not found.',
                    ], 404);
                }
            }

            $isUpdate = $existingFeature !== null;

            $featureNameRule = Rule::unique(
                self::TABLE,
                'feature_name'
            );

            if ($isUpdate) {
                $featureNameRule->ignore($existingFeature->ID, 'ID');
            }

            $validator = Validator::make(
                $request->all(),
                [
                    'feature_name' => [
                        'required',
                        'string',
                        'max:100',
                        $featureNameRule,
                    ],
                    'description' => [
                        'nullable',
                        'string',
                        'max:500',
                    ],
                    'status' => ['required', 'boolean'],
                ],
                [
                    'feature_name.required' => 'Feature name is required.',
                    'feature_name.unique' => 'This vehicle feature already exists.',
                    'feature_name.max' => 'Feature name cannot exceed 100 characters.',
                    'description.max' => 'Description cannot exceed 500 characters.',
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

            $data = [
                'feature_name' => $validated['feature_name'],
                'description' => $validated['description'] ?? null,
                'status' => (int) $validated['status'],
                'updated_at' => now(),
            ];

            if ($isUpdate) {
                $featureId = $existingFeature->ID;

                DB::table(self::TABLE)
                    ->where('ID', $featureId)
                    ->update($data);

                $message = 'Vehicle feature updated successfully.';
                $responseCode = 200;
            } else {
                $data['created_at'] = now();

                $featureId = DB::table(self::TABLE)
                    ->insertGetId($data, 'ID');

                $message = 'Vehicle feature created successfully.';
                $responseCode = 201;
            }

            return response()->json([
                'status' => true,
                'data' => array_merge([
                    'ID' => $featureId,
                ], $data),
                'message' => $message,
            ], $responseCode);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save vehicle feature. Please try again.',
            ], 500);
        }
    }

    // ================= GET TABLE RECORDS =================

    public function getVehicleFeatures(Request $request)
    {
        try {
            $features = DB::table(self::TABLE)
                ->orderByDesc('ID')
                ->get([
                    'ID',
                    'feature_name',
                    'description',
                    'status',
                ]);

            $data = $features->map(function ($row) {
                return [
                    'id' => $row->ID,
                    'feature_name' => $row->feature_name,
                    'description' => $row->description ?? '',
                    'status' => (int) $row->status,
                ];
            });

            return response()->json([
                'status' => true,
                'data' => $data,
                'message' => 'Vehicle features retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load vehicle features. Please try again.',
            ], 500);
        }
    }

    // ================= FETCH ONE RECORD FOR EDIT =================

    public function fetchVehicleFeatureData(Request $request)
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

            $validated = $validator->validated();

            $feature = DB::table(self::TABLE)
                ->where('ID', $validated['upd_id'])
                ->first([
                    'ID',
                    'feature_name',
                    'description',
                    'status',
                ]);

            if (!$feature) {
                return response()->json([
                    'status' => false,
                    'message' => 'Vehicle feature not found.',
                ], 404);
            }

            $feature->status = (int) $feature->status;

            return response()->json([
                'status' => true,
                'data' => $feature,
                'message' => 'Vehicle feature retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch vehicle feature. Please try again.',
            ], 500);
        }
    }
}
