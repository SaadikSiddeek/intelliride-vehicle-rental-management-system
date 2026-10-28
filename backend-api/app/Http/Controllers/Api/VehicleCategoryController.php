<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class VehicleCategoryController extends Controller
{
    private const TABLE = 'vehicle_category_tb';

    // ================= CREATE / UPDATE =================

    public function saveVehicleCategory(Request $request)
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
            $existingCategory = null;

            if ($updateId !== null && $updateId !== '') {
                $existingCategory = DB::table(self::TABLE)
                    ->where('ID', $updateId)
                    ->first(['ID']);

                if (!$existingCategory) {
                    return response()->json([
                        'status' => false,
                        'message' => 'Vehicle category not found.',
                    ], 404);
                }
            }

            $isUpdate = $existingCategory !== null;

            $categoryNameRule = Rule::unique(
                self::TABLE,
                'category_name'
            );

            if ($isUpdate) {
                $categoryNameRule->ignore(
                    $existingCategory->ID,
                    'ID'
                );
            }

            $validator = Validator::make(
                $request->all(),
                [
                    'category_name' => [
                        'required',
                        'string',
                        'max:100',
                        $categoryNameRule,
                    ],
                    'description' => [
                        'nullable',
                        'string',
                        'max:500',
                    ],
                    'status' => ['required', 'boolean'],
                ],
                [
                    'category_name.required' => 'Category name is required.',
                    'category_name.unique' => 'This vehicle category already exists.',
                    'category_name.max' => 'Category name cannot exceed 100 characters.',
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
                'category_name' => $validated['category_name'],
                'description' => $validated['description'] ?? null,
                'status' => (int) $validated['status'],
                'updated_at' => now(),
            ];

            if ($isUpdate) {
                $categoryId = $existingCategory->ID;

                DB::table(self::TABLE)
                    ->where('ID', $categoryId)
                    ->update($data);

                $message = 'Vehicle category updated successfully.';
                $responseCode = 200;
            } else {
                $data['created_at'] = now();

                $categoryId = DB::table(self::TABLE)
                    ->insertGetId($data, 'ID');

                $message = 'Vehicle category created successfully.';
                $responseCode = 201;
            }

            return response()->json([
                'status' => true,
                'data' => array_merge([
                    'ID' => $categoryId,
                ], $data),
                'message' => $message,
            ], $responseCode);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save vehicle category. Please try again.',
            ], 500);
        }
    }

    // ================= GET TABLE RECORDS =================

    public function getVehicleCategories(Request $request)
    {
        try {
            $categories = DB::table(self::TABLE)
                ->orderByDesc('ID')
                ->get([
                    'ID',
                    'category_name',
                    'description',
                    'status',
                ]);

            $data = $categories->map(function ($category) {
                return [
                    'id' => $category->ID,
                    'category_name' => $category->category_name,
                    'description' => $category->description ?? '',
                    'status' => (int) $category->status,
                ];
            });

            return response()->json([
                'status' => true,
                'data' => $data,
                'message' => 'Vehicle categories retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load vehicle categories. Please try again.',
            ], 500);
        }
    }

    // ================= FETCH ONE RECORD FOR EDIT =================

    public function fetchVehicleCategoryData(Request $request)
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

            $category = DB::table(self::TABLE)
                ->where('ID', $validated['upd_id'])
                ->first([
                    'ID',
                    'category_name',
                    'description',
                    'status',
                ]);

            if (!$category) {
                return response()->json([
                    'status' => false,
                    'message' => 'Vehicle category not found.',
                ], 404);
            }

            $category->status = (int) $category->status;

            return response()->json([
                'status' => true,
                'data' => $category,
                'message' => 'Vehicle category retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch vehicle category. Please try again.',
            ], 500);
        }
    }
}
