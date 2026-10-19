<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Create or update a user.
     */
    public function createUser(Request $request)
    {
        try {
            // Validate the request structure first.
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

            $formData = $request->input('form_data');
            $updateId = $request->input('upd_id');

            $existingUser = null;

            if ($updateId !== null && $updateId !== '') {
                $existingUser = DB::table('users_tb')
                    ->where('ID', $updateId)
                    ->first();

                if (!$existingUser) {
                    return response()->json([
                        'status' => false,
                        'message' => 'User not found.',
                    ], 404);
                }
            }

            $isUpdate = $existingUser !== null;

            $usernameRule = Rule::unique('users_tb', 'username');
            $emailRule = Rule::unique('users_tb', 'email');

            if ($isUpdate) {
                // Use the ID retrieved from the database.
                $usernameRule->ignore($existingUser->ID, 'ID');
                $emailRule->ignore($existingUser->ID, 'ID');
            }

            $validator = Validator::make($formData, [
                'role_id' => [
                    'required',
                    'integer',
                    'exists:roles_tb,ID',
                ],
                'username' => [
                    'required',
                    'string',
                    'max:100',
                    $usernameRule,
                ],
                'email' => [
                    'required',
                    'email',
                    'max:150',
                    $emailRule,
                ],
                'password' => [
                    $isUpdate ? 'nullable' : 'required',
                    'string',
                    'min:8',
                    'confirmed',
                ],
                'password_confirmation' => [
                    'nullable',
                    'required_with:password',
                    'string',
                ],
                'emp_id' => [
                    'nullable',
                    'string',
                    'max:50',
                ],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            $data = [
                'role_id' => $validated['role_id'],
                'username' => $validated['username'],
                'email' => $validated['email'],
                'emp_id' => $validated['emp_id'] ?? null,
                'updated_at' => now(),
            ];

            // Only change the password when one is supplied.
            if (
                isset($validated['password']) &&
                $validated['password'] !== ''
            ) {
                $data['password'] = Hash::make($validated['password']);
            }

            if ($isUpdate) {
                $userId = $existingUser->ID;

                DB::table('users_tb')
                    ->where('ID', $userId)
                    ->update($data);

                $message = 'User updated successfully.';
                $responseCode = 200;
            } else {
                $data['branch_id'] = get_br_id() ?? null;
                $data['status'] = true;
                $data['created_at'] = now();

                $userId = DB::table('users_tb')
                    ->insertGetId($data, 'ID');

                $message = 'User created successfully.';
                $responseCode = 201;
            }

            $user = DB::table('users_tb')
                ->where('ID', $userId)
                ->first([
                    'ID',
                    'role_id',
                    'username',
                    'email',
                    'emp_id',
                    'status',
                ]);

            return response()->json([
                'status' => true,
                'data' => $user,
                'message' => $message,
            ], $responseCode);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save the user. Please try again.',
            ], 500);
        }
    }

    /**
     * Retrieve the user list.
     */
    public function getUsers(Request $request)
    {
        try {
            $users = DB::table('users_tb')
                ->orderByDesc('ID')
                ->get([
                    'ID',
                    'role_id',
                    'username',
                    'email',
                    'emp_id',
                    'status',
                ]);

            return response()->json([
                'status' => true,
                'data' => $users,
                'message' => 'Users retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load users. Please try again.',
            ], 500);
        }
    }

    /**
     * Fetch one user to populate the edit form.
     */
    public function fetchUserData(Request $request)
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

            $user = DB::table('users_tb')
                ->where('ID', $request->input('upd_id'))
                ->first([
                    'ID',
                    'role_id',
                    'username',
                    'email',
                    'emp_id',
                    'status',
                ]);

            if (!$user) {
                return response()->json([
                    'status' => false,
                    'message' => 'User not found.',
                ], 404);
            }

            return response()->json([
                'status' => true,
                'data' => $user,
                'message' => 'User retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load the user. Please try again.',
            ], 500);
        }
    }
}
