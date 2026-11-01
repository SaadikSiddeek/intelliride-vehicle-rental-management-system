<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class VehicleTransmissionController extends Controller
{
    private const TABLE = 'transmission_type_tb';

    // ================= CREATE / UPDATE =================

    public function saveVehicleTransmission(Request $request)
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
            $existingTransmission = null;

            if ($updateId !== null && $updateId !== '') {
                $existingTransmission = DB::table(self::TABLE)
                    ->where('ID', $updateId)
                    ->first(['ID']);

                if (!$existingTransmission) {
                    return response()->json([
                        'status' => false,
                        'message' => 'Transmission type not found.',
                    ], 404);
                }
            }

            $isUpdate = $existingTransmission !== null;

            $nameRule = Rule::unique(
                self::TABLE,
                'transmission_name'
            );

            if ($isUpdate) {
                // Ignore only the verified existing database record.
                $nameRule->ignore($existingTransmission->ID, 'ID');
            }

            $validator = Validator::make(
                $request->all(),
                [
                    'transmission_name' => [
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
                    'transmission_name.required' => 'Transmission name is required.',
                    'transmission_name.unique' => 'This transmission type already exists.',
                    'transmission_name.max' => 'Transmission name cannot exceed 100 characters.',
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
                'transmission_name' => $validated['transmission_name'],
                'description' => $validated['description'] ?? null,
                'status' => (int) $validated['status'],
                'updated_at' => now(),
            ];

            if ($isUpdate) {
                $transmissionId = $existingTransmission->ID;

                DB::table(self::TABLE)
                    ->where('ID', $transmissionId)
                    ->update($data);

                $message = 'Transmission type updated successfully.';
                $responseCode = 200;
            } else {
                $data['created_at'] = now();

                $transmissionId = DB::table(self::TABLE)
                    ->insertGetId($data, 'ID');

                $message = 'Transmission type created successfully.';
                $responseCode = 201;
            }

            return response()->json([
                'status' => true,
                'data' => array_merge([
                    'ID' => $transmissionId,
                ], $data),
                'message' => $message,
            ], $responseCode);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save transmission type. Please try again.',
            ], 500);
        }
    }

    // ================= GET TABLE RECORDS =================

    public function getVehicleTransmissions(Request $request)
    {
        try {
            $transmissions = DB::table(self::TABLE)
                ->orderByDesc('ID')
                ->get([
                    'ID',
                    'transmission_name',
                    'description',
                    'status',
                ]);

            $data = $transmissions->map(function ($row) {
                return [
                    'id' => $row->ID,
                    'transmission_name' => $row->transmission_name,
                    'description' => $row->description ?? '',
                    'status' => (int) $row->status,
                ];
            });

            return response()->json([
                'status' => true,
                'data' => $data,
                'message' => 'Transmission types retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load transmission types. Please try again.',
            ], 500);
        }
    }

    // ================= FETCH ONE RECORD FOR EDIT =================

    public function fetchVehicleTransmissionData(Request $request)
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

            $transmission = DB::table(self::TABLE)
                ->where('ID', $validated['upd_id'])
                ->first([
                    'ID',
                    'transmission_name',
                    'description',
                    'status',
                ]);

            if (!$transmission) {
                return response()->json([
                    'status' => false,
                    'message' => 'Transmission type not found.',
                ], 404);
            }

            $transmission->status = (int) $transmission->status;

            return response()->json([
                'status' => true,
                'data' => $transmission,
                'message' => 'Transmission type retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch transmission type. Please try again.',
            ], 500);
        }
    }
}
