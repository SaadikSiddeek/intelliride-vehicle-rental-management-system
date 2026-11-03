<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BranchController extends Controller
{
    // ================= CREATE / UPDATE =================

    public function saveBranch(Request $request)
    {
        try {
            $request->validate([
                'upd_id' => ['nullable', 'integer', 'min:1'],
            ]);

            return DB::transaction(function () use ($request) {
                $existingBranch = null;

                if ($request->filled('upd_id')) {
                    $existingBranch = DB::table('branch_tb')
                        ->where('ID', $request->input('upd_id'))
                        ->lockForUpdate()
                        ->first(['ID']);

                    if (!$existingBranch) {
                        return $this->branchNotFound();
                    }
                }

                $branchCodeRule = Rule::unique('branch_tb', 'branch_code');

                if ($existingBranch) {
                    $branchCodeRule->ignore($existingBranch->ID, 'ID');
                }

                $validated = $request->validate([
                    'branch_name' => ['required', 'string', 'max:100'],
                    'branch_code' => ['required', 'string', 'max:50', $branchCodeRule],
                    'address' => ['nullable', 'string', 'max:5000'],
                    'contact_number' => ['nullable', 'string', 'max:20'],
                    'manager_id' => [
                        'nullable',
                        'integer',
                        'min:1',
                        Rule::exists('staff_tb', 'ID'),
                    ],
                    'status' => ['required', 'boolean'],
                ], [
                    'branch_name.required' => 'Branch name is required.',
                    'branch_code.required' => 'Branch code is required.',
                    'branch_code.unique' => 'This branch code is already in use.',
                    'manager_id.exists' => 'The selected manager no longer exists. Please select another staff member.',
                ]);

                $data = [
                    'branch_name' => $validated['branch_name'],
                    'branch_code' => $validated['branch_code'],
                    'address' => $validated['address'] ?? null,
                    'contact_number' => $validated['contact_number'] ?? null,
                    'manager_id' => $validated['manager_id'] ?? null,
                    'status' => (int) $validated['status'],
                    'updated_at' => now(),
                ];

                if ($existingBranch) {
                    $branchId = $existingBranch->ID;

                    DB::table('branch_tb')
                        ->where('ID', $branchId)
                        ->update($data);

                    $message = 'Branch updated successfully.';
                    $httpCode = 200;
                } else {
                    $data['created_at'] = $data['updated_at'];

                    $branchId = DB::table('branch_tb')
                        ->insertGetId($data, 'ID');

                    $message = 'Branch created successfully.';
                    $httpCode = 201;
                }

                return response()->json([
                    'status' => true,
                    'data' => ['ID' => $branchId] + $data,
                    'message' => $message,
                ], $httpCode);
            });
        } catch (ValidationException $e) {
            return $this->validationError($e);
        } catch (QueryException $e) {
            // Handles concurrent inserts using the same branch code.
            if (
                (int) ($e->errorInfo[1] ?? 0) === 1062 &&
                str_contains($e->getMessage(), 'branch_tb_branch_code_unique')
            ) {
                return response()->json([
                    'status' => false,
                    'errors' => [
                        'branch_code' => ['This branch code is already in use.'],
                    ],
                ], 422);
            }

            return $this->serverError($e, 'Unable to save branch.');
        } catch (\Throwable $e) {
            return $this->serverError($e, 'Unable to save branch.');
        }
    }

    // ================= BRANCH LIST + MANAGER OPTIONS =================

    public function getBranches()
    {
        try {
            $branches = DB::table('branch_tb as b')
                ->leftJoin('staff_tb as s', 's.ID', '=', 'b.manager_id')
                ->select([
                    'b.ID as id',
                    'b.branch_name',
                    'b.branch_code',
                    'b.address',
                    'b.contact_number',
                    'b.manager_id',
                    'b.status',
                ])
                ->selectRaw(
                    "TRIM(CONCAT_WS(' ', s.first_name, s.last_name)) AS manager"
                )
                ->orderByDesc('b.ID')
                ->get();

            // Option value = staff ID. Option label = staff full name.
            $managers = DB::table('staff_tb')
                ->select('ID as id')
                ->selectRaw(
                    "TRIM(CONCAT_WS(' ', first_name, last_name)) AS name"
                )
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->orderBy('ID')
                ->get();

            return response()->json([
                'status' => true,
                'data' => $branches,
                'managers' => $managers,
                'message' => 'Branches retrieved successfully.',
            ]);
        } catch (\Throwable $e) {
            return $this->serverError($e, 'Unable to load branches.');
        }
    }

    // ================= FETCH ONE BRANCH FOR EDIT =================

    public function fetchBranchData(Request $request)
    {
        try {
            $validated = $request->validate([
                'upd_id' => ['required', 'integer', 'min:1'],
            ]);

            $branch = DB::table('branch_tb')
                ->where('ID', $validated['upd_id'])
                ->first([
                    'ID',
                    'branch_name',
                    'branch_code',
                    'address',
                    'contact_number',
                    'manager_id',
                    'status',
                ]);

            if (!$branch) {
                return $this->branchNotFound();
            }

            return response()->json([
                'status' => true,
                'data' => $branch,
                'message' => 'Branch retrieved successfully.',
            ]);
        } catch (ValidationException $e) {
            return $this->validationError($e);
        } catch (\Throwable $e) {
            return $this->serverError($e, 'Unable to fetch branch.');
        }
    }

    // ================= DELETE UNUSED BRANCH =================

    public function deleteBranch(Request $request)
    {
        try {
            $validated = $request->validate([
                'upd_id' => ['required', 'integer', 'min:1'],
            ]);

            return DB::transaction(function () use ($validated) {
                $branch = DB::table('branch_tb')
                    ->where('ID', $validated['upd_id'])
                    ->lockForUpdate()
                    ->first(['ID']);

                if (!$branch) {
                    return $this->branchNotFound();
                }

                // Your schema includes cascading branch relationships.
                // Check the references before issuing the delete.
                $references = [
                    'department_tb' => 'departments',
                    'designation_tb' => 'designations',
                    'roles_tb' => 'roles',
                    'staff_tb' => 'staff members',
                    'users_tb' => 'users',
                    'vehicle_tb' => 'vehicles',
                ];

                foreach ($references as $table => $label) {
                    $inUse = DB::table($table)
                        ->where('branch_id', $branch->ID)
                        ->exists();

                    if ($inUse) {
                        return response()->json([
                            'status' => false,
                            'message' => "This branch has linked {$label}. "
                                . 'You can mark it inactive instead.',
                        ], 409);
                    }
                }

                DB::table('branch_tb')
                    ->where('ID', $branch->ID)
                    ->delete();

                return response()->json([
                    'status' => true,
                    'data' => ['ID' => $branch->ID],
                    'message' => 'Branch deleted successfully.',
                ]);
            });
        } catch (ValidationException $e) {
            return $this->validationError($e);
        } catch (QueryException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) === 1451) {
                return response()->json([
                    'status' => false,
                    'message' => 'Another record uses this branch. You can mark it inactive instead.',
                ], 409);
            }

            return $this->serverError($e, 'Unable to delete branch.');
        } catch (\Throwable $e) {
            return $this->serverError($e, 'Unable to delete branch.');
        }
    }

    private function branchNotFound()
    {
        return response()->json([
            'status' => false,
            'message' => 'Branch not found.',
        ], 404);
    }

    private function validationError(ValidationException $e)
    {
        return response()->json([
            'status' => false,
            'message' => 'Please check the highlighted fields.',
            'errors' => $e->errors(),
        ], 422);
    }

    private function serverError(\Throwable $e, string $message)
    {
        report($e);

        return response()->json([
            'status' => false,
            'message' => $message . ' Please try again.',
        ], 500);
    }
}
