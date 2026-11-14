<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Rental;
use App\Services\BookingService;
use App\Services\FinanceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FinanceController extends Controller
{
    private function authorizeStaff(Request $request): void
    {
        app(RentalController::class)->authorizeStaff($request);
    }

    private function filters(Request $r): array
    {
        return $r->validate(['from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'], 'payment_status' => ['nullable', Rule::in(['Unpaid', 'Partially Paid', 'Paid'])], 'method' => ['nullable', Rule::in(['cash', 'card', 'bank_transfer'])], 'q' => ['nullable', 'string', 'max:100']]);
    }

    public function invoiceFilter(Request $request, FinanceService $service)
    {
        $this->authorizeStaff($request);
        $f = $request->validate(['id' => ['nullable', 'integer', 'min:1'], 'q' => ['nullable', 'string', 'max:100'], 'refunds_only' => ['nullable', 'boolean']]);
        $query = DB::table('invoice_tb')->where('status', 'Issued');
        if (isset($f['id'])) {
            $query->where('ID', $f['id']);
        }
        $rows = $query->orderByDesc('ID')->get()->map(function ($i) use ($service) {
            $s = json_decode($i->snapshot, true);

            return ['id' => $i->ID, 'text' => 'INV-'.str_pad($i->ID, 6, '0', STR_PAD_LEFT).' — '.$s['rental']['rental_snapshot']['customer']['name'], ...$service->summary($i)];
        });
        if (! empty($f['q'])) {
            $rows = $rows->filter(fn ($r) => str_contains(mb_strtolower($r['text']), mb_strtolower($f['q'])))->values();
        }
        if (! empty($f['refunds_only'])) {
            $rows = $rows->filter(fn ($r) => $r['payment_status'] === 'Paid' && BookingService::cents($r['deposit_held']) > 0)->values();
        }

        return response()->json(['success' => true, 'data' => $rows->take(20)->values()->map(fn ($r) => ['id' => $r['id'], 'text' => $r['text']])]);
    }

    public function getInvoices(Request $request, FinanceService $service)
    {
        $this->authorizeStaff($request);
        $f = $this->filters($request);
        $query = DB::table('invoice_tb')->where('status', 'Issued');
        if (isset($f['from'])) {
            $query->whereDate('issued_on', '>=', $f['from']);
        }if (isset($f['to'])) {
            $query->whereDate('issued_on', '<=', $f['to']);
        }
        $rows = $query->orderByDesc('ID')->get()->map(function ($i) use ($service) {
            $snapshot = json_decode($i->snapshot, true);
            $s = $snapshot['rental']['rental_snapshot'];

            return ['id' => $i->ID, 'issued_on' => $i->issued_on, 'customer_name' => $s['customer']['name'], 'vehicle_number' => $s['vehicle']['number'], 'booking_number' => 'BKG-'.str_pad($i->booking_id, 6, '0', STR_PAD_LEFT), 'rental_number' => 'RNT-'.str_pad($i->rental_id, 6, '0', STR_PAD_LEFT), 'tax' => $i->tax, 'discount' => $i->discount, ...$service->summary($i)];
        });
        if (! empty($f['payment_status'])) {
            $rows = $rows->where('payment_status', $f['payment_status'])->values();
        }if (! empty($f['q'])) {
            $rows = $rows->filter(fn ($r) => str_contains(mb_strtolower(implode(' ', array_values($r))), mb_strtolower($f['q'])))->values();
        }

        return response()->json(['status' => true, 'data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function settlementContext(Request $request, FinanceService $service)
    {
        $this->authorizeStaff($request);
        $f = $request->validate(['upd_id' => ['required', 'integer', 'min:1']]);
        $invoice = DB::table('invoice_tb')->where('ID', $f['upd_id'])->where('status', 'Issued')->first();
        abort_unless($invoice, 404, 'Invoice not found.');
        return response()->json(['status' => true, 'data' => ['ID' => $invoice->ID, 'summary' => $service->summary($invoice)]])->header('Cache-Control', 'private, no-store');
    }

    public function fetchInvoiceData(Request $request, FinanceService $service)
    {
        $this->authorizeStaff($request);
        $f = $request->validate(['upd_id' => ['required', 'integer', 'min:1']]);
        $i = DB::table('invoice_tb')->where('ID', $f['upd_id'])->first();
        abort_unless($i, 404, 'Invoice not found.');
        $i->snapshot = json_decode($i->snapshot, true);
        $i->summary = $service->summary($i);
        $i->booking_payments = DB::table('booking_payment_tb')->where('booking_id', $i->booking_id)->orderBy('ID')->get();
        $i->payments = DB::table('invoice_payment_tb')->where('invoice_id', $i->ID)->orderBy('ID')->get();
        $i->deposits = DB::table('rental_deposit_tb')->where('rental_id', $i->rental_id)->orderBy('ID')->get();

        return response()->json(['status' => true, 'data' => $i])->header('Cache-Control', 'private, no-store');
    }

    public function savePayment(Request $request, FinanceService $service)
    {
        $this->authorizeStaff($request);
        $data = $request->validate(['invoice_id' => ['required', 'integer', 'min:1'], 'request_id' => ['required', 'uuid'], 'amount' => ['required', 'numeric', 'gt:0', 'regex:/^\d{1,10}(\.\d{1,2})?$/'], 'method' => ['required', Rule::in(['cash', 'bank_transfer', 'card'])], 'reference' => ['nullable', 'string', 'max:150'], 'paid_on' => ['required', 'date_format:Y-m-d'], 'approved' => ['accepted']]);
        if ($data['paid_on'] > now(config('rental.timezone'))->toDateString()) {
            throw ValidationException::withMessages(['paid_on' => 'Payment date cannot be in the future.']);
        }if ($data['method'] !== 'cash' && empty($data['reference'])) {
            throw ValidationException::withMessages(['reference' => 'A reference is required for card/bank payments.']);
        }
        $first = DB::table('invoice_tb')->where('ID', $data['invoice_id'])->first();
        abort_unless($first, 404, 'Invoice not found.');
        $id = DB::transaction(function () use ($request, $data, $first, $service) {
            Rental::where('ID', $first->rental_id)->lockForUpdate()->firstOrFail();
            $invoice = DB::table('invoice_tb')->where('ID', $first->ID)->lockForUpdate()->first();
            $existing = DB::table('invoice_payment_tb')->where('request_id', $data['request_id'])->first();
            if ($existing) {
                if ((int) $existing->invoice_id !== $invoice->ID || BookingService::cents($existing->amount) !== BookingService::cents($data['amount']) || $existing->method !== $data['method'] || $existing->paid_on !== $data['paid_on'] || ($existing->reference ?? null) !== ($data['reference'] ?? null)) {
                    throw ValidationException::withMessages(['request_id' => 'This request key was already used for a different receipt.']);
                }

return $existing->ID;
            }
            if ($invoice->status !== 'Issued' || BookingService::cents($data['amount']) > BookingService::cents($service->summary($invoice)['balance'])) {
                throw ValidationException::withMessages(['amount' => 'Payment cannot exceed the issued invoice outstanding balance.']);
            }
            $id = DB::table('invoice_payment_tb')->insertGetId(['invoice_id' => $invoice->ID, 'request_id' => $data['request_id'], 'amount' => $data['amount'], 'method' => $data['method'], 'reference' => $data['reference'] ?? null, 'paid_on' => $data['paid_on'], 'recorded_by' => $request->user()->getAuthIdentifier(), 'created_at' => now(), 'updated_at' => now()], 'ID');
            $service->syncBooking($invoice->ID);

            return $id;
        }, 3);

        return response()->json(['status' => true, 'data' => ['ID' => $id], 'message' => 'Payment receipt recorded.']);
    }

    public function saveRefund(Request $request, FinanceService $service)
    {
        $this->authorizeStaff($request);
        $data = $request->validate(['invoice_id' => ['required', 'integer', 'min:1'], 'request_id' => ['required', 'uuid'], 'amount' => ['required', 'numeric', 'gt:0', 'regex:/^\d{1,10}(\.\d{1,2})?$/'], 'method' => ['required', Rule::in(['cash', 'bank_transfer', 'card'])], 'reference' => ['nullable', 'string', 'max:150'], 'reason' => ['required', 'string', 'max:2000'], 'approved' => ['accepted']]);
        if ($data['method'] !== 'cash' && empty($data['reference'])) {
            throw ValidationException::withMessages(['reference' => 'A reference is required for card/bank refunds.']);
        }
        $first = DB::table('invoice_tb')->where('ID', $data['invoice_id'])->first();
        abort_unless($first, 404, 'Invoice not found.');
        $id = DB::transaction(function () use ($request, $data, $first, $service) {
            $rental = Rental::where('ID', $first->rental_id)->lockForUpdate()->firstOrFail();
            $invoice = DB::table('invoice_tb')->where('ID', $first->ID)->lockForUpdate()->first();
            $key = 'refund:'.$data['request_id'];
            $existing = DB::table('rental_deposit_tb')->where('settlement_key', $key)->first();
            if ($existing) {
                if ((int) $existing->invoice_id !== $invoice->ID || BookingService::cents($existing->amount) !== BookingService::cents($data['amount']) || $existing->method !== $data['method'] || ($existing->reference ?? null) !== ($data['reference'] ?? null) || $existing->reason !== $data['reason']) {
                    throw ValidationException::withMessages(['request_id' => 'This request key was already used for a different refund.']);
                }

return $existing->ID;
            }
            $summary = $service->summary($invoice);
            if ($rental->status !== 'Completed' || $summary['payment_status'] !== 'Paid' || BookingService::cents($data['amount']) > BookingService::cents($summary['deposit_held'])) {
                throw ValidationException::withMessages(['amount' => 'Refund requires a completed, settled invoice and cannot exceed the remaining held deposit.']);
            }

            return DB::table('rental_deposit_tb')->insertGetId(['rental_id' => $rental->ID, 'invoice_id' => $invoice->ID, 'settlement_key' => $key, 'entry_type' => 'Refunded', 'amount' => $data['amount'], 'method' => $data['method'], 'reference' => $data['reference'] ?? null, 'reason' => $data['reason'], 'recorded_by' => $request->user()->getAuthIdentifier(), 'created_at' => now(), 'updated_at' => now()], 'ID');
        }, 3);

        return response()->json(['status' => true, 'data' => ['ID' => $id], 'message' => 'Authorized deposit refund recorded.']);
    }

    public function getPayments(Request $request)
    {
        $this->authorizeStaff($request);
        $f = $this->filters($request);
        $rows = collect();
        foreach (['booking_payment_tb' => 'Booking Advance', 'invoice_payment_tb' => 'Invoice Payment'] as $table => $source) {
            $q = DB::table($table);
            if (isset($f['from'])) {
                $q->where('paid_on', '>=', $f['from']);
            }if (isset($f['to'])) {
                $q->where('paid_on', '<=', $f['to']);
            }if (isset($f['method'])) {
                $q->where('method', $f['method']);
            }foreach ($q->orderByDesc('ID')->get() as $p) {
                $rows->push(['id' => ($source === 'Booking Advance' ? 'ADV-' : 'PAY-').$p->ID, 'source' => $source, 'booking_id' => $p->booking_id ?? null, 'invoice_id' => $p->invoice_id ?? null, 'amount' => $p->amount, 'method' => $p->method, 'reference' => $p->reference, 'paid_on' => $p->paid_on, 'recorded_by' => $p->recorded_by]);
            }
        }

        return response()->json(['status' => true, 'data' => $rows->sortByDesc('paid_on')->values()])->header('Cache-Control', 'private, no-store');
    }

    public function getRefunds(Request $request)
    {
        $this->authorizeStaff($request);
        $f = $this->filters($request);
        $q = DB::table('rental_deposit_tb')->where('entry_type', 'Refunded');
        if (isset($f['from'])) {
            $q->whereDate('created_at', '>=', $f['from']);
        }if (isset($f['to'])) {
            $q->whereDate('created_at', '<=', $f['to']);
        }if (isset($f['method'])) {
            $q->where('method',$f['method']);
        }

        return response()->json(['status' => true, 'data' => $q->orderByDesc('ID')->get(['ID as id', 'rental_id', 'invoice_id', 'amount', 'method', 'reference', 'reason', 'recorded_by', 'created_at'])])->header('Cache-Control','private, no-store');
    }
}
