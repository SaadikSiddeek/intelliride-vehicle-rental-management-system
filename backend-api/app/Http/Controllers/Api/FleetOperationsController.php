<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BookingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class FleetOperationsController extends Controller
{
    private function authorizeStaff(Request $r): void
    {
        app(RentalController::class)->authorizeStaff($r);
    }

    public function getDocuments(Request $r)
    {
        $this->authorizeStaff($r);
        $f = $r->validate(['vehicle_id' => ['nullable', 'integer', 'min:1'], 'status' => ['nullable', Rule::in(['Current', 'Expired', 'Expiring', 'Superseded'])]]);
        $q = DB::table('vehicle_document_tb as d')->join('vehicle_tb as v', 'v.ID', '=', 'd.vehicle_id');
        if (isset($f['vehicle_id'])) {
            $q->where('d.vehicle_id', $f['vehicle_id']);
        }$today = now(config('rental.timezone'))->toDateString();
        if (($f['status'] ?? '') === 'Superseded') {
            $q->whereNotNull('d.superseded_at');
        } else {
            $q->whereNull('d.superseded_at');
            if (($f['status'] ?? '') === 'Expired') {
                $q->where('d.expires_on', '<', $today);
            }if (($f['status'] ?? '') === 'Expiring') {
                $q->whereBetween('d.expires_on', [$today, now(config('rental.timezone'))->addDays(30)->toDateString()]);
            }if (($f['status'] ?? '') === 'Current') {
                $q->where(fn ($q) => $q->whereNull('d.expires_on')->orWhere('d.expires_on', '>=', $today));
            }
        }
        $rows = $q->orderByDesc('d.ID')->get(['d.ID as id', 'd.vehicle_id', 'v.vehicle_number', 'd.document_type', 'd.document_number', 'd.issued_on', 'd.expires_on', 'd.renewal_of', 'd.superseded_at', 'd.uploaded_by']);
        foreach ($rows as $row) {
            $row->status = $row->superseded_at ? 'Superseded' : ($row->expires_on && $row->expires_on < $today ? 'Expired' : 'Current');
        }

return response()->json(['status' => true, 'data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function saveDocument(Request $r)
    {
        $this->authorizeStaff($r);
        $data = $r->validate(['vehicle_id' => ['required', 'integer', 'min:1'], 'document_type' => ['required', Rule::in(['Insurance', 'Registration', 'Revenue Licence', 'Emission Test', 'Other'])], 'document_number' => ['required', 'string', 'max:100'], 'issued_on' => ['required', 'date_format:Y-m-d'], 'expires_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:issued_on'], 'renewal_of' => ['nullable', 'integer', 'min:1'], 'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:5120']]);
        $path = null;
        try {
            $id = DB::transaction(function () use ($r, $data, &$path) {
                $v = DB::table('vehicle_tb')->where('ID', $data['vehicle_id'])->lockForUpdate()->first();
                abort_unless($v, 404, 'Vehicle not found.');
                $key = $v->ID.':'.$data['document_type'];
                $old = DB::table('vehicle_document_tb')->where('current_key', $key)->lockForUpdate()->first();
                if (isset($data['renewal_of'])) {
                    if (! $old || (int) $old->ID !== (int) $data['renewal_of']) {
                        throw ValidationException::withMessages(['renewal_of' => 'Only the current document of this type can be renewed.']);
                    }DB::table('vehicle_document_tb')->where('ID', $old->ID)->update(['current_key' => null, 'superseded_at' => now(), 'updated_at' => now()]);
                } elseif ($old) {
                    throw ValidationException::withMessages(['document_type' => 'A current document already exists. Use Renew to preserve its history.']);
                }
                $path = Storage::disk('fleet_documents')->putFile('vehicle_'.$v->ID, $r->file('file'));
                unset($data['file']);
                $id = DB::table('vehicle_document_tb')->insertGetId([...$data, 'current_key' => $key, 'path' => $path, 'uploaded_by' => $r->user()->getAuthIdentifier(), 'created_at' => now(), 'updated_at' => now()], 'ID');
                $column = ['Insurance' => 'insurance_expiry_date', 'Registration' => 'registration_expiry_date'][$data['document_type']] ?? null;
                if ($column) {
                    DB::table('vehicle_tb')->where('ID', $v->ID)->update([$column => $data['expires_on'] ?? null, 'updated_at' => now()]);
                }

return $id;
            });
        } catch (Throwable $e) {
            if ($path) {
                try {
                    Storage::disk('fleet_documents')->delete($path);
                } catch (Throwable $cleanup) {
                    report($cleanup);
                }
            }throw $e;
        }

        return response()->json(['status' => true, 'data' => ['ID' => $id], 'message' => 'Vehicle document saved; earlier versions remain preserved.'], 201);
    }

    public function downloadDocument(Request $r, int $id)
    {
        $this->authorizeStaff($r);
        $d = DB::table('vehicle_document_tb')->where('ID', $id)->first();
        $disk = Storage::disk('fleet_documents');
        abort_unless($d && $disk->exists($d->path), 404);

        return $disk->download($d->path, 'vehicle-document-'.$id.'.'.pathinfo($d->path, PATHINFO_EXTENSION), ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function getMaintenance(Request $r)
    {
        $this->authorizeStaff($r);
        $f = $r->validate(['vehicle_id' => ['nullable', 'integer', 'min:1'], 'status' => ['nullable', Rule::in(['Scheduled', 'Active', 'Completed', 'Cancelled'])]]);
        $q = DB::table('maintenance_tb as m')->join('vehicle_tb as v', 'v.ID', '=', 'm.vehicle_id');
        foreach (['vehicle_id', 'status'] as $key) {
            if (isset($f[$key])) {
                $q->where('m.'.$key, $f[$key]);
            }
        }

return response()->json(['status' => true, 'data' => $q->orderByDesc('m.ID')->get(['m.ID as id', 'm.*', 'v.vehicle_number'])]);
    }

    public function saveMaintenance(Request $r, BookingService $service)
    {
        $this->authorizeStaff($r);
        $data = $r->validate(['upd_id' => ['nullable', 'integer', 'min:1'], 'vehicle_id' => ['required', 'integer', 'min:1'], 'service_type' => ['required', 'string', 'max:100'], 'starts_at' => ['required', 'date_format:Y-m-d\TH:i'], 'ends_at' => ['required', 'date_format:Y-m-d\TH:i', 'after:starts_at'], 'notes' => ['required', 'string', 'max:4000']]);
        $id = DB::transaction(function () use ($r, $data, $service) {
            $vehicle = DB::table('vehicle_tb')->where('ID', $data['vehicle_id'])->lockForUpdate()->first();
            abort_unless($vehicle, 404, 'Vehicle not found.');
            $existing = isset($data['upd_id']) ? DB::table('maintenance_tb')->where('ID', $data['upd_id'])->lockForUpdate()->first() : null;
            if (isset($data['upd_id']) && (! $existing || $existing->status !== 'Scheduled' || (int) $existing->vehicle_id !== (int) $vehicle->ID)) {
                throw ValidationException::withMessages(['upd_id' => 'Only a scheduled maintenance record for this vehicle can be edited.']);
            }
            $service->assertAvailable(['vehicle_id' => $vehicle->ID, 'pickup_at' => $data['starts_at'], 'expected_return_at' => $data['ends_at']], null, $existing?->availability_block_id);
            $row = $data;
            unset($row['upd_id']);
            foreach (['starts_at', 'ends_at'] as $key) {
                $row[$key] = str_replace('T', ' ', $data[$key]).':00';
            }$row['updated_by'] = $r->user()->getAuthIdentifier();
            $row['updated_at'] = now();
            if ($existing) {
                DB::table('maintenance_tb')->where('ID', $existing->ID)->update($row);
                DB::table('vehicle_unavailability_tb')->where('ID', $existing->availability_block_id)->update(['starts_at' => $row['starts_at'], 'ends_at' => $row['ends_at'], 'notes' => $row['notes'], 'updated_at' => now()]);

                return $existing->ID;
            }
            $block = DB::table('vehicle_unavailability_tb')->insertGetId(['vehicle_id' => $vehicle->ID, 'kind' => 'Maintenance', 'status' => 'Scheduled', 'starts_at' => $row['starts_at'], 'ends_at' => $row['ends_at'], 'notes' => $row['notes'], 'created_at' => now(), 'updated_at' => now()], 'ID');

            return DB::table('maintenance_tb')->insertGetId([...$row, 'availability_block_id' => $block, 'status' => 'Scheduled', 'recorded_by' => $r->user()->getAuthIdentifier(), 'created_at' => now()], 'ID');
        }, 3);

        return response()->json(['status' => true, 'data' => ['ID' => $id], 'message' => 'Maintenance scheduled; the vehicle is blocked for this period.']);
    }

    public function maintenanceStatus(Request $r, BookingService $service)
    {
        $this->authorizeStaff($r);
        $data = $r->validate(['upd_id' => ['required', 'integer', 'min:1'], 'status' => ['required', Rule::in(['Active', 'Completed', 'Cancelled'])], 'release_status' => ['nullable', Rule::in(['Inspection Required', 'Cleaning', 'Available', 'Out of Service'])], 'release_approved' => ['sometimes', 'boolean']]);
        $first = DB::table('maintenance_tb')->where('ID', $data['upd_id'])->first();
        abort_unless($first, 404, 'Maintenance not found.');
        DB::transaction(function () use ($r, $data, $first, $service) {
            $v = DB::table('vehicle_tb')->where('ID', $first->vehicle_id)->lockForUpdate()->first();
            $m = DB::table('maintenance_tb')->where('ID', $first->ID)->lockForUpdate()->first();
            $now = now(config('rental.timezone'))->format('Y-m-d H:i:s');
            if ($data['status'] === 'Active') {
                if ($m->status !== 'Scheduled' || $m->starts_at > $now || $m->ends_at <= $now || $v->status === 'Rented') {
                    throw ValidationException::withMessages(['status' => 'Only due scheduled maintenance can be started on a vehicle outside an active rental.']);
                }
                $service->assertAvailable(['vehicle_id' => $v->ID, 'pickup_at' => str_replace(' ', 'T', substr($m->starts_at, 0, 16)), 'expected_return_at' => str_replace(' ', 'T', substr($m->ends_at, 0, 16))], null, $m->availability_block_id);
                // Once work starts its block is open-ended until staff complete it.
                DB::table('vehicle_unavailability_tb')->where('ID', $m->availability_block_id)->update(['status' => 'Active', 'ends_at' => null, 'updated_at' => now()]);
                DB::table('vehicle_tb')->where('ID', $v->ID)->update(['status' => 'Maintenance', 'updated_at' => now()]);
            } elseif ($data['status'] === 'Completed') {
                if ($m->status !== 'Active') {
                    throw ValidationException::withMessages(['status' => 'Only active maintenance can be completed.']);
                }$release = $data['release_status'] ?? 'Inspection Required';
                if ($release === 'Available' && ! ($data['release_approved'] ?? false)) {
                    throw ValidationException::withMessages(['release_approved' => 'Explicit inspection approval is required before vehicle release.']);
                }
                if ($release === 'Available' && DB::table('vehicle_unavailability_tb')->where('vehicle_id', $v->ID)->where('ID', '!=', $m->availability_block_id)->whereIn('status', ['Active', 'Scheduled'])->where('starts_at', '<=', $now)->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', $now))->exists()) {
                    throw ValidationException::withMessages(['release_approved' => 'Another active calendar block prevents release.']);
                }
                DB::table('vehicle_unavailability_tb')->where('ID', $m->availability_block_id)->update(['status' => 'Completed', 'ends_at' => $now, 'updated_at' => now()]);
                DB::table('vehicle_tb')->where('ID', $v->ID)->update(['status' => $release, 'updated_at' => now()]);
            } else {
                if ($m->status !== 'Scheduled') {
                    throw ValidationException::withMessages(['status' => 'Only scheduled maintenance can be cancelled.']);
                }DB::table('vehicle_unavailability_tb')->where('ID', $m->availability_block_id)->update(['status' => 'Cancelled', 'updated_at' => now()]);
            }
            DB::table('maintenance_tb')->where('ID', $m->ID)->update(['status' => $data['status'], 'completed_at' => $data['status'] === 'Completed' ? $now : null, 'updated_by' => $r->user()->getAuthIdentifier(), 'updated_at' => now()]);
        }, 3);

        return response()->json(['status' => true, 'message' => 'Maintenance status updated.']);
    }
}
