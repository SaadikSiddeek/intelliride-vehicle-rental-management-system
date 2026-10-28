<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    // ================= CREATE / UPDATE =================

    public function saveRole(Request $request)
    {
        try {
            $requestValidator = Validator::make($request->all(), [
                'upd_id' => ['nullable', 'integer', 'min:1'],
                'form_data' => ['required', 'array'],
            ]);

            if ($requestValidator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $requestValidator->errors(),
                ], 422);
            }

            $updateId = $request->input('upd_id');
            $existingRole = null;

            if ($updateId !== null && $updateId !== '') {
                $existingRole = DB::table('roles_tb')
                    ->where('ID', $updateId)
                    ->first(['ID']);

                if (!$existingRole) {
                    return response()->json([
                        'status' => false,
                        'message' => 'Role not found.',
                    ], 404);
                }
            }

            $isUpdate = $existingRole !== null;

            $roleNameRule = Rule::unique('roles_tb', 'role_name');

            if ($isUpdate) {
                // Use the verified database ID and uppercase primary key.
                $roleNameRule->ignore($existingRole->ID, 'ID');
            }

            $validator = Validator::make(
                $request->input('form_data'),
                [
                    'role_name' => [
                        'required',
                        'string',
                        'max:100',
                        $roleNameRule,
                    ],
                    'role_description' => [
                        'required',
                        'string',
                        'max:255',
                    ],
                    'status' => ['required', 'boolean'],
                ],
                [
                    'role_name.required' => 'Role name is required.',
                    'role_name.unique' => 'This role name already exists.',
                    'role_name.max' => 'Role name cannot exceed 100 characters.',
                    'role_description.required' => 'Description is required.',
                    'role_description.max' => 'Description cannot exceed 255 characters.',
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
                'role_name' => $validated['role_name'],
                'description' => $validated['role_description'],
                'status' => (int) $validated['status'],
                'updated_at' => now(),
            ];

            if ($isUpdate) {
                $roleId = $existingRole->ID;

                // Preserve the existing branch and creation timestamp.
                DB::table('roles_tb')
                    ->where('ID', $roleId)
                    ->update($data);

                $message = 'Role updated successfully.';
                $responseCode = 200;
            } else {
                $data['branch_id'] = 1;
                $data['created_at'] = now();

                $roleId = DB::table('roles_tb')
                    ->insertGetId($data, 'ID');

                $message = 'Role created successfully.';
                $responseCode = 201;
            }

            $role = DB::table('roles_tb')
                ->where('ID', $roleId)
                ->first([
                    'ID',
                    'role_name',
                    'description',
                    'branch_id',
                    'status',
                    'created_at',
                    'updated_at',
                ]);

            $role->status = (int) $role->status;

            return response()->json([
                'status' => true,
                'data' => $role,
                'message' => $message,
            ], $responseCode);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save role. Please try again.',
            ], 500);
        }
    }

    // ================= GET TABLE RECORDS =================

    public function getRoles(Request $request)
    {
        try {
            $roles = DB::table('roles_tb')
                ->orderByDesc('ID')
                ->get([
                    'ID',
                    'role_name',
                    'description',
                    'branch_id',
                    'status',
                ]);

            $data = $roles->map(function ($role) {
                return [
                    'id' => $role->ID,
                    'role_name' => $role->role_name,
                    'description' => $role->description,
                    'branch_id' => $role->branch_id,
                    'status' => (int) $role->status,
                ];
            });

            return response()->json([
                'status' => true,
                'data' => $data,
                'message' => 'Roles retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load roles. Please try again.',
            ], 500);
        }
    }

    // ================= FETCH ONE RECORD FOR EDIT =================

    public function fetchRoleData(Request $request)
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

            $role = DB::table('roles_tb')
                ->where('ID', $validator->validated()['upd_id'])
                ->first([
                    'ID',
                    'role_name',
                    'description',
                    'branch_id',
                    'status',
                ]);

            if (!$role) {
                return response()->json([
                    'status' => false,
                    'message' => 'Role not found.',
                ], 404);
            }

            $role->status = (int) $role->status;

            return response()->json([
                'status' => true,
                'data' => $role,
                'message' => 'Role retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch role. Please try again.',
            ], 500);
        }
    }
}
