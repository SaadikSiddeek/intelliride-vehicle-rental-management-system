<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class FuelTypeController extends Controller
{
    private const TABLE = 'fuel_type_tb';

    // ================= CREATE / UPDATE =================

    public function saveFuelType(Request $request)
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
            $existingFuelType = null;

            if ($updateId !== null && $updateId !== '') {
                $existingFuelType = DB::table(self::TABLE)
                    ->where('ID', $updateId)
                    ->first(['ID']);

                if (!$existingFuelType) {
                    return response()->json([
                        'status' => false,
                        'message' => 'Fuel type not found.',
                    ], 404);
                }
            }

            $isUpdate = $existingFuelType !== null;

            $nameRule = Rule::unique(
                self::TABLE,
                'fuel_type_name'
            );

            if ($isUpdate) {
                $nameRule->ignore($existingFuelType->ID, 'ID');
            }

            $validator = Validator::make(
                $request->all(),
                [
                    'fuel_type_name' => [
                        'required',
                        'string',
                        'max:100',
                        $nameRule,
                    ],
                    'description' => [
                        'nullable',
                        'string',
                        'max:500',
                    ],
                    'status' => ['required', 'boolean'],
                ],
                [
                    'fuel_type_name.required' => 'Fuel type name is required.',
                    'fuel_type_name.unique' => 'This fuel type already exists.',
                    'fuel_type_name.max' => 'Fuel type name cannot exceed 100 characters.',
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
                'fuel_type_name' => $validated['fuel_type_name'],
                'description' => $validated['description'] ?? null,
                'status' => (int) $validated['status'],
                'updated_at' => now(),
            ];

            if ($isUpdate) {
                $fuelTypeId = $existingFuelType->ID;

                DB::table(self::TABLE)
                    ->where('ID', $fuelTypeId)
                    ->update($data);

                $message = 'Fuel type updated successfully.';
                $responseCode = 200;
            } else {
                $data['created_at'] = now();

                $fuelTypeId = DB::table(self::TABLE)
                    ->insertGetId($data, 'ID');

                $message = 'Fuel type created successfully.';
                $responseCode = 201;
            }

            return response()->json([
                'status' => true,
                'data' => array_merge([
                    'ID' => $fuelTypeId,
                ], $data),
                'message' => $message,
            ], $responseCode);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save fuel type. Please try again.',
            ], 500);
        }
    }

    // ================= GET TABLE RECORDS =================

    public function getFuelTypes(Request $request)
    {
        try {
            $fuelTypes = DB::table(self::TABLE)
                ->orderByDesc('ID')
                ->get([
                    'ID',
                    'fuel_type_name',
                    'description',
                    'status',
                ]);

            $data = $fuelTypes->map(function ($row) {
                return [
                    'id' => $row->ID,
                    'fuel_type_name' => $row->fuel_type_name,
                    'description' => $row->description ?? '',
                    'status' => (int) $row->status,
                ];
            });

            return response()->json([
                'status' => true,
                'data' => $data,
                'message' => 'Fuel types retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load fuel types. Please try again.',
            ], 500);
        }
    }

    // ================= FETCH ONE RECORD FOR EDIT =================

    public function fetchFuelTypeData(Request $request)
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

            $fuelType = DB::table(self::TABLE)
                ->where('ID', $validated['upd_id'])
                ->first([
                    'ID',
                    'fuel_type_name',
                    'description',
                    'status',
                ]);

            if (!$fuelType) {
                return response()->json([
                    'status' => false,
                    'message' => 'Fuel type not found.',
                ], 404);
            }

            $fuelType->status = (int) $fuelType->status;

            return response()->json([
                'status' => true,
                'data' => $fuelType,
                'message' => 'Fuel type retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch fuel type. Please try again.',
            ], 500);
        }
    }
}
