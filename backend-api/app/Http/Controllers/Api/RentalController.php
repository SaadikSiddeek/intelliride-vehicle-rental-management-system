<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Rental;
use App\Services\BookingService;
use App\Services\BusinessProfileService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class RentalController extends Controller
{
    public function authorizeStaff(Request $request): void
    {
        abort_unless(app(\App\Services\AccessService::class)->operations($request->user()), 403, 'Rental operations access is required.');
    }

    public function bookingFilter(Request $request)
    {
        $this->authorizeStaff($request);
        $data = $request->validate(['id' => ['nullable', 'integer', 'min:1'], 'q' => ['nullable', 'string', 'max:100']]);
        $query = DB::table('booking_tb as b')->join('customer_tb as c', 'c.ID', '=', 'b.customer_id')->join('vehicle_tb as v', 'v.ID', '=', 'b.vehicle_id')
            ->where('b.status', 'Confirmed')->whereNotExists(fn ($q) => $q->selectRaw('1')->from('rental_tb as r')->whereColumn('r.booking_id', 'b.ID'));
        if (isset($data['id'])) {
            $query->where('b.ID', $data['id']);
        } elseif (! empty($data['q'])) {
            $q = '%'.$data['q'].'%';
            $query->where(fn ($query) => $query->where('c.full_name', 'like', $q)->orWhere('v.vehicle_number', 'like', $q)->orWhere('b.ID', preg_replace('/^BKG-0*/i', '', $data['q'])));
        }
        $rows = $query->orderBy('b.pickup_at')->limit(20)->get(['b.ID as id', 'c.full_name', 'v.vehicle_number']);

        return response()->json(['success' => true, 'data' => $rows->map(fn ($r) => ['id' => $r->id, 'text' => 'BKG-'.str_pad($r->id, 6, '0', STR_PAD_LEFT).' — '.$r->full_name.' — '.$r->vehicle_number])]);
    }

    public function handoverContext(Request $request)
    {
        $this->authorizeStaff($request);
        $data = $request->validate(['booking_id' => ['required', 'integer', 'min:1']]);
        $row = DB::table('booking_tb as b')->join('customer_tb as c', 'c.ID', '=', 'b.customer_id')->join('vehicle_tb as v', 'v.ID', '=', 'b.vehicle_id')
            ->join('branch_tb as br', 'br.ID', '=', 'b.pickup_branch_id')->where('b.ID', $data['booking_id'])
            ->first(['b.*', 'c.full_name as customer_name', 'v.vehicle_number', 'v.mileage', 'br.branch_name']);
        abort_unless($row, 404, 'Booking not found.');
        $row->pricing_snapshot = json_decode($row->pricing_snapshot, true);

        return response()->json(['status' => true, 'data' => $row])->header('Cache-Control', 'private, no-store');
    }

    public function saveHandover(Request $request, BookingService $bookingService)
    {
        $this->authorizeStaff($request);
        $data = $request->validate([
            'booking_id' => ['required', 'integer', 'min:1'],
            'actual_pickup_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'starting_odometer' => ['required', 'integer', 'between:0,1000000000'],
            'pickup_fuel_litres' => ['required', 'numeric', 'between:0,99999.999', 'decimal:0,3'],
            'driver_name' => ['required', 'string', 'max:150'],
            'driver_document_number' => ['required', 'string', 'max:50'],
            'driver_licence_number' => ['required', 'string', 'max:50'],
            'driver_licence_expiry' => ['required', 'date_format:Y-m-d'],
            'identity_verified' => ['accepted'], 'licence_verified' => ['accepted'],
            'agreement_accepted' => ['accepted'], 'agreement_reference' => ['required', 'string', 'max:150'],
            'existing_damage' => ['nullable', 'string', 'max:4000'], 'condition_notes' => ['required', 'string', 'max:4000'],
            'deposit_received' => ['required', 'numeric', 'regex:/^\d{1,10}(\.\d{1,2})?$/'],
            'deposit_method' => ['nullable', Rule::in(['cash', 'bank_transfer', 'card'])],
            'deposit_reference' => ['nullable', 'string', 'max:150'],
            'photos' => ['sometimes', 'array', 'max:10'], 'photos.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);
        $paths = [];
        try {
            // File side effects cannot be retried implicitly. A failed transaction cleans up its new files.
            $id = DB::transaction(function () use ($request, $data, $bookingService, &$paths) {
                $booking = DB::table('booking_tb')->where('ID', $data['booking_id'])->lockForUpdate()->first();
                abort_unless($booking, 404, 'Booking not found.');
                $vehicle = DB::table('vehicle_tb')->where('ID', $booking->vehicle_id)->lockForUpdate()->first();
                if ($booking->status !== 'Confirmed' || DB::table('rental_tb')->where('booking_id', $booking->ID)->exists()) {
                    throw ValidationException::withMessages(['booking_id' => 'Only a confirmed booking without a handover can be activated.']);
                }
                if (! $vehicle || $vehicle->status !== 'Available' || (int) $vehicle->branch_id !== (int) $booking->pickup_branch_id) {
                    throw ValidationException::withMessages(['booking_id' => 'The booked vehicle is not available at the pickup branch.']);
                }
                $pickup = CarbonImmutable::createFromFormat('!Y-m-d\TH:i', $data['actual_pickup_at'], config('rental.timezone'));
                if ($pickup->isAfter(now(config('rental.timezone'))) || $pickup->format('Y-m-d H:i:s') < $booking->pickup_at || $pickup->format('Y-m-d H:i:s') >= $booking->expected_return_at) {
                    throw ValidationException::withMessages(['actual_pickup_at' => 'Pickup must be within the reserved period and cannot be in the future.']);
                }
                if ($data['driver_licence_expiry'] < substr($booking->expected_return_at, 0, 10)) {
                    throw ValidationException::withMessages(['driver_licence_expiry' => 'The driving licence must cover the expected rental period.']);
                }
                if ((int) $data['starting_odometer'] < (int) $vehicle->mileage) {
                    throw ValidationException::withMessages(['starting_odometer' => 'Starting odometer cannot be below the recorded vehicle mileage.']);
                }
                $customer = DB::table('customer_tb')->where('ID', $booking->customer_id)->lockForUpdate()->first();
                if (! $customer || $customer->status !== 'Active') {
                    throw ValidationException::withMessages(['booking_id' => 'The booking customer must be active.']);
                }
                $branch = DB::table('branch_tb')->where('ID', $booking->pickup_branch_id)->lockForUpdate()->first();
                if (! $branch || ! (int) $branch->status) {
                    throw ValidationException::withMessages(['booking_id' => 'The pickup branch must be active.']);
                }
                $bookingService->assertAvailable(['vehicle_id' => $vehicle->ID, 'pickup_at' => $data['actual_pickup_at'], 'expected_return_at' => str_replace(' ', 'T', substr($booking->expected_return_at, 0, 16))], $booking->ID);
                $pricing = json_decode($booking->pricing_snapshot, true, 512, JSON_THROW_ON_ERROR);
                $deposit = BookingService::cents($data['deposit_received']);
                if ($deposit !== BookingService::cents($pricing['security_deposit'])) {
                    throw ValidationException::withMessages(['deposit_received' => 'Collect exactly the agreed security deposit. Advance rental payments are separate.']);
                }
                if ($deposit > 0 && (empty($data['deposit_method']) || ($data['deposit_method'] !== 'cash' && empty($data['deposit_reference'])))) {
                    throw ValidationException::withMessages(['deposit_method' => 'Record a deposit method and a reference for bank/card receipts.']);
                }
                $user = $request->user();
                // UserController stores staff_tb.ID in emp_id. staff_tb.user_id is the creator, not the employee link.
                $staff = ctype_digit((string) $user->emp_id) ? DB::table('staff_tb')->where('ID', $user->emp_id)->where('status', 1)->first() : null;
                $staffName = $staff ? trim($staff->first_name.' '.$staff->last_name) : $user->username;
                $block = DB::table('vehicle_unavailability_tb')->insertGetId(['vehicle_id' => $vehicle->ID, 'booking_id' => $booking->ID, 'kind' => 'Active Rental', 'status' => 'Active', 'starts_at' => $pickup->format('Y-m-d H:i:s'), 'ends_at' => null, 'notes' => 'Open-ended rental block; close only after reviewed return finalization.', 'created_at' => now(), 'updated_at' => now()], 'ID');
                $id = Rental::query()->create([
                    'booking_id' => $booking->ID, 'vehicle_id' => $vehicle->ID, 'customer_id' => $customer->ID, 'pickup_branch_id' => $branch->ID, 'availability_block_id' => $block,
                    'handed_over_by' => $user->getAuthIdentifier(), 'handover_staff_id' => $staff?->ID, 'handover_staff_name' => $staffName,
                    'actual_pickup_at' => $pickup->format('Y-m-d H:i:s'), 'starting_odometer' => $data['starting_odometer'], 'pickup_fuel_litres' => $data['pickup_fuel_litres'],
                    'driver_name' => $data['driver_name'], 'driver_document_number' => $data['driver_document_number'], 'driver_licence_number' => $data['driver_licence_number'], 'driver_licence_expiry' => $data['driver_licence_expiry'],
                    'identity_verified' => true, 'licence_verified' => true, 'existing_damage' => $data['existing_damage'] ?? null, 'condition_notes' => $data['condition_notes'],
                    'agreement_reference' => $data['agreement_reference'], 'agreement_accepted_at' => now(), 'pricing_snapshot' => $pricing,
                    'rental_snapshot' => ['timezone' => config('rental.timezone'), 'expected_return_at' => $booking->expected_return_at,
                        'customer' => ['name' => $customer->full_name, 'document_type' => $customer->document_type, 'document_number' => $customer->document_number, 'phone' => $customer->mobile, 'address' => $customer->address],
                        'vehicle' => ['name' => trim((string) DB::table('vehicle_brand_tb')->where('ID', $vehicle->brand_id)->value('brand_name').' '.(string) DB::table('vehicle_model_tb')->where('ID', $vehicle->model_id)->value('model_name')), 'number' => $vehicle->vehicle_number, 'brand_id' => $vehicle->brand_id, 'model_id' => $vehicle->model_id],
                        'pickup_branch' => $branch->branch_name, 'return_branch' => $branch->branch_name,
                        'return_policy' => app(BusinessProfileService::class)->policy()],
                    'status' => 'Active',
                ])->ID;
                if ($deposit > 0) {
                    DB::table('rental_deposit_tb')->insert(['rental_id' => $id, 'entry_type' => 'Received', 'amount' => BookingService::money($deposit), 'method' => $data['deposit_method'], 'reference' => $data['deposit_reference'] ?? null, 'reason' => 'Agreed refundable security deposit collected at handover.', 'recorded_by' => $user->getAuthIdentifier(), 'created_at' => now(), 'updated_at' => now()]);
                }
                foreach ($request->file('photos', []) as $file) {
                    $path = Storage::disk('rental_documents')->putFile('rental_'.$id.'/handover', $file);
                    $paths[] = $path;
                    DB::table('rental_photo_tb')->insert(['rental_id' => $id, 'stage' => 'Handover', 'path' => $path, 'uploaded_by' => $user->getAuthIdentifier(), 'created_at' => now(), 'updated_at' => now()]);
                }
                DB::table('booking_tb')->where('ID', $booking->ID)->update(['status' => 'Converted to Rental', 'updated_by' => $user->getAuthIdentifier(), 'updated_at' => now()]);
                DB::table('vehicle_tb')->where('ID', $vehicle->ID)->update(['status' => 'Rented', 'mileage' => $data['starting_odometer'], 'updated_at' => now()]);

                return $id;
            });
        } catch (Throwable $error) {
            foreach ($paths as $path) {
                try {
                    Storage::disk('rental_documents')->delete($path);
                } catch (Throwable $cleanupError) {
                    report($cleanupError);
                }
            }
            throw $error;
        }

        return response()->json(['status' => true, 'data' => ['ID' => $id], 'message' => 'Handover recorded and rental activated.'], 201);
    }

    public function getRentals(Request $request)
    {
        $this->authorizeStaff($request);
        $filters = $request->validate(['status' => ['nullable', Rule::in(['Active', 'Completed'])], 'branch_id' => ['nullable', 'integer', 'min:1'], 'q' => ['nullable', 'string', 'max:100']]);
        $query = Rental::query();
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['branch_id'])) {
            $query->where('pickup_branch_id', $filters['branch_id']);
        }
        // List deliberately excludes document numbers and internal storage paths.
        $rows = $query->orderByDesc('ID')->get()->map(fn ($r) => [
            'id' => $r->ID, 'rental_number' => 'RNT-'.str_pad($r->ID, 6, '0', STR_PAD_LEFT), 'booking_number' => 'BKG-'.str_pad($r->booking_id, 6, '0', STR_PAD_LEFT),
            'customer_name' => $r->rental_snapshot['customer']['name'], 'vehicle_number' => $r->rental_snapshot['vehicle']['number'],
            'pickup_branch' => $r->rental_snapshot['pickup_branch'], 'actual_pickup_at' => $r->actual_pickup_at, 'expected_return_at' => $r->rental_snapshot['expected_return_at'],
            'starting_odometer' => $r->starting_odometer, 'pickup_fuel_litres' => $r->pickup_fuel_litres, 'handed_over_by' => $r->handover_staff_name, 'status' => $r->status,
        ]);
        if (! empty($filters['q'])) {
            $q = mb_strtolower($filters['q']);
            $rows = $rows->filter(fn ($r) => str_contains(mb_strtolower(implode(' ', array_values($r))), $q))->values();
        }

        return response()->json(['status' => true, 'data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function fetchRentalData(Request $request)
    {
        $this->authorizeStaff($request);
        $data = $request->validate(['upd_id' => ['required', 'integer', 'min:1']]);
        $rental = Rental::findOrFail($data['upd_id']);
        $rental->setAttribute('photos', DB::table('rental_photo_tb')->where('rental_id', $rental->ID)->get(['ID', 'stage']));
        $rental->setAttribute('deposits', DB::table('rental_deposit_tb')->where('rental_id', $rental->ID)->orderBy('ID')->get());

        return response()->json(['status' => true, 'data' => $rental])->header('Cache-Control', 'private, no-store');
    }

    public function downloadPhoto(Request $request, int $id)
    {
        $this->authorizeStaff($request);
        $photo = DB::table('rental_photo_tb')->where('ID', $id)->first();
        $disk = Storage::disk('rental_documents');
        abort_unless($photo && $disk->exists($photo->path), 404);

        return $disk->download($photo->path, 'rental-'.$photo->rental_id.'-'.strtolower($photo->stage).'-'.$photo->ID.'.'.pathinfo($photo->path, PATHINFO_EXTENSION), ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}
