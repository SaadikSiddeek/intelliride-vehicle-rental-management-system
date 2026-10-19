<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    // ================= CREATE / UPDATE =================

    public function saveStaff(Request $request)
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
            $existingStaff = null;

            if ($updateId !== null && $updateId !== '') {
                $existingStaff = DB::table('staff_tb')
                    ->where('ID', $updateId)
                    ->first(['ID']);

                if (!$existingStaff) {
                    return response()->json([
                        'status' => false,
                        'message' => 'Staff member not found.',
                    ], 404);
                }
            }

            $isUpdate = $existingStaff !== null;

            $employeeCodeRule = Rule::unique('staff_tb', 'emp_code');
            $emailRule = Rule::unique('staff_tb', 'email');

            if ($isUpdate) {
                // Ignore the existing database record during validation.
                $employeeCodeRule->ignore($existingStaff->ID, 'ID');
                $emailRule->ignore($existingStaff->ID, 'ID');
            }

            $validator = Validator::make($request->all(), [
                'employee_code' => [
                    'required',
                    'string',
                    'max:50',
                    $employeeCodeRule,
                ],
                'first_name' => ['required', 'string', 'max:100'],
                'last_name' => ['required', 'string', 'max:100'],
                'gender' => ['required', 'in:Male,Female'],
                'nic' => ['required', 'string', 'max:20'],
                'phone_number' => ['required', 'string', 'max:20'],
                'email' => [
                    'required',
                    'email',
                    'max:255',
                    $emailRule,
                ],
                'address' => ['required', 'string', 'max:500'],
                'branch' => ['required', 'integer', 'min:1'],
                'designation' => ['required', 'integer', 'min:1'],
                'department' => ['required', 'integer', 'min:1'],
                'joining_date' => ['required', 'date_format:Y-m-d'],
                'status' => ['required', 'boolean'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            $data = [
                'user_id' => get_user_id(),
                'branch_id' => $validated['branch'],
                'designation_id' => $validated['designation'],
                'department_id' => $validated['department'],
                'emp_code' => $validated['employee_code'],
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'gender' => $validated['gender'],
                'nic' => $validated['nic'],
                'phone' => $validated['phone_number'],
                'email' => $validated['email'],
                'address' => $validated['address'],
                'join_date' => $validated['joining_date'],
                'status' => (int) $validated['status'],
            ];

            if ($isUpdate) {
                $staffId = $existingStaff->ID;

                DB::table('staff_tb')
                    ->where('ID', $staffId)
                    ->update($data);

                $message = 'Staff updated successfully.';
                $responseCode = 200;
            } else {
                $staffId = DB::table('staff_tb')
                    ->insertGetId($data, 'ID');

                $message = 'Staff created successfully.';
                $responseCode = 201;
            }

            return response()->json([
                'status' => true,
                'data' => array_merge(['ID' => $staffId], $data),
                'message' => $message,
            ], $responseCode);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save staff. Please try again.',
            ], 500);
        }
    }

    // ================= GET TABLE RECORDS =================

    public function getStaff(Request $request)
    {
        try {
            $staff = DB::table('staff_tb')
                ->orderByDesc('ID')
                ->get([
                    'ID',
                    'emp_code',
                    'first_name',
                    'last_name',
                    'email',
                    'branch_id',
                    'designation_id',
                    'department_id',
                    'status',
                ]);

            $data = $staff->map(function ($row) {
                return [
                    // Keep lowercase id for your existing Staff table.
                    'id' => $row->ID,
                    'employee_code' => $row->emp_code,
                    'full_name' => trim(
                        $row->first_name . ' ' . $row->last_name
                    ),
                    'email' => $row->email,
                    'branch' => $row->branch_id,
                    'designation' => $row->designation_id,
                    'department' => $row->department_id,
                    'status' => (int) $row->status,
                ];
            });

            return response()->json([
                'status' => true,
                'data' => $data,
                'message' => 'Staff retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load staff. Please try again.',
            ], 500);
        }
    }

    // ================= FETCH ONE RECORD FOR EDIT =================

    public function fetchStaffData(Request $request)
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

            $staff = DB::table('staff_tb')
                ->where('ID', $request->input('upd_id'))
                ->first([
                    'ID',
                    'emp_code',
                    'first_name',
                    'last_name',
                    'gender',
                    'nic',
                    'phone',
                    'email',
                    'address',
                    'branch_id',
                    'designation_id',
                    'department_id',
                    'join_date',
                    'status',
                ]);

            if (!$staff) {
                return response()->json([
                    'status' => false,
                    'message' => 'Staff member not found.',
                ], 404);
            }

            // Return a date-only string for Flatpickr.
            $staff->join_date = $staff->join_date
                ? substr((string) $staff->join_date, 0, 10)
                : '';

            $staff->status = (int) $staff->status;

            return response()->json([
                'status' => true,
                'data' => $staff,
                'message' => 'Staff member retrieved successfully.',
            ], 200);
        } catch (\Throwable $th) {
            report($th);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch staff. Please try again.',
            ], 500);
        }
    }
}
