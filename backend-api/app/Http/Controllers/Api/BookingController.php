<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BookingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    private function authorizeStaff(Request $request): void
    {
        abort_unless(in_array((string) $request->user()->getAuthIdentifier(), config('customer_access.users', []), true), 403, 'Customer management access is required for bookings.');
    }

    private function validated(Request $request): array
    {
        $money = ['nullable', 'numeric', 'regex:/^\d{1,10}(\.\d{1,2})?$/'];

        return $request->validate([
            'upd_id' => ['nullable', 'integer', 'min:1'],
            'customer_id' => ['required', 'integer', Rule::exists('customer_tb', 'ID')->where('status', 'Active')],
            'vehicle_id' => ['required', 'integer', Rule::exists('vehicle_tb', 'ID')],
            'package_id' => ['required', 'integer', Rule::exists('rental_package_tb', 'ID')],
            'pickup_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'expected_return_at' => ['required', 'date_format:Y-m-d\TH:i', 'after:pickup_at'],
            'pickup_branch_id' => ['required', 'integer', Rule::exists('branch_tb', 'ID')->where('status', 1)],
            'return_branch_id' => ['required', 'same:pickup_branch_id'],
            'status' => ['required', Rule::in(['Draft', 'Confirmed'])],
            'agreed_rate' => [...$money, 'gt:0'], 'discount' => $money,
            'extras' => ['sometimes', 'array', 'max:20'],
            'extras.*' => ['required', 'string', 'distinct', Rule::in(array_keys(config('rental.extras', [])))],
            'advance_amount' => $money,
            'payment_method' => ['nullable', Rule::in(['cash', 'bank_transfer', 'card'])],
            'payment_date' => ['nullable', 'date_format:Y-m-d'],
            'payment_reference' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    public function options(Request $request, BookingService $service)
    {
        $this->authorizeStaff($request);

        return response()->json(['status' => true, 'data' => [
            'extras' => collect(config('rental.extras'))->map(fn ($extra, $code) => ['code' => $code, ...$extra])->values(),
            'can_override_pricing' => $service->canOverride($request->user()),
            'tax_basis_points' => config('rental.tax_basis_points'), 'timezone' => config('rental.timezone'),
        ]]);
    }

    public function vehicleFilter(Request $request)
    {
        $this->authorizeStaff($request);
        $data = $request->validate([
            'pickup_at' => ['nullable', 'date_format:Y-m-d\TH:i'],
            'expected_return_at' => ['nullable', 'date_format:Y-m-d\TH:i', 'after:pickup_at'],
            'pickup_branch_id' => ['nullable', 'integer', 'min:1'],
            'id' => ['nullable', 'integer', 'min:1'], 'q' => ['nullable', 'string', 'max:100'],
        ]);
        if (empty($data['pickup_at']) || empty($data['expected_return_at']) || empty($data['pickup_branch_id'])) {
            return response()->json(['success' => true, 'data' => []]);
        }
        $pickup = str_replace('T', ' ', $data['pickup_at']).':00';
        $return = str_replace('T', ' ', $data['expected_return_at']).':00';
        $query = DB::table('vehicle_tb as v')->where('v.status', 'Available')->where('v.branch_id', $data['pickup_branch_id'])
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('booking_tb as b')->whereColumn('b.vehicle_id', 'v.ID')
                ->whereIn('b.status', ['Confirmed', 'Converted to Rental'])->where('b.pickup_at', '<', $return)->where('b.expected_return_at', '>', $pickup))
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('vehicle_unavailability_tb as u')->whereColumn('u.vehicle_id', 'v.ID')
                ->whereIn('u.status', ['Scheduled', 'Active'])->where('u.starts_at', '<', $return)->where(fn ($q) => $q->whereNull('u.ends_at')->orWhere('u.ends_at', '>', $pickup)));
        if (\Illuminate\Support\Facades\Schema::hasTable('rental_tb')) {
            // The original converted booking stops reserving once its rental is completed.
            $query = DB::table('vehicle_tb as v')->where('v.status', 'Available')->where('v.branch_id', $data['pickup_branch_id'])
                ->whereNotExists(function ($q) use ($return, $pickup) {
                    $q->selectRaw('1')->from('booking_tb as b')->whereColumn('b.vehicle_id', 'v.ID')
                        ->whereIn('b.status', ['Confirmed', 'Converted to Rental'])->where('b.pickup_at', '<', $return)->where('b.expected_return_at', '>', $pickup);
                    BookingService::excludeCompletedRentals($q, 'b');
                })
                ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('vehicle_unavailability_tb as u')->whereColumn('u.vehicle_id', 'v.ID')
                    ->whereIn('u.status', ['Scheduled', 'Active'])->where('u.starts_at', '<', $return)->where(fn ($q) => $q->whereNull('u.ends_at')->orWhere('u.ends_at', '>', $pickup)));
        }
        if (isset($data['id'])) {
            $query->where('v.ID', $data['id']);
        } elseif (! empty($data['q'])) {
            $query->where('v.vehicle_number', 'like', '%'.$data['q'].'%');
        }

        return response()->json(['success' => true, 'data' => $query->orderBy('v.vehicle_number')->limit(20)->get(['v.ID as id', 'v.vehicle_number as text'])]);
    }

    public function packageFilter(Request $request)
    {
        $this->authorizeStaff($request);
        $data = $request->validate([
            'vehicle_id' => ['nullable', 'integer', 'min:1'], 'id' => ['nullable', 'integer', 'min:1'], 'q' => ['nullable', 'string', 'max:100'],
        ]);
        $query = DB::table('rental_package_tb')->where('status', 1)->where('vehicle_id', $data['vehicle_id'] ?? 0);
        if (isset($data['id'])) {
            $query->where('ID', $data['id']);
        } elseif (! empty($data['q'])) {
            $query->where('package_name', 'like', '%'.$data['q'].'%');
        }
        $options = $query->orderBy('package_name')->limit(20)->get()->map(fn ($p) => ['id' => $p->ID, 'text' => $p->package_name.' — LKR '.$p->rate_per_unit.' / '.$p->billing_unit]);

        return response()->json(['success' => true, 'data' => $options]);
    }

    public function quote(Request $request, BookingService $service)
    {
        $this->authorizeStaff($request);
        $data = $this->validated($request);

        return response()->json(['status' => true, 'data' => $service->quote($data, $request->user())]);
    }

    public function saveBooking(Request $request, BookingService $service)
    {
        $this->authorizeStaff($request);
        $data = $this->validated($request);
        $id = DB::transaction(function () use ($request, $service, $data) {
            $existing = isset($data['upd_id']) ? DB::table('booking_tb')->where('ID', $data['upd_id'])->lockForUpdate()->first() : null;
            abort_if(isset($data['upd_id']) && ! $existing, 404, 'Booking not found.');
            if ($existing && $existing->status !== 'Draft') {
                throw ValidationException::withMessages(['status' => 'Only drafts can be edited. Cancel a confirmed booking before replacing it.']);
            }
            $vehicle = DB::table('vehicle_tb')->where('ID', $data['vehicle_id'])->lockForUpdate()->first();
            if (! $vehicle || $vehicle->status !== 'Available' || (int) $vehicle->branch_id !== (int) $data['pickup_branch_id']) {
                throw ValidationException::withMessages(['vehicle_id' => 'Select an available vehicle at the pickup branch.']);
            }
            $branch = DB::table('branch_tb')->where('ID', $data['pickup_branch_id'])->lockForUpdate()->first();
            if (! $branch || ! (int) $branch->status) {
                throw ValidationException::withMessages(['pickup_branch_id' => 'This branch is no longer active.']);
            }
            $customer = DB::table('customer_tb')->where('ID', $data['customer_id'])->lockForUpdate()->first();
            if (! $customer || $customer->status !== 'Active') {
                throw ValidationException::withMessages(['customer_id' => 'This customer is no longer active.']);
            }
            $package = DB::table('rental_package_tb')->where('ID', $data['package_id'])->lockForUpdate()->first();
            if ($data['status'] === 'Confirmed') {
                if ($data['pickup_at'] < now(config('rental.timezone'))->format('Y-m-d\TH:i')) {
                    throw ValidationException::withMessages(['pickup_at' => 'A confirmed booking must start in the future.']);
                }
                $service->assertAvailable($data, $existing?->ID);
            }
            $quote = $service->quote($data, $request->user(), $package);
            $advance = BookingService::cents($data['advance_amount'] ?? '0');
            if ($existing && $advance > 0) {
                throw ValidationException::withMessages(['advance_amount' => 'Advance payments can only be recorded when creating a booking.']);
            }
            $alreadyPaid = $existing ? (int) DB::table('booking_payment_tb')->where('booking_id', $existing->ID)->get()->sum(fn ($p) => BookingService::cents($p->amount)) : 0;
            if ($advance + $alreadyPaid > BookingService::cents($quote['total'])) {
                throw ValidationException::withMessages(['advance_amount' => 'Payments cannot exceed the rental total.']);
            }
            if ($advance > 0) {
                if (empty($data['payment_method']) || empty($data['payment_date'])) {
                    throw ValidationException::withMessages(['payment_method' => 'Payment method and date are required for an advance.']);
                }
                if ($data['payment_date'] > now(config('rental.timezone'))->toDateString()) {
                    throw ValidationException::withMessages(['payment_date' => 'Payment date cannot be in the future.']);
                }
                if ($data['payment_method'] !== 'cash' && empty($data['payment_reference'])) {
                    throw ValidationException::withMessages(['payment_reference' => 'A reference is required for bank and card payments.']);
                }
            }
            $paid = $alreadyPaid + $advance;
            $row = [
                'customer_id' => $data['customer_id'], 'vehicle_id' => $data['vehicle_id'], 'package_id' => $data['package_id'],
                'pickup_branch_id' => $data['pickup_branch_id'], 'return_branch_id' => $data['pickup_branch_id'],
                'pickup_at' => str_replace('T', ' ', $data['pickup_at']).':00',
                'expected_return_at' => str_replace('T', ' ', $data['expected_return_at']).':00',
                'status' => $data['status'], 'pricing_snapshot' => json_encode($quote, JSON_THROW_ON_ERROR),
                'payment_status' => $paid === 0 ? (BookingService::cents($quote['total']) === 0 ? 'Paid' : 'Unpaid') : ($paid === BookingService::cents($quote['total']) ? 'Paid' : 'Partially Paid'),
                'subtotal' => $quote['subtotal'], 'discount' => $quote['discount'], 'tax' => $quote['tax'], 'total' => $quote['total'],
                'security_deposit' => $quote['security_deposit'], 'notes' => $data['notes'] ?? null,
                'updated_by' => $request->user()->getAuthIdentifier(), 'updated_at' => now(),
            ];
            if ($existing) {
                DB::table('booking_tb')->where('ID', $existing->ID)->update($row);
                $id = $existing->ID;
            } else {
                $row['created_by'] = $request->user()->getAuthIdentifier();
                $row['created_at'] = now();
                $id = DB::table('booking_tb')->insertGetId($row, 'ID');
            }
            if ($advance > 0) {
                DB::table('booking_payment_tb')->insert([
                    'booking_id' => $id, 'amount' => BookingService::money($advance), 'method' => $data['payment_method'],
                    'paid_on' => $data['payment_date'], 'reference' => $data['payment_reference'] ?? null,
                    'recorded_by' => $request->user()->getAuthIdentifier(), 'created_at' => now(), 'updated_at' => now(),
                ]);
            }

            return $id;
        }, 3);

        return response()->json(['status' => true, 'data' => ['ID' => $id], 'message' => 'Booking saved successfully.'], isset($data['upd_id']) ? 200 : 201);
    }

    public function getBookings(Request $request)
    {
        $this->authorizeStaff($request);
        $filters = $request->validate(['status' => ['nullable', Rule::in(['Draft', 'Confirmed', 'Converted to Rental', 'Cancelled', 'No-show'])]]);
        $query = DB::table('booking_tb as b')->join('customer_tb as c', 'c.ID', '=', 'b.customer_id')->join('vehicle_tb as v', 'v.ID', '=', 'b.vehicle_id');
        if (! empty($filters['status'])) {
            $query->where('b.status', $filters['status']);
        }
        $rows = $query->orderByDesc('b.ID')->get(['b.ID as id', 'c.full_name', 'v.vehicle_number', 'b.pickup_at', 'b.expected_return_at', 'b.status', 'b.payment_status', 'b.total'])
            ->map(fn ($row) => (object) ['booking_code' => 'BKG-'.str_pad($row->id, 6, '0', STR_PAD_LEFT), ...(array) $row]);

        return response()->json(['status' => true, 'data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function fetchBookingData(Request $request)
    {
        $this->authorizeStaff($request);
        $data = $request->validate(['upd_id' => ['required', 'integer', 'min:1']]);
        $booking = DB::table('booking_tb as b')
            ->join('customer_tb as c', 'c.ID', '=', 'b.customer_id')
            ->join('vehicle_tb as v', 'v.ID', '=', 'b.vehicle_id')
            ->join('rental_package_tb as p', 'p.ID', '=', 'b.package_id')
            ->join('branch_tb as br', 'br.ID', '=', 'b.pickup_branch_id')
            ->where('b.ID', $data['upd_id'])->first(['b.*', 'c.full_name as customer_label',
                'v.vehicle_number as vehicle_label', 'p.package_name as package_label', 'br.branch_name as branch_label']);
        abort_unless($booking, 404, 'Booking not found.');
        $booking->pricing_snapshot = json_decode($booking->pricing_snapshot, true);
        $booking->payments = DB::table('booking_payment_tb')->where('booking_id', $booking->ID)->orderBy('ID')->get();

        return response()->json(['status' => true, 'data' => $booking])->header('Cache-Control', 'private, no-store');
    }

    public function changeStatus(Request $request)
    {
        $this->authorizeStaff($request);
        $data = $request->validate(['upd_id' => ['required', 'integer', 'min:1'], 'status' => ['required', Rule::in(['Cancelled', 'No-show'])]]);
        DB::transaction(function () use ($request, $data) {
            $booking = DB::table('booking_tb')->where('ID', $data['upd_id'])->lockForUpdate()->first();
            abort_unless($booking, 404, 'Booking not found.');
            DB::table('vehicle_tb')->where('ID', $booking->vehicle_id)->lockForUpdate()->first();
            if (! in_array($booking->status, ['Draft', 'Confirmed'], true) ||
                ($data['status'] === 'No-show' && ($booking->status !== 'Confirmed' || $booking->pickup_at > now(config('rental.timezone'))->format('Y-m-d H:i:s')))) {
                throw ValidationException::withMessages(['status' => 'This status transition is not allowed.']);
            }
            DB::table('booking_tb')->where('ID', $booking->ID)->update(['status' => $data['status'], 'updated_by' => $request->user()->getAuthIdentifier(), 'updated_at' => now()]);
        }, 3);

        return response()->json(['status' => true, 'message' => 'Booking status updated. Existing payments remain recorded for finance review.']);
    }
}
