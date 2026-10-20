<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
{
    public function saveDepartment(Request $request)
    {
        try {
            $input = $request->all();
            $branchId = get_br_id();

            if (is_string(data_get($input, 'form_data.department_name'))) {
                $input['form_data']['department_name'] = trim(
                    $input['form_data']['department_name']
                );
            }

            $idValidator = Validator::make($input, [
                'upd_id' => [
                    'nullable',
                    'integer',
                    'min:1',
                    Rule::exists('department_tb', 'ID'),
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
                'department_tb',
                'department_name'
            );

            if ($updateId) {
                $departmentNameRule->ignore($updateId, 'ID');
            }

            $validator = Validator::make($input, [
                'form_data' => ['required', 'array'],
                'form_data.department_name' => [
                    'required',
                    'string',
                    'max:100',
                    $departmentNameRule,
                ],
                'form_data.status' => ['required', 'boolean'],
            ], [
                'form_data.department_name.required' =>
                'Department name is required.',
                'form_data.department_name.unique' =>
                'This department name already exists.',
                'form_data.department_name.max' =>
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
                'department_name' => $validated['department_name'],
                'description' => 'Test Desc' ?? '',
                'branch_id' => $branchId,
                'status' => (int) $validated['status'],
                'updated_at' => now(),
            ];

            if ($updateId) {
                DB::table('department_tb')
                    ->where('ID', $updateId)
                    ->update($data);

                $message = 'Department updated successfully.';
                $responseCode = 200;
            } else {
                DB::table('department_tb')->insert($data);

                $message = 'Department created successfully.';
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
                'message' => 'Unable to save department. Please try again.',
            ], 500);
        }
    }

    public function getDepartments()
    {
        try {
            $departments = DB::table('department_tb')
                ->orderByDesc('ID')
                ->get([
                    'ID',
                    'department_name',
                    'status',
                ])
                ->map(function ($department) {
                    return [
                        'ID' => $department->ID,
                        'department_name' => $department->department_name,
                        'status' => (int) $department->status,
                    ];
                });

            return response()->json([
                'status' => true,
                'data' => $departments,
                'message' => 'Departments retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load departments. Please try again.',
            ], 500);
        }
    }

    public function fetchDepartmentData(Request $request)
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

            $department = DB::table('department_tb')
                ->where('ID', $validator->validated()['upd_id'])
                ->first([
                    'ID',
                    'department_name',
                    'status',
                ]);

            if (!$department) {
                return response()->json([
                    'status' => false,
                    'message' => 'Department not found.',
                ], 404);
            }

            $department->status = (int) $department->status;

            return response()->json([
                'status' => true,
                'data' => $department,
                'message' => 'Department retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch department. Please try again.',
            ], 500);
        }
    }
}
