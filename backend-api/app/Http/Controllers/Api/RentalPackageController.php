<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Throwable;

class RentalPackageController extends Controller
{
    private const TABLE = 'rental_package_tb';

    // ================= VEHICLE DROPDOWN =================

    public function getPackageVehicles(Request $request)
    {
        $filters = $request->validate([
            'id' => ['nullable', 'integer', 'min:1'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        try {
            $query = DB::table('vehicle_tb as v')
                ->leftJoin('vehicle_model_tb as m', 'm.ID', '=', 'v.model_id')
                ->leftJoin('vehicle_brand_tb as b', 'b.ID', '=', 'v.brand_id');
            if (isset($filters['id'])) {
                $query->where('v.ID', $filters['id']);
            } elseif (!empty($filters['q'])) {
                $search = '%'.$filters['q'].'%';
                $query->where(fn ($q) => $q->where('v.vehicle_number', 'like', $search)
                    ->orWhere('m.model_name', 'like', $search)->orWhere('b.brand_name', 'like', $search));
            }
            $vehicles = $query
                ->orderBy('v.vehicle_number')->limit(20)
                ->get([
                    'v.ID as id',
                    'v.vehicle_number',
                    'm.model_name',
                    'b.brand_name',
                ])
                ->map(function ($vehicle) {
                    $model = trim(
                        ($vehicle->brand_name ?? '') . ' ' .
                            ($vehicle->model_name ?? '')
                    );

                    return [
                        'id' => $vehicle->id,
                        'text' => $model === ''
                            ? $vehicle->vehicle_number
                            : $vehicle->vehicle_number . ' — ' . $model,
                    ];
                });

            return response()->json([
                'status' => true,
                'success' => true,
                'data' => $vehicles,
                'message' => 'Vehicles retrieved successfully.',
            ]);
        } catch (Throwable $error) {
            report($error);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load vehicles. Please try again.',
            ], 500);
        }
    }

    // ================= CREATE / UPDATE =================

    public function saveRentalPackage(Request $request)
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
            $existing = null;

            if ($updateId !== null && $updateId !== '') {
                $existing = DB::table(self::TABLE)
                    ->where('ID', $updateId)
                    ->first(['ID']);

                if (!$existing) {
                    return response()->json([
                        'status' => false,
                        'message' => 'Rental package not found.',
                    ], 404);
                }
            }

            // DECIMAL(12,2): up to ten whole digits and two decimal places.
            $money = ['required', 'numeric', 'regex:/^\d{1,10}(\.\d{1,2})?$/'];

            $validator = Validator::make($request->all(), [
                'vehicle_id' => ['bail', 'required', 'integer', Rule::exists('vehicle_tb', 'ID')],
                'package_name' => ['required', 'string', 'max:100'],
                'billing_unit' => ['required', Rule::in(['day', 'week', 'month'])],
                'rate_per_unit' => [...$money, 'gt:0'],
                'included_km_per_unit' => ['nullable', 'integer', 'between:0,1000000'],
                'extra_km_charge' => $money,
                'security_deposit' => $money,
                'minimum_units' => ['required', 'integer', 'between:1,365'],
                'status' => ['required', 'boolean'],
            ], [
                'vehicle_id.required' => 'Please select a vehicle.',
                'vehicle_id.exists' => 'The selected vehicle no longer exists.',
                'package_name.required' => 'Package name is required.',
                'rate_per_unit.gt' => 'Rate per unit must be greater than zero.',
                'minimum_units.between' => 'Enter a minimum between 1 and 365 units.',
                'included_km_per_unit.between' => 'Enter an allowance between 0 and 1,000,000 km.',
                '*.regex' => 'Enter a positive amount or zero, with up to two decimal places.',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $data = $validator->validated();
            $data['package_name'] = trim($data['package_name']);
            $data['included_km_per_unit'] = $data['included_km_per_unit'] ?? null;
            $data['status'] = (int) $data['status'];

            if ($data['included_km_per_unit'] === null) {
                $data['extra_km_charge'] = '0.00';
            }

            $nameRule = Rule::unique(self::TABLE, 'package_name')
                ->where('vehicle_id', $data['vehicle_id']);

            if ($existing) {
                $nameRule->ignore($existing->ID, 'ID');
            }

            $nameValidator = Validator::make($data, [
                'package_name' => ['required', $nameRule],
            ], [
                'package_name.unique' => 'This vehicle already has a package with that name.',
            ]);

            if ($nameValidator->fails()) {
                return response()->json([
                    'status' => false,
                    'errors' => $nameValidator->errors(),
                ], 422);
            }

            $data['updated_at'] = now();

            if ($existing) {
                $id = $existing->ID;
                DB::table(self::TABLE)->where('ID', $id)->update($data);
                $message = 'Rental package updated successfully.';
                $code = 200;
            } else {
                $data['created_at'] = now();
                $id = DB::table(self::TABLE)->insertGetId($data, 'ID');
                $message = 'Rental package created successfully.';
                $code = 201;
            }

            return response()->json([
                'status' => true,
                'data' => ['ID' => $id],
                'message' => $message,
            ], $code);
        } catch (QueryException $error) {
            // Two simultaneous requests can pass validation before either inserts.
            if ((int) ($error->errorInfo[1] ?? 0) === 1062) {
                return response()->json([
                    'status' => false,
                    'errors' => [
                        'package_name' => ['This vehicle already has a package with that name.'],
                    ],
                ], 422);
            }

            report($error);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save rental package. Please try again.',
            ], 500);
        } catch (Throwable $error) {
            report($error);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save rental package. Please try again.',
            ], 500);
        }
    }

    // ================= GET TABLE RECORDS =================

    public function getRentalPackages(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'boolean'],
            'billing_unit' => ['nullable', Rule::in(['day', 'week', 'month'])],
            'vehicle_id' => ['nullable', 'integer', 'min:1'],
        ]);
        try {
            $query = DB::table(self::TABLE.' as p');
            foreach (['status', 'billing_unit', 'vehicle_id'] as $field) {
                if (isset($filters[$field])) $query->where('p.'.$field, $filters[$field]);
            }
            if (!empty($filters['q'])) {
                $search = '%'.$filters['q'].'%';
                $query->where(fn ($q) => $q->where('p.package_name', 'like', $search)->orWhere('v.vehicle_number', 'like', $search));
            }
            $packages = $query
                ->join('vehicle_tb as v', 'v.ID', '=', 'p.vehicle_id')
                ->orderByDesc('p.ID')
                ->get([
                    'p.ID as id',
                    'p.package_name',
                    'v.vehicle_number',
                    'p.billing_unit',
                    'p.rate_per_unit',
                    'p.included_km_per_unit',
                    'p.extra_km_charge',
                    'p.security_deposit',
                    'p.minimum_units',
                    'p.status',
                ]);

            return response()->json([
                'status' => true,
                'data' => $packages,
                'message' => 'Rental packages retrieved successfully.',
            ]);
        } catch (Throwable $error) {
            report($error);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load rental packages. Please try again.',
            ], 500);
        }
    }

    // ================= FETCH ONE RECORD FOR EDIT =================

    public function fetchRentalPackageData(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'upd_id' => ['required', 'integer', 'min:1'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $package = DB::table(self::TABLE)
                ->where('ID', $request->input('upd_id'))
                ->first();

            if (!$package) {
                return response()->json([
                    'status' => false,
                    'message' => 'Rental package not found.',
                ], 404);
            }

            $package->status = (int) $package->status;

            return response()->json([
                'status' => true,
                'data' => $package,
                'message' => 'Rental package retrieved successfully.',
            ]);
        } catch (Throwable $error) {
            report($error);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch rental package. Please try again.',
            ], 500);
        }
    }
}
