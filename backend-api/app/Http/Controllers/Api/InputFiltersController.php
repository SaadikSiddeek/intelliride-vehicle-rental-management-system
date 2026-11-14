<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InputFiltersController extends Controller
{

    public function staffInputFilter(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q'  => ['nullable', 'string', 'max:100'],
        ]);

        $query = DB::table('staff_tb')
            ->select('ID', 'first_name', 'last_name');

        // Apply your existing branch filter here if staff are branch-specific.

        if (isset($filters['id'])) {
            $query->where('ID', $filters['id']);
        } else {
            $search = trim($filters['q'] ?? '');

            if ($search !== '') {
                $query->whereRaw(
                    "CONCAT_WS(' ', first_name, last_name) LIKE ?",
                    ['%' . $search . '%']
                );
            }
        }

        $options = $query
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->orderBy('ID')
            ->limit(20)
            ->get()
            ->map(fn($staff) => [
                'id'   => $staff->ID,
                'text' => trim($staff->first_name . ' ' . $staff->last_name),
            ]);

        return response()->json([
            'success' => true,
            'data'    => $options,
        ]);
    }

    public function roleInputFilter(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q'  => ['nullable', 'string', 'max:100'],
        ]);

        $query = DB::table('roles_tb')
            ->select('ID', 'role_name');
        $p = app(\App\Services\PermissionService::class);
        if ($p->enabled()) {
            $query->where('status', true);
            if ($request->user()->user_type === 'admin') {
                $allowed = $p->delegable($request->user());
                $query->whereNotExists(fn ($q) => $q->selectRaw('1')->from('role_permission_tb as rp')->whereColumn('rp.role_id', 'roles_tb.ID')->whereNotIn('rp.permission_code', $allowed));
            }
        }

        // Apply your existing branch filter here if staff are branch-specific.

        if (isset($filters['id'])) {
            $query->where('ID', $filters['id']);
        } else {
            $search = trim($filters['q'] ?? '');

            if ($search !== '') {
                $query->whereRaw(
                    "CONCAT_WS(' ', role_name) LIKE ?",
                    ['%' . $search . '%']
                );
            }
        }

        $options = $query
            ->orderBy('role_name')
            ->orderBy('ID')
            ->limit(20)
            ->get()
            ->map(fn($role) => [
                'id'   => $role->ID,
                'text' => trim($role->role_name),
            ]);

        return response()->json([
            'success' => true,
            'data'    => $options,
        ]);
    }

    public function branchInputFilter(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q'  => ['nullable', 'string', 'max:100'],
        ]);

        $query = DB::table('branch_tb')
            ->select('ID', 'branch_code', 'branch_name');

        // Apply your existing branch filter here if staff are branch-specific.

        if (isset($filters['id'])) {
            $query->where('ID', $filters['id']);
        } else {
            $search = trim($filters['q'] ?? '');

            if ($search !== '') {
                $query->whereRaw(
                    "CONCAT_WS(' ', branch_code, branch_name) LIKE ?",
                    ['%' . $search . '%']
                );
            }
        }

        $options = $query
            ->orderBy('branch_code')
            ->orderBy('branch_name')
            ->orderBy('ID')
            ->limit(20)
            ->get()
            ->map(fn($branch) => [
                'id'   => $branch->ID,
                'text' => trim($branch->branch_code . ' ' . $branch->branch_name),
            ]);

        return response()->json([
            'success' => true,
            'data'    => $options,
        ]);
    }

    public function departmentInputFilter(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q'  => ['nullable', 'string', 'max:100'],
        ]);

        $query = DB::table('department_tb')
            ->select('ID', 'department_name');

        // Apply your existing branch filter here if staff are branch-specific.

        if (isset($filters['id'])) {
            $query->where('ID', $filters['id']);
        } else {
            $search = trim($filters['q'] ?? '');

            if ($search !== '') {
                $query->whereRaw(
                    "CONCAT_WS(' ', department_name) LIKE ?",
                    ['%' . $search . '%']
                );
            }
        }

        $options = $query
            ->orderBy('department_name')
            ->orderBy('ID')
            ->limit(20)
            ->get()
            ->map(fn($department) => [
                'id'   => $department->ID,
                'text' => trim($department->department_name),
            ]);

        return response()->json([
            'success' => true,
            'data'    => $options,
        ]);
    }

    public function designationInputFilter(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q'  => ['nullable', 'string', 'max:100'],
        ]);

        $query = DB::table('designation_tb')
            ->select('ID', 'designation_name');

        // Apply your existing branch filter here if staff are branch-specific.

        if (isset($filters['id'])) {
            $query->where('ID', $filters['id']);
        } else {
            $search = trim($filters['q'] ?? '');

            if ($search !== '') {
                $query->whereRaw(
                    "CONCAT_WS(' ', designation_name) LIKE ?",
                    ['%' . $search . '%']
                );
            }
        }

        $options = $query
            ->orderBy('designation_name')
            ->orderBy('ID')
            ->limit(20)
            ->get()
            ->map(fn($designation) => [
                'id'   => $designation->ID,
                'text' => trim($designation->designation_name),
            ]);

        return response()->json([
            'success' => true,
            'data'    => $options,
        ]);
    }

    public function fuelTypeInputFilter(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q'  => ['nullable', 'string', 'max:100'],
        ]);

        $query = DB::table('fuel_type_tb')
            ->select('ID', 'fuel_type_name');

        // Apply your existing branch filter here if staff are branch-specific.

        if (isset($filters['id'])) {
            $query->where('ID', $filters['id']);
        } else {
            $search = trim($filters['q'] ?? '');

            if ($search !== '') {
                $query->whereRaw(
                    "CONCAT_WS(' ', fuel_type_name) LIKE ?",
                    ['%' . $search . '%']
                );
            }
        }

        $options = $query
            ->orderBy('fuel_type_name')
            ->orderBy('ID')
            ->limit(20)
            ->get()
            ->map(fn($fuel_type) => [
                'id'   => $fuel_type->ID,
                'text' => trim($fuel_type->fuel_type_name),
            ]);

        return response()->json([
            'success' => true,
            'data'    => $options,
        ]);
    }

    public function transmissionTypeInputFilter(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q'  => ['nullable', 'string', 'max:100'],
        ]);

        $query = DB::table('transmission_type_tb')
            ->select('ID', 'transmission_name');

        // Apply your existing branch filter here if staff are branch-specific.

        if (isset($filters['id'])) {
            $query->where('ID', $filters['id']);
        } else {
            $search = trim($filters['q'] ?? '');

            if ($search !== '') {
                $query->whereRaw(
                    "CONCAT_WS(' ', transmission_name) LIKE ?",
                    ['%' . $search . '%']
                );
            }
        }

        $options = $query
            ->orderBy('transmission_name')
            ->orderBy('ID')
            ->limit(20)
            ->get()
            ->map(fn($transmission_type) => [
                'id'   => $transmission_type->ID,
                'text' => trim($transmission_type->transmission_name),
            ]);

        return response()->json([
            'success' => true,
            'data'    => $options,
        ]);
    }

    public function brandInputFilter(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q'  => ['nullable', 'string', 'max:100'],
        ]);

        $query = DB::table('vehicle_brand_tb')
            ->select('ID', 'brand_name');

        // Apply your existing branch filter here if staff are branch-specific.

        if (isset($filters['id'])) {
            $query->where('ID', $filters['id']);
        } else {
            $search = trim($filters['q'] ?? '');

            if ($search !== '') {
                $query->whereRaw(
                    "CONCAT_WS(' ', brand_name) LIKE ?",
                    ['%' . $search . '%']
                );
            }
        }

        $options = $query
            ->orderBy('brand_name')
            ->orderBy('ID')
            ->limit(20)
            ->get()
            ->map(fn($brand) => [
                'id'   => $brand->ID,
                'text' => trim($brand->brand_name),
            ]);

        return response()->json([
            'success' => true,
            'data'    => $options,
        ]);
    }

    public function vehicleCatInputFilter(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q'  => ['nullable', 'string', 'max:100'],
        ]);

        $query = DB::table('vehicle_category_tb')
            ->select('ID', 'category_name');

        // Apply your existing branch filter here if staff are branch-specific.

        if (isset($filters['id'])) {
            $query->where('ID', $filters['id']);
        } else {
            $search = trim($filters['q'] ?? '');

            if ($search !== '') {
                $query->whereRaw(
                    "CONCAT_WS(' ', category_name) LIKE ?",
                    ['%' . $search . '%']
                );
            }
        }

        $options = $query
            ->orderBy('category_name')
            ->orderBy('ID')
            ->limit(20)
            ->get()
            ->map(fn($category) => [
                'id'   => $category->ID,
                'text' => trim($category->category_name),
            ]);

        return response()->json([
            'success' => true,
            'data'    => $options,
        ]);
    }

    public function modelInputFilter(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q'  => ['nullable', 'string', 'max:100'],
        ]);

        $query = DB::table('vehicle_model_tb')
            ->select('ID', 'model_name', 'manufacture_year');

        // Apply your existing branch filter here if staff are branch-specific.

        if (isset($filters['id'])) {
            $query->where('ID', $filters['id']);
        } else {
            $search = trim($filters['q'] ?? '');

            if ($search !== '') {
                $query->whereRaw(
                    "CONCAT_WS(' ', model_name, manufacture_year) LIKE ?",
                    ['%' . $search . '%']
                );
            }
        }

        $options = $query
            ->orderBy('model_name')
            ->orderBy('ID')
            ->limit(20)
            ->get()
            ->map(fn($model) => [
                'id'   => $model->ID,
                'text' => trim(
                    $model->model_name .
                        ($model->manufacture_year ? ' (' . $model->manufacture_year . ')' : '')
                ),
            ]);

        return response()->json([
            'success' => true,
            'data'    => $options,
        ]);
    }
}
