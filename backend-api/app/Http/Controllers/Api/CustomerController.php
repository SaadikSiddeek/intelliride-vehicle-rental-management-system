<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class CustomerController extends Controller
{
    private const DOCUMENT_SLOTS = [
        'nic_front',
        'nic_back',
        'passport',
        'licence_front',
        'licence_back',
    ];

    private function authorizeStaff(Request $request): void
    {
        $allowedUsers = config('customer_access.users', []);

        abort_unless(
            in_array((string) $request->user()->getAuthIdentifier(), $allowedUsers, true),
            403,
            'Customer management access is required.'
        );
    }

    private function customerCode($id): string
    {
        return 'CUS-' . str_pad((string) $id, 6, '0', STR_PAD_LEFT);
    }

    private function documentDisk()
    {
        return Storage::build([
            'driver' => 'local',
            'root' => storage_path('app/private/customer-documents'),
            'visibility' => 'private',
            'throw' => true,
        ]);
    }

    private function cleanFiles($disk, array $paths): void
    {
        foreach ($paths as $path) {
            try {
                $disk->delete($path);
            } catch (Throwable $error) {
                report($error);
            }
        }
    }

    // ================= CREATE / UPDATE =================

    public function saveCustomer(Request $request)
    {
        $this->authorizeStaff($request);

        $phoneRules = [
            'string',
            'max:30',
            'regex:/^\+?[0-9 ()-]+$/',
            function ($attribute, $value, $fail) {
                $digits = preg_replace('/\D/', '', $value);

                if (strlen($digits) < 7 || strlen($digits) > 15) {
                    $fail('Enter a phone number containing 7 to 15 digits.');
                }
            },
        ];

        $rules = [
            'upd_id' => ['nullable', 'integer', 'min:1'],
            'customer_type' => ['required', Rule::in(['Local', 'Tourist'])],
            'full_name' => ['required', 'string', 'max:150'],
            'mobile' => ['bail', 'required', ...$phoneRules],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'country' => ['required_if:customer_type,Tourist', 'nullable', 'string', 'max:100'],

            'document_type' => [
                'required_with:document_number,document_expiry',
                'nullable',
                Rule::in(['NIC', 'Passport']),
            ],
            'document_number' => ['nullable', 'string', 'max:50'],
            'document_expiry' => ['nullable', 'date_format:Y-m-d'],

            'licence_number' => ['nullable', 'string', 'max:50'],
            'licence_country' => [
                'required_with:licence_number,licence_expiry,licence_front,licence_back',
                'nullable',
                'string',
                'max:100',
            ],
            'licence_expiry' => ['nullable', 'date_format:Y-m-d'],

            'emergency_name' => ['nullable', 'string', 'max:150'],
            'emergency_number' => ['bail', 'nullable', ...$phoneRules],
            'notes' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', Rule::in(['Active', 'Inactive', 'Blocked'])],
            'block_reason' => ['required_if:status,Blocked', 'nullable', 'string', 'max:500'],

            'remove' => ['sometimes', 'array'],
            'remove.*' => ['distinct', Rule::in(self::DOCUMENT_SLOTS)],
        ];

        foreach (self::DOCUMENT_SLOTS as $slot) {
            $rules[$slot] = ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'];
        }

        $validator = Validator::make($request->all(), $rules, [
            'full_name.required' => 'Full name is required.',
            'mobile.required' => 'Mobile number is required.',
            'country.required_if' => 'Country is required for tourist customers.',
            'document_type.required_with' => 'Select NIC or Passport for these document details.',
            'licence_country.required_with' => 'Enter the country that issued the driving licence.',
            'block_reason.required_if' => 'Enter a reason for blocking this customer.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        $updateId = $data['upd_id'] ?? null;
        $remove = $data['remove'] ?? [];

        unset($data['upd_id'], $data['remove']);

        foreach (self::DOCUMENT_SLOTS as $slot) {
            unset($data[$slot]);
        }

        if ($data['status'] !== 'Blocked') {
            $data['block_reason'] = null;
        }

        if (($data['document_type'] ?? null) !== 'Passport') {
            $data['document_expiry'] = null;
        }

        $disk = $this->documentDisk();
        $newPaths = [];
        $oldPaths = [];

        try {
            $customerId = DB::transaction(function () use (
                $request,
                $updateId,
                $data,
                $remove,
                $disk,
                &$newPaths,
                &$oldPaths
            ) {
                $data['updated_at'] = now();

                if ($updateId !== null) {
                    $customer = DB::table('customer_tb')
                        ->where('ID', $updateId)
                        ->lockForUpdate()
                        ->first(['ID']);

                    if (!$customer) {
                        throw new NotFoundHttpException('Customer not found.');
                    }

                    $customerId = $customer->ID;
                    DB::table('customer_tb')->where('ID', $customerId)->update($data);
                } else {
                    $data['created_at'] = now();
                    $customerId = DB::table('customer_tb')->insertGetId($data, 'ID');
                }

                // A licence scan retained from a previous edit also needs an issuing country.
                if (empty($data['licence_country'])) {
                    $hasSavedLicence = DB::table('customer_document_tb')
                        ->where('customer_id', $customerId)
                        ->whereIn('kind', ['licence_front', 'licence_back'])
                        ->whereNotIn('kind', $remove)
                        ->exists();

                    if ($hasSavedLicence) {
                        throw ValidationException::withMessages([
                            'licence_country' => ['Enter the issuing country for the saved driving licence.'],
                        ]);
                    }
                }

                // DOCUMENT UPLOAD / REPLACEMENT / REMOVAL
                foreach (self::DOCUMENT_SLOTS as $slot) {
                    $file = $request->file($slot);
                    $shouldRemove = in_array($slot, $remove, true);

                    if (!$file && !$shouldRemove) {
                        continue;
                    }

                    $query = DB::table('customer_document_tb')
                        ->where('customer_id', $customerId)
                        ->where('kind', $slot);

                    $existing = $query->first();

                    if ($existing) {
                        $oldPaths[] = $existing->path;
                    }

                    if (!$file) {
                        $query->delete();
                        continue;
                    }

                    $path = $disk->putFile("customer_{$customerId}", $file);

                    if (!$path) {
                        throw new \RuntimeException('Unable to store the customer document.');
                    }

                    $newPaths[] = $path;

                    if ($existing) {
                        $query->update([
                            'path' => $path,
                            'updated_at' => now(),
                        ]);
                    } else {
                        DB::table('customer_document_tb')->insert([
                            'customer_id' => $customerId,
                            'kind' => $slot,
                            'path' => $path,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }

                return $customerId;
            });
        } catch (ValidationException $error) {
            $this->cleanFiles($disk, $newPaths);

            return response()->json([
                'status' => false,
                'errors' => $error->errors(),
            ], 422);
        } catch (NotFoundHttpException $error) {
            return response()->json([
                'status' => false,
                'message' => $error->getMessage(),
            ], 404);
        } catch (Throwable $error) {
            $this->cleanFiles($disk, $newPaths);
            report($error);

            return response()->json([
                'status' => false,
                'message' => 'Unable to save customer. Please try again.',
            ], 500);
        }

        // Remove superseded files only after the database transaction succeeds.
        $this->cleanFiles($disk, $oldPaths);

        return response()->json([
            'status' => true,
            'data' => [
                'ID' => $customerId,
                'customer_code' => $this->customerCode($customerId),
            ],
            'message' => $updateId !== null
                ? 'Customer updated successfully.'
                : 'Customer created successfully.',
        ], $updateId !== null ? 200 : 201);
    }

    // ================= GET TABLE RECORDS =================

    public function getCustomers(Request $request)
    {
        $this->authorizeStaff($request);

        try {
            $customers = DB::table('customer_tb')
                ->orderByDesc('ID')
                ->get([
                    'ID as id',
                    'customer_type',
                    'full_name',
                    'mobile',
                    'email',
                    'status',
                ]);

            foreach ($customers as $customer) {
                $customer->customer_code = $this->customerCode($customer->id);
            }

            return response()->json([
                'status' => true,
                'data' => $customers,
                'message' => 'Customers retrieved successfully.',
            ])->header('Cache-Control', 'private, no-store');
        } catch (Throwable $error) {
            report($error);

            return response()->json([
                'status' => false,
                'message' => 'Unable to load customers. Please try again.',
            ], 500);
        }
    }

    // ================= FETCH ONE RECORD FOR EDIT =================

    public function fetchCustomerData(Request $request)
    {
        $this->authorizeStaff($request);

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
            $customer = DB::table('customer_tb')
                ->where('ID', $request->input('upd_id'))
                ->first();

            if (!$customer) {
                return response()->json([
                    'status' => false,
                    'message' => 'Customer not found.',
                ], 404);
            }

            $customer->customer_code = $this->customerCode($customer->ID);

            // Return document IDs by slot. Storage paths stay on the server.
            $customer->documents = DB::table('customer_document_tb')
                ->where('customer_id', $customer->ID)
                ->pluck('ID', 'kind');

            return response()->json([
                'status' => true,
                'data' => $customer,
                'message' => 'Customer retrieved successfully.',
            ])->header('Cache-Control', 'private, no-store');
        } catch (Throwable $error) {
            report($error);

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch customer. Please try again.',
            ], 500);
        }
    }

    // ================= PRIVATE DOCUMENT DOWNLOAD =================

    public function downloadDocument(Request $request, int $id)
    {
        $this->authorizeStaff($request);

        $document = DB::table('customer_document_tb')->where('ID', $id)->first();
        $disk = $this->documentDisk();

        abort_unless($document && $disk->exists($document->path), 404);

        $extension = pathinfo($document->path, PATHINFO_EXTENSION);

        return $disk->download(
            $document->path,
            "{$document->kind}.{$extension}",
            [
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ]
        );
    }
}
