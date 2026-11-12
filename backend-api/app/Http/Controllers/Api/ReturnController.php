<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Rental;
use App\Services\BookingService;
use App\Services\BusinessProfileService;
use App\Services\FinanceService;
use App\Services\ReturnService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class ReturnController extends Controller
{
    private function authorizeStaff(Request $r): void
    {
        app(RentalController::class)->authorizeStaff($r);
    }

    public function rentalFilter(Request $request)
    {
        $this->authorizeStaff($request);
        $f = $request->validate(['id' => ['nullable', 'integer', 'min:1'], 'q' => ['nullable', 'string', 'max:100']]);
        $query = Rental::query()->where('status', 'Active');
        if (isset($f['id'])) {
            $query->where('ID', $f['id']);
        }
        $rows = $query->orderByDesc('ID')->get()->map(fn ($r) => ['id' => $r->ID, 'text' => 'RNT-'.str_pad($r->ID, 6, '0', STR_PAD_LEFT).' — '.$r->rental_snapshot['customer']['name'].' — '.$r->rental_snapshot['vehicle']['number']]);
        if (! empty($f['q'])) {
            $rows = $rows->filter(fn ($r) => str_contains(mb_strtolower($r['text']), mb_strtolower($f['q'])))->values();
        }

        return response()->json(['success' => true, 'data' => $rows->take(20)]);
    }

    public function saveAssessment(Request $request, ReturnService $service)
    {
        $this->authorizeStaff($request);
        $money = ['required', 'numeric', 'regex:/^\d{1,10}(\.\d{1,2})?$/'];
        $data = $request->validate(['rental_id' => ['required', 'integer', 'min:1'], 'revision' => ['nullable', 'integer', 'min:1'],
            'actual_return_at' => ['required', 'date_format:Y-m-d\TH:i'], 'ending_odometer' => ['required', 'integer', 'between:0,1000000000'], 'return_fuel_litres' => ['required', 'numeric', 'between:0,99999.999', 'decimal:0,3'],
            'condition_notes' => ['required', 'string', 'max:4000'], 'new_damage' => ['nullable', 'string', 'max:4000'], 'damage_estimate' => $money, 'damage_charge' => $money, 'damage_reason' => ['nullable', 'string', 'max:2000'],
            'vehicle_after_return' => ['required', Rule::in(['Inspection Required', 'Cleaning', 'Maintenance', 'Out of Service', 'Available'])], 'apply_deposit' => ['required', 'boolean'],
            'status' => ['required', Rule::in(['Draft Assessment', 'Pending Review'])], 'photos' => ['sometimes', 'array', 'max:10'], 'photos.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048']]);
        $paths = [];
        try {
            $id = DB::transaction(function () use ($request, $data, $service, &$paths) {
                $rental = Rental::where('ID', $data['rental_id'])->lockForUpdate()->firstOrFail();
                if ($rental->status !== 'Active') {
                    throw ValidationException::withMessages(['rental_id' => 'Only an active rental can be assessed.']);
                }
                $existing = DB::table('rental_return_tb')->where('rental_id', $rental->ID)->lockForUpdate()->first();
                if ($existing && ($existing->status === 'Finalized' || (int) ($data['revision'] ?? 0) !== (int) $existing->revision)) {
                    throw ValidationException::withMessages(['revision' => 'This assessment changed. Reload it before saving.']);
                }
                $row = $data;
                unset($row['revision'],$row['photos']);
                $row['actual_return_at'] = str_replace('T', ' ', $data['actual_return_at']).':00';
                $row['revision'] = $existing ? $existing->revision + 1 : 1;
                $row['updated_at'] = now();
                if ($existing) {
                    $id = $existing->ID;
                    DB::table('rental_return_tb')->where('ID', $id)->update($row);
                } else {
                    $user = $request->user();
                    $staff = ctype_digit((string) $user->emp_id) ? DB::table('staff_tb')->where('ID', $user->emp_id)->where('status', 1)->first() : null;
                    $row['received_by'] = $user->getAuthIdentifier();
                    $row['receiving_staff_id'] = $staff?->ID;
                    $row['receiving_staff_name'] = $staff ? trim($staff->first_name.' '.$staff->last_name) : $user->username;
                    $row['created_at'] = now();
                    $id = DB::table('rental_return_tb')->insertGetId($row, 'ID');
                }
                $assessment = DB::table('rental_return_tb')->where('ID', $id)->first();
                $quote = $service->calculate($rental, $assessment);
                foreach ($request->file('photos', []) as $file) {
                    $path = Storage::disk('rental_documents')->putFile('rental_'.$rental->ID.'/return', $file);
                    $paths[] = $path;
                    DB::table('rental_photo_tb')->insert(['rental_id' => $rental->ID, 'stage' => 'Return', 'path' => $path, 'uploaded_by' => $request->user()->getAuthIdentifier(), 'created_at' => now(), 'updated_at' => now()]);
                }
                DB::table('rental_return_audit_tb')->insert(['return_id' => $id, 'revision' => $row['revision'], 'action' => $data['status'], 'snapshot' => json_encode(['assessment' => $row, 'calculation' => $quote], JSON_THROW_ON_ERROR), 'recorded_by' => $request->user()->getAuthIdentifier(), 'created_at' => now(), 'updated_at' => now()]);

                return $id;
            });
        } catch (Throwable $error) {
            foreach ($paths as $path) {
                try {
                    Storage::disk('rental_documents')->delete($path);
                } catch (Throwable $cleanup) {
                    report($cleanup);
                }
            }throw $error;
        }

        return response()->json(['status' => true, 'data' => ['ID' => $id], 'message' => 'Return assessment saved. Vehicle remains blocked until finalization.']);
    }

    public function getReturns(Request $request)
    {
        $this->authorizeStaff($request);
        $f = $request->validate(['status' => ['nullable', Rule::in(['Draft Assessment', 'Pending Review', 'Finalized'])]]);
        $q = DB::table('rental_return_tb as a')->join('rental_tb as r', 'r.ID', '=', 'a.rental_id');
        if (! empty($f['status'])) {
            $q->where('a.status', $f['status']);
        }
        $rows = $q->orderByDesc('a.ID')->get(['a.ID as id', 'a.rental_id', 'a.actual_return_at', 'a.ending_odometer', 'a.return_fuel_litres', 'a.receiving_staff_name', 'a.status', 'r.rental_snapshot'])->map(function ($r) {
            $s = json_decode($r->rental_snapshot, true);
            unset($r->rental_snapshot);
            $r->customer_name = $s['customer']['name'];
            $r->vehicle_number = $s['vehicle']['number'];
            $r->rental_number = 'RNT-'.str_pad($r->rental_id, 6, '0', STR_PAD_LEFT);

            return $r;
        });

        return response()->json(['status' => true, 'data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function fetchReturnData(Request $request, ReturnService $service)
    {
        $this->authorizeStaff($request);
        $data = $request->validate(['upd_id' => ['required', 'integer', 'min:1']]);
        $assessment = DB::table('rental_return_tb')->where('ID', $data['upd_id'])->first();
        abort_unless($assessment, 404, 'Return assessment not found.');
        $rental = Rental::findOrFail($assessment->rental_id);
        $assessment->rental = $rental;
        $assessment->calculation = $assessment->status === 'Finalized' ? json_decode($assessment->final_snapshot, true) : $service->calculate($rental, $assessment);
        $assessment->photos = DB::table('rental_photo_tb')->where('rental_id', $rental->ID)->get(['ID', 'stage']);
        $assessment->audit = DB::table('rental_return_audit_tb')->where('return_id', $assessment->ID)->orderBy('ID')->get(['ID', 'revision', 'action', 'recorded_by', 'created_at']);

        return response()->json(['status' => true, 'data' => $assessment])->header('Cache-Control', 'private, no-store');
    }

    public function finalizeReturn(Request $request, ReturnService $service)
    {
        $this->authorizeStaff($request);
        $data = $request->validate(['upd_id' => ['required', 'integer', 'min:1'], 'revision' => ['required', 'integer', 'min:1'], 'review_hash' => ['required', 'string', 'size:64'], 'review_approved' => ['accepted'], 'review_notes' => ['required', 'string', 'max:2000'], 'damage_approved' => ['sometimes', 'boolean'], 'deposit_deduction_approved' => ['sometimes', 'boolean'], 'vehicle_release_approved' => ['sometimes', 'boolean']]);
        $first = DB::table('rental_return_tb')->where('ID', $data['upd_id'])->first();
        abort_unless($first, 404, 'Return assessment not found.');
        $invoice = DB::transaction(function () use ($request, $data, $first, $service) {
            $rental = Rental::where('ID', $first->rental_id)->lockForUpdate()->firstOrFail();
            $assessment = DB::table('rental_return_tb')->where('ID', $first->ID)->lockForUpdate()->first();
            $vehicle = DB::table('vehicle_tb')->where('ID', $rental->vehicle_id)->lockForUpdate()->first();
            if ($rental->status !== 'Active' || $assessment->status !== 'Pending Review' || (int) $assessment->revision !== (int) $data['revision']) {
                throw ValidationException::withMessages(['status' => 'Only the current Pending Review assessment can be finalized once.']);
            }
            $quote = $service->calculate($rental, $assessment);
            if (! hash_equals($quote['review_hash'], $data['review_hash'])) {
                throw ValidationException::withMessages(['review_hash' => 'The settlement changed. Reload and review the new calculation.']);
            }
            if ($quote['blockers']) {
                throw ValidationException::withMessages(['policy' => $quote['blockers']]);
            }
            if ($quote['damage_approval_required'] && ! ($data['damage_approved'] ?? false)) {
                throw ValidationException::withMessages(['damage_approved' => 'Explicit damage-charge approval is required.']);
            }
            if (BookingService::cents($quote['deposit_to_apply']) > 0 && ! ($data['deposit_deduction_approved'] ?? false)) {
                throw ValidationException::withMessages(['deposit_deduction_approved' => 'Explicit deposit deduction approval is required.']);
            }
            if ($assessment->vehicle_after_return === 'Available') {
                if (! ($data['vehicle_release_approved'] ?? false) || ! in_array($vehicle->status, ['Rented', 'Available'], true)) {
                    throw ValidationException::withMessages(['vehicle_release_approved' => 'Inspect and explicitly approve release; existing operational restrictions must be resolved first.']);
                }
                if (DB::table('vehicle_unavailability_tb')->where('vehicle_id', $vehicle->ID)->where('ID', '!=', $rental->availability_block_id)->whereIn('status', ['Active', 'Scheduled'])->where('starts_at', '<=', now(config('rental.timezone'))->format('Y-m-d H:i:s'))->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now(config('rental.timezone'))->format('Y-m-d H:i:s')))->exists()) {
                    throw ValidationException::withMessages(['vehicle_release_approved' => 'An active maintenance block prevents vehicle release.']);
                }
            }
            $pricing = $rental->pricing_snapshot;
            $actor = $request->user()->getAuthIdentifier();
            $snapshot = ['company' => app(BusinessProfileService::class)->snapshot(), 'version' => 1, 'rental' => $rental->toArray(), 'return' => ['actual_return_at' => $assessment->actual_return_at, 'ending_odometer' => $assessment->ending_odometer, 'return_fuel_litres' => $assessment->return_fuel_litres, 'condition_notes' => $assessment->condition_notes, 'new_damage' => $assessment->new_damage, 'damage_reason' => $assessment->damage_reason, 'received_by' => $assessment->received_by, 'receiving_staff_name' => $assessment->receiving_staff_name],
                'pricing' => $pricing, 'settlement' => $quote, 'reviewed_by' => $actor, 'review_notes' => $data['review_notes']];
            $invoice = DB::table('invoice_tb')->insertGetId(['rental_id' => $rental->ID, 'booking_id' => $rental->booking_id, 'return_id' => $assessment->ID, 'issued_on' => now(config('rental.timezone'))->toDateString(), 'status' => 'Issued', 'subtotal' => BookingService::money(BookingService::cents($pricing['subtotal']) + BookingService::cents($quote['additional_charges'])), 'discount' => $pricing['discount'], 'tax' => BookingService::money(BookingService::cents($pricing['tax']) + BookingService::cents($quote['additional_tax'])), 'additional_charges' => $quote['additional_charges'], 'total' => $quote['total'], 'booking_advance_amount' => $quote['booking_advance_amount'], 'snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'issued_by' => $actor, 'created_at' => now(), 'updated_at' => now()], 'ID');
            if (BookingService::cents($quote['deposit_to_apply']) > 0) {
                DB::table('rental_deposit_tb')->insert(['rental_id' => $rental->ID, 'invoice_id' => $invoice, 'settlement_key' => 'return:'.$assessment->ID.':apply', 'entry_type' => 'Applied', 'amount' => $quote['deposit_to_apply'], 'reason' => $data['review_notes'], 'recorded_by' => $actor, 'created_at' => now(), 'updated_at' => now()]);
            }
            DB::table('rental_return_tb')->where('ID', $assessment->ID)->update(['status' => 'Finalized', 'reviewed_by' => $actor, 'review_notes' => $data['review_notes'], 'finalized_at' => now(), 'final_snapshot' => json_encode($quote, JSON_THROW_ON_ERROR), 'updated_at' => now()]);
            DB::table('rental_return_audit_tb')->insert(['return_id' => $assessment->ID, 'revision' => $assessment->revision, 'action' => 'Finalized', 'snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'recorded_by' => $actor, 'created_at' => now(), 'updated_at' => now()]);
            $blockUpdated = DB::table('vehicle_unavailability_tb')->where('ID', $rental->availability_block_id)->where('status', 'Active')->whereNull('ends_at')->update(['status' => 'Completed', 'ends_at' => $assessment->actual_return_at, 'updated_at' => now()]);
            if ($blockUpdated !== 1) {
                throw ValidationException::withMessages(['rental_id' => 'The active rental availability block is inconsistent.']);
            }
            $rental->update(['status' => 'Completed']);
            $nextStatus = $assessment->vehicle_after_return;
            if (in_array($vehicle->status, ['Maintenance', 'Under Maintenance', 'Out of Service'], true)) {
                $nextStatus = $vehicle->status;
            }
            DB::table('vehicle_tb')->where('ID', $vehicle->ID)->update(['status' => $nextStatus, 'mileage' => $assessment->ending_odometer, 'updated_at' => now()]);

            app(FinanceService::class)->syncBooking($invoice);

            return $invoice;
        }, 3);

        return response()->json(['status' => true, 'data' => ['invoice_id' => $invoice], 'message' => 'Return finalized and invoice issued. Refunds require a separate authorized action.']);
    }
}
