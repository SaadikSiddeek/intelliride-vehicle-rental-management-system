<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class DesignationController extends Controller
{
    public function saveDesignation(Request $request)
    {
        try {
            $input = $request->all();
            $branchId = get_br_id();

            if (is_string(data_get($input, 'form_data.designation_name'))) {
                $input['form_data']['designation_name'] = trim(
                    $input['form_data']['designation_name']
                );
            }

            $idValidator = Validator::make($input, [
                'upd_id' => [
                    'nullable',
                    'integer',
                    'min:1',
                    Rule::exists('designation_tb', 'ID'),
                ],
            ]);

            if ($idValidator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $idValidator->errors(),
                ], 422);
            }

            $updateId = $idValidator->validated()['upd_id'] ?? null;

            $departmentNameRule = Rule::unique(
                'designation_tb',
                'designation_name'
            );

            if ($updateId) {
                $departmentNameRule->ignore($updateId, 'ID');
            }

            $validator = Validator::make($input, [
                'form_data' => ['required', 'array'],
                'form_data.designation_name' => [
                    'required',
                    'string',
                    'max:100',
                    $departmentNameRule,
                ],
                'form_data.status' => ['required', 'boolean'],
            ], [
                'form_data.designation_name.required' =>
                'Department name is required.',
                'form_data.designation_name.unique' =>
                'This department name already exists.',
                'form_data.designation_name.max' =>
                'Department name must not exceed 100 characters.',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated()['form_data'];

            $data = [
                'designation_name' => $validated['designation_name'],
                'description' => 'Test Desc' ?? '',
                'branch_id' => $branchId,
                'status' => (int) $validated['status'],
                'updated_at' => now(),
            ];

            if ($updateId) {
                DB::table('designation_tb')
                    ->where('ID', $updateId)
                    ->update($data);

                $message = 'Department updated successfully.';
                $responseCode = 200;
            } else {
                DB::table('designation_tb')->insert($data);

                $message = 'Designation created successfully.';
                $responseCode = 201;
            }

            return response()->json([
                'status' => true,
                'message' => $message,
            ], $responseCode);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save designation. Please try again.',
            ], 500);
        }
    }

    public function getDesignation()
    {
        try {
            $departments = DB::table('designation_tb')
                ->orderByDesc('ID')
                ->get([
                    'ID',
                    'designation_name',
                    'status',
                ])
                ->map(function ($department) {
                    return [
                        'ID' => $department->ID,
                        'designation_name' => $department->designation_name,
                        'status' => (int) $department->status,
                    ];
                });

            return response()->json([
                'status' => true,
                'data' => $departments,
                'message' => 'Designation retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load designation. Please try again.',
            ], 500);
        }
    }

    public function fetchDesignationData(Request $request)
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

            $department = DB::table('designation_tb')
                ->where('ID', $validator->validated()['upd_id'])
                ->first([
                    'ID',
                    'designation_name',
                    'status',
                ]);

            if (!$department) {
                return response()->json([
                    'status' => false,
                    'message' => 'Designation not found.',
                ], 404);
            }

            $department->status = (int) $department->status;

            return response()->json([
                'status' => true,
                'data' => $department,
                'message' => 'Designation retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch designation. Please try again.',
            ], 500);
        }
    }
}
