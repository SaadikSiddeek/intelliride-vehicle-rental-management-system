<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class FinanceService
{
    public function summary(object $invoice): array
    {
        $additional = (int) DB::table('invoice_payment_tb')->where('invoice_id', $invoice->ID)->get()->sum(fn ($p) => BookingService::cents($p->amount));
        $advance = BookingService::cents($invoice->booking_advance_amount);
        $deposit = (int) DB::table('rental_deposit_tb')->where('invoice_id', $invoice->ID)->where('entry_type', 'Applied')->get()->sum(fn ($p) => BookingService::cents($p->amount));
        $total = BookingService::cents($invoice->total);
        $settled = $advance + $additional + $deposit;
        $balance = max(0, $total - $settled);
        $held = app(ReturnService::class)->depositBalance($invoice->rental_id);

        return ['invoice_id' => $invoice->ID, 'invoice_number' => 'INV-'.str_pad($invoice->ID, 6, '0', STR_PAD_LEFT), 'total' => BookingService::money($total), 'booking_advances' => BookingService::money($advance), 'additional_payments' => BookingService::money($additional), 'cash_received' => BookingService::money($advance + $additional), 'deposit_applied' => BookingService::money($deposit), 'settled' => BookingService::money($settled), 'balance' => BookingService::money($balance), 'payment_status' => $balance === 0 ? 'Paid' : ($settled === 0 ? 'Unpaid' : 'Partially Paid'), 'deposit_received' => BookingService::money($held['Received']), 'deposit_refunded' => BookingService::money($held['Refunded']), 'deposit_held' => BookingService::money(max(0, $held['Held']))];
    }

    public function syncBooking(int $invoiceId): void
    {
        $invoice = DB::table('invoice_tb')->where('ID', $invoiceId)->firstOrFail();
        $summary = $this->summary($invoice);
        DB::table('booking_tb')->where('ID', $invoice->booking_id)->update(['payment_status' => $summary['payment_status'], 'updated_at' => now()]);
    }
}
