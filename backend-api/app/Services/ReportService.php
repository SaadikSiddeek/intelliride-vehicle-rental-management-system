<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public const TYPES = ['rental_history' => 'Rental History', 'staff_handover' => 'Staff Handovers', 'customer_history' => 'Customer Rental History', 'vehicle_utilization' => 'Vehicle Utilization', 'financial' => 'Financial Activity', 'outstanding_invoices' => 'Outstanding Invoices', 'booking_history' => 'Booking History', 'cancellations' => 'Cancellations and No-shows', 'daily_transactions' => 'Daily Transactions', 'monthly_rentals' => 'Monthly Rental Summary', 'yearly_rentals' => 'Yearly Rental Summary', 'maintenance_history' => 'Maintenance History', 'document_expiry' => 'Document Expiry', 'deposit_history' => 'Deposit History'];

    public const NUMBERS = ['Recognized Revenue', 'Duration Hours', 'Starting Km', 'Ending Km', 'Distance Km', 'Invoice Total', 'Amount Paid', 'Balance', 'Subtotal', 'Tax', 'Discount', 'Additional Charges', 'Rental Cash Received', 'Deposit Received', 'Deposit Applied', 'Deposit Refunded', 'Deposit Held', 'Trips Completed', 'Rental Days', 'Active Rentals', 'Maintenance Days', 'Unclassified Days', 'Rentals Started'];

    public function columns(string $type, bool $identity = false): array
    {
        $base = ['Rental', 'Booking', 'Customer', 'Vehicle Name', 'Vehicle', 'Pickup Branch', 'Return Branch', 'Pickup', 'Return', 'Duration Hours', 'Starting Km', 'Ending Km', 'Status', 'Handed Over By', 'Received By', 'Invoice', 'Invoice Total', 'Amount Paid', 'Balance'];
        if (in_array($type, ['rental_history', 'staff_handover', 'customer_history'], true)) {
            return $identity ? [...$base, 'NIC / Passport'] : $base;
        }

        return match ($type) {
            'vehicle_utilization' => ['Vehicle', 'Branch', 'Trips Completed', 'Rental Days', 'Active Rentals', 'Maintenance Days', 'Unclassified Days', 'Measurement Note'],
            'financial','daily_transactions' => ['Date', 'Entry', 'Reference', 'Customer', 'Vehicle', 'Branch', 'Recognized Revenue', 'Invoice Total', 'Tax', 'Discount', 'Additional Charges', 'Rental Cash Received', 'Deposit Received', 'Deposit Applied', 'Deposit Refunded'],
            'outstanding_invoices' => ['Invoice', 'Issued', 'Customer', 'Vehicle', 'Invoice Total', 'Amount Paid', 'Balance'],
            'booking_history','cancellations' => ['Booking', 'Customer', 'Vehicle', 'Branch', 'Pickup', 'Expected Return', 'Status', 'Payment Status', 'Invoice Total'],
            'monthly_rentals','yearly_rentals' => ['Period', 'Rentals Started', 'Trips Completed', 'Invoice Total'],
            'maintenance_history' => ['Maintenance', 'Vehicle', 'Branch', 'Service', 'Starts', 'Expected End', 'Completed', 'Status', 'Recorded By', 'Notes'],
            'document_expiry' => ['Document', 'Vehicle', 'Branch', 'Type', 'Number', 'Issued', 'Expires', 'Status'],
            'deposit_history' => ['Date', 'Rental', 'Invoice', 'Customer', 'Vehicle', 'Branch', 'Entry', 'Deposit Received', 'Deposit Applied', 'Deposit Refunded', 'Method', 'Reference', 'Recorded By', 'Reason'],default => []
        };
    }

    private function dates($q, string $column, array $f): void
    {
        if ($column === 'd.created_at') {
            $q->where($column, '>=', CarbonImmutable::parse($f['from'], config('rental.timezone'))->utc()->format('Y-m-d H:i:s'))->where($column, '<', CarbonImmutable::parse($f['to'], config('rental.timezone'))->addDay()->utc()->format('Y-m-d H:i:s'));

            return;
        }$q->where($column, '>=', $f['from'].' 00:00:00')->where($column, '<', CarbonImmutable::parse($f['to'])->addDay()->format('Y-m-d').' 00:00:00');
    }

    private function entity($q, array $f, array $columns): void
    {
        foreach ($columns as $key => $column) {
            if (! empty($f[$key])) {
                $q->where($column, $f[$key]);
            }
        }
    }

    private function money($value): float
    {
        return (float) ($value ?? 0);
    }

    private function invoiceQuery()
    {
        $payments = DB::table('invoice_payment_tb')->selectRaw('invoice_id, SUM(amount) as receipt_total')->groupBy('invoice_id');
        $deposits = DB::table('rental_deposit_tb')->where('entry_type', 'Applied')->selectRaw('invoice_id, SUM(amount) as applied_total')->groupBy('invoice_id');

        return DB::table('invoice_tb as i')->leftJoinSub($payments, 'p', 'p.invoice_id', '=', 'i.ID')->leftJoinSub($deposits, 'd', 'd.invoice_id', '=', 'i.ID')->join('rental_tb as r', 'r.ID', '=', 'i.rental_id');
    }

    public function rows(string $type, array $f): iterable
    {
        if (in_array($type, ['financial', 'daily_transactions', 'deposit_history'], true)) {
            $events = $type === 'deposit_history' ? $this->depositRows($f) : $this->financialRows($f);
            if ($type !== 'daily_transactions') {
                yield from $events;

                return;
            }
            $daily = [];
            foreach ($events as $row) {
                $date = $row['Date'];
                if (! isset($daily[$date])) {
                    $daily[$date] = ['Date' => $date, 'Entry' => 'Daily totals', 'Reference' => '', 'Customer' => '', 'Vehicle' => '', 'Branch' => '', ...array_fill_keys(['Recognized Revenue', 'Invoice Total', 'Tax', 'Discount', 'Additional Charges', 'Rental Cash Received', 'Deposit Received', 'Deposit Applied', 'Deposit Refunded'], 0)];
                }foreach (['Recognized Revenue', 'Invoice Total', 'Tax', 'Discount', 'Additional Charges', 'Rental Cash Received', 'Deposit Received', 'Deposit Applied', 'Deposit Refunded'] as $key) {
                    $daily[$date][$key] += BookingService::cents(number_format((float) $row[$key], 2, '.', ''));
                }
            }
            ksort($daily);
            foreach ($daily as $row) {
                foreach (['Recognized Revenue', 'Invoice Total', 'Tax', 'Discount', 'Additional Charges', 'Rental Cash Received', 'Deposit Received', 'Deposit Applied', 'Deposit Refunded'] as $key) {
                    $row[$key] = $row[$key] / 100;
                }yield $row;
            }

            return;
        }
        if ($type === 'vehicle_utilization') {
            yield from $this->utilizationRows($f);

            return;
        }
        if ($type === 'outstanding_invoices') {
            $q = $this->invoiceQuery();
            $q->whereDate('i.issued_on', '>=', $f['from'])->whereDate('i.issued_on', '<=', $f['to']);
            $this->entity($q, $f, ['customer_id' => 'r.customer_id', 'vehicle_id' => 'r.vehicle_id', 'branch_id' => 'r.pickup_branch_id', 'staff_id' => 'r.handover_staff_id']);
            foreach ($q->orderBy('i.ID')->select(['i.*', 'p.receipt_total', 'd.applied_total'])->lazy(200) as $i) {
                $paid = BookingService::cents($i->booking_advance_amount) + BookingService::cents($i->receipt_total ?? '0') + BookingService::cents($i->applied_total ?? '0');
                $balance = BookingService::cents($i->total) - $paid;
                if ($balance <= 0) {
                    continue;
                }$s = json_decode($i->snapshot, true)['rental']['rental_snapshot'];
                yield ['Invoice' => 'INV-'.str_pad($i->ID, 6, '0', STR_PAD_LEFT), 'Issued' => $i->issued_on, 'Customer' => $s['customer']['name'], 'Vehicle' => $s['vehicle']['number'], 'Invoice Total' => $this->money($i->total), 'Amount Paid' => $paid / 100, 'Balance' => $balance / 100];
            }

            return;
        }
        if (in_array($type, ['booking_history', 'cancellations'], true)) {
            $q = DB::table('booking_tb as b')->join('customer_tb as c', 'c.ID', '=', 'b.customer_id')->join('vehicle_tb as v', 'v.ID', '=', 'b.vehicle_id')->join('branch_tb as br', 'br.ID', '=', 'b.pickup_branch_id')->leftJoin('users_tb as u', 'u.ID', '=', 'b.created_by');
            $this->dates($q, 'b.pickup_at', $f);
            $this->entity($q, $f, ['customer_id' => 'b.customer_id', 'vehicle_id' => 'b.vehicle_id', 'branch_id' => 'b.pickup_branch_id', 'staff_id' => 'u.emp_id']);
            if ($type === 'cancellations') {
                $q->whereIn('b.status', ['Cancelled', 'No-show']);
            }if (! empty($f['status'])) {
                $q->where('b.status', $f['status']);
            }
            foreach ($q->orderBy('b.ID')->select(['b.*', 'c.full_name', 'v.vehicle_number', 'br.branch_name'])->lazy(200) as $b) {
                yield ['Booking' => 'BKG-'.str_pad($b->ID, 6, '0', STR_PAD_LEFT), 'Customer' => $b->full_name, 'Vehicle' => $b->vehicle_number, 'Branch' => $b->branch_name, 'Pickup' => $b->pickup_at, 'Expected Return' => $b->expected_return_at, 'Status' => $b->status, 'Payment Status' => $b->payment_status, 'Invoice Total' => $this->money($b->total)];
            }

            return;
        }
        if ($type === 'maintenance_history') {
            $q = DB::table('maintenance_tb as m')->join('vehicle_tb as v', 'v.ID', '=', 'm.vehicle_id')->join('branch_tb as br', 'br.ID', '=', 'v.branch_id')->leftJoin('users_tb as u', 'u.ID', '=', 'm.recorded_by');
            $this->dates($q, 'm.starts_at', $f);
            $this->entity($q, $f, ['vehicle_id' => 'm.vehicle_id', 'branch_id' => 'v.branch_id', 'staff_id' => 'u.emp_id']);
            if (! empty($f['status'])) {
                $q->where('m.status', $f['status']);
            }
            foreach ($q->orderBy('m.ID')->select(['m.*', 'v.vehicle_number', 'br.branch_name', 'u.username'])->lazy(200) as $m) {
                yield ['Maintenance' => $m->ID, 'Vehicle' => $m->vehicle_number, 'Branch' => $m->branch_name, 'Service' => $m->service_type, 'Starts' => $m->starts_at, 'Expected End' => $m->ends_at, 'Completed' => $m->completed_at, 'Status' => $m->status, 'Recorded By' => $m->username, 'Notes' => $m->notes];
            }

            return;
        }
        if ($type === 'document_expiry') {
            $q = DB::table('vehicle_document_tb as d')->join('vehicle_tb as v', 'v.ID', '=', 'd.vehicle_id')->join('branch_tb as br', 'br.ID', '=', 'v.branch_id')->leftJoin('users_tb as u', 'u.ID', '=', 'd.uploaded_by');
            $this->entity($q, $f, ['vehicle_id' => 'd.vehicle_id', 'branch_id' => 'v.branch_id', 'staff_id' => 'u.emp_id']);
            $q->whereDate('d.expires_on', '>=', $f['from'])->whereDate('d.expires_on', '<=', $f['to']);
            if (($f['status'] ?? '') === 'Superseded') {
                $q->whereNotNull('d.superseded_at');
            } else {
                $q->whereNull('d.superseded_at');
            }
            if (($f['status'] ?? '') === 'Expired') {
                $q->where('d.expires_on', '<', now(config('rental.timezone'))->toDateString());
            }if (($f['status'] ?? '') === 'Current') {
                $q->where('d.expires_on', '>=', now(config('rental.timezone'))->toDateString());
            }
            foreach ($q->orderBy('d.expires_on')->orderBy('d.ID')->select(['d.*', 'v.vehicle_number', 'br.branch_name'])->lazy(200) as $d) {
                yield ['Document' => $d->ID, 'Vehicle' => $d->vehicle_number, 'Branch' => $d->branch_name, 'Type' => $d->document_type, 'Number' => $d->document_number, 'Issued' => $d->issued_on, 'Expires' => $d->expires_on, 'Status' => $d->superseded_at ? 'Superseded' : ($d->expires_on < now(config('rental.timezone'))->toDateString() ? 'Expired' : 'Current')];
            }

            return;
        }
        $q = DB::table('rental_tb as r')->leftJoin('rental_return_tb as a', fn ($j) => $j->on('a.rental_id', '=', 'r.ID')->where('a.status', 'Finalized'))->leftJoin('invoice_tb as i', 'i.rental_id', '=', 'r.ID')->leftJoinSub(DB::table('invoice_payment_tb')->selectRaw('invoice_id, SUM(amount) as receipt_total')->groupBy('invoice_id'), 'p', 'p.invoice_id', '=', 'i.ID')->leftJoinSub(DB::table('rental_deposit_tb')->where('entry_type', 'Applied')->selectRaw('invoice_id, SUM(amount) as applied_total')->groupBy('invoice_id'), 'd', 'd.invoice_id', '=', 'i.ID');
        $this->dates($q, 'r.actual_pickup_at', $f);
        $this->entity($q, $f, ['customer_id' => 'r.customer_id', 'vehicle_id' => 'r.vehicle_id', 'branch_id' => 'r.pickup_branch_id']);
        if (! empty($f['staff_id'])) {
            $q->where(fn ($q) => $q->where('r.handover_staff_id', $f['staff_id'])->orWhere('a.receiving_staff_id', $f['staff_id']));
        }if (! empty($f['overdue_only'])) {
            $q->join('booking_tb as overdue_booking','overdue_booking.ID','=','r.booking_id')->where('r.status','Active')->where('overdue_booking.expected_return_at','<',now(config('rental.timezone'))->format('Y-m-d H:i:s'));
        }if (! empty($f['status'])) {
            $q->where('r.status', $f['status']);
        }
        $groups = [];
        foreach ($q->orderBy('r.ID')->select(['r.*', 'a.actual_return_at', 'a.ending_odometer', 'a.receiving_staff_name', 'i.ID as invoice_id', 'i.total as invoice_total', 'i.booking_advance_amount', 'p.receipt_total', 'd.applied_total'])->lazy(200) as $r) {
            $s = json_decode($r->rental_snapshot, true);
            $end = $r->actual_return_at ? CarbonImmutable::parse($r->actual_return_at, config('rental.timezone')) : now(config('rental.timezone'));
            $duration = max(0, CarbonImmutable::parse($r->actual_pickup_at, config('rental.timezone'))->diffInMinutes($end)) / 60;
            $paid = BookingService::cents($r->booking_advance_amount ?? '0') + BookingService::cents($r->receipt_total ?? '0') + BookingService::cents($r->applied_total ?? '0');
            if (in_array($type, ['monthly_rentals', 'yearly_rentals'], true)) {
                $period = substr($r->actual_pickup_at, 0, $type === 'yearly_rentals' ? 4 : 7);
                $groups[$period] ??= ['Period' => $period, 'Rentals Started' => 0, 'Trips Completed' => 0, 'Invoice Total' => 0];
                $groups[$period]['Rentals Started']++;
                $groups[$period]['Trips Completed'] += $r->status === 'Completed' ? 1 : 0;
                $groups[$period]['Invoice Total'] += BookingService::cents($r->invoice_total ?? '0');

                continue;
            }
            $row = ['Rental' => 'RNT-'.str_pad($r->ID, 6, '0', STR_PAD_LEFT), 'Booking' => 'BKG-'.str_pad($r->booking_id, 6, '0', STR_PAD_LEFT), 'Customer' => $s['customer']['name'], 'Vehicle Name' => $s['vehicle']['name'] ?? 'Not recorded', 'Vehicle' => $s['vehicle']['number'], 'Pickup Branch' => $s['pickup_branch'], 'Return Branch' => $s['return_branch'], 'Pickup' => $r->actual_pickup_at, 'Return' => $r->actual_return_at, 'Duration Hours' => round($duration, 2), 'Starting Km' => $r->starting_odometer, 'Ending Km' => $r->ending_odometer, 'Status' => $r->status, 'Handed Over By' => $r->handover_staff_name, 'Received By' => $r->receiving_staff_name, 'Invoice' => $r->invoice_id ? 'INV-'.str_pad($r->invoice_id, 6, '0', STR_PAD_LEFT) : null, 'Invoice Total' => $this->money($r->invoice_total), 'Amount Paid' => $paid / 100, 'Balance' => max(0, BookingService::cents($r->invoice_total ?? '0') - $paid) / 100];
            if (! empty($f['include_identity'])) {
                $row['NIC / Passport'] = $s['customer']['document_number'];
            }yield $row;
        }
        foreach ($groups as $row) {
            $row['Invoice Total'] /= 100;
            yield $row;
        }
    }

    private function financialRows(array $f): iterable
    {
        $empty = array_fill_keys(['Recognized Revenue', 'Invoice Total', 'Tax', 'Discount', 'Additional Charges', 'Rental Cash Received', 'Deposit Received', 'Deposit Applied', 'Deposit Refunded'], 0);
        $q = DB::table('invoice_tb as i')->join('rental_tb as r', 'r.ID', '=', 'i.rental_id')->leftJoin('users_tb as u', 'u.ID', '=', 'i.issued_by')->whereDate('i.issued_on', '>=', $f['from'])->whereDate('i.issued_on', '<=', $f['to']);
        $this->entity($q, $f, ['customer_id' => 'r.customer_id', 'vehicle_id' => 'r.vehicle_id', 'branch_id' => 'r.pickup_branch_id', 'staff_id' => 'u.emp_id']);
        foreach ($q->orderBy('i.ID')->select(['i.*', 'r.rental_snapshot'])->lazy(200) as $i) {
            $s = json_decode($i->rental_snapshot, true);
            yield ['Date' => $i->issued_on, 'Entry' => 'Issued Invoice Revenue', 'Reference' => 'INV-'.str_pad($i->ID, 6, '0', STR_PAD_LEFT), 'Customer' => $s['customer']['name'], 'Vehicle' => $s['vehicle']['number'], 'Branch' => $s['pickup_branch'], ...$empty, 'Recognized Revenue' => (BookingService::cents($i->total) - BookingService::cents($i->tax)) / 100, 'Invoice Total' => $this->money($i->total), 'Tax' => $this->money($i->tax), 'Discount' => $this->money($i->discount), 'Additional Charges' => $this->money($i->additional_charges)];
        }
        foreach (['booking_payment_tb' => 'Booking Advance', 'invoice_payment_tb' => 'Invoice Receipt'] as $table => $kind) {
            $q = DB::table($table.' as p');
            if ($table === 'invoice_payment_tb') {
                $q->join('invoice_tb as i', 'i.ID', '=', 'p.invoice_id')->join('booking_tb as b', 'b.ID', '=', 'i.booking_id');
            } else {
                $q->join('booking_tb as b', 'b.ID', '=', 'p.booking_id');
            }$q->join('customer_tb as c', 'c.ID', '=', 'b.customer_id')->join('vehicle_tb as v', 'v.ID', '=', 'b.vehicle_id')->join('branch_tb as br', 'br.ID', '=', 'b.pickup_branch_id')->leftJoin('users_tb as u', 'u.ID', '=', 'p.recorded_by')->whereDate('p.paid_on', '>=', $f['from'])->whereDate('p.paid_on', '<=', $f['to']);
            $this->entity($q, $f, ['customer_id' => 'b.customer_id', 'vehicle_id' => 'b.vehicle_id', 'branch_id' => 'b.pickup_branch_id', 'staff_id' => 'u.emp_id']);
            foreach ($q->orderBy('p.ID')->select(['p.*', 'c.full_name', 'v.vehicle_number', 'br.branch_name'])->lazy(200) as $p) {
                yield ['Date' => $p->paid_on, 'Entry' => $kind, 'Reference' => ($kind === 'Booking Advance' ? 'ADV-' : 'PAY-').$p->ID, 'Customer' => $p->full_name, 'Vehicle' => $p->vehicle_number, 'Branch' => $p->branch_name, ...$empty, 'Rental Cash Received' => $this->money($p->amount)];
            }
        }
        foreach ($this->depositRows($f) as $d) {
            yield ['Date' => $d['Date'], 'Entry' => 'Deposit '.$d['Entry'], 'Reference' => $d['Reference'], 'Customer' => $d['Customer'], 'Vehicle' => $d['Vehicle'], 'Branch' => $d['Branch'], ...$empty, 'Deposit Received' => $d['Deposit Received'], 'Deposit Applied' => $d['Deposit Applied'], 'Deposit Refunded' => $d['Deposit Refunded']];
        }
    }

    private function depositRows(array $f): iterable
    {
        $q = DB::table('rental_deposit_tb as d')->join('rental_tb as r', 'r.ID', '=', 'd.rental_id')->leftJoin('users_tb as u', 'u.ID', '=', 'd.recorded_by');
        $this->dates($q, 'd.created_at', $f);
        $this->entity($q, $f, ['customer_id' => 'r.customer_id', 'vehicle_id' => 'r.vehicle_id', 'branch_id' => 'r.pickup_branch_id', 'staff_id' => 'u.emp_id']);
        foreach ($q->orderBy('d.ID')->select(['d.*', 'r.rental_snapshot'])->lazy(200) as $d) {
            $s = json_decode($d->rental_snapshot, true);
            yield ['Date' => CarbonImmutable::parse($d->created_at, 'UTC')->setTimezone(config('rental.timezone'))->toDateString(), 'Rental' => 'RNT-'.str_pad($d->rental_id, 6, '0', STR_PAD_LEFT), 'Invoice' => $d->invoice_id ? 'INV-'.str_pad($d->invoice_id, 6, '0', STR_PAD_LEFT) : '', 'Customer' => $s['customer']['name'], 'Vehicle' => $s['vehicle']['number'], 'Branch' => $s['pickup_branch'], 'Entry' => $d->entry_type, 'Deposit Received' => $d->entry_type === 'Received' ? $this->money($d->amount) : 0, 'Deposit Applied' => $d->entry_type === 'Applied' ? $this->money($d->amount) : 0, 'Deposit Refunded' => $d->entry_type === 'Refunded' ? $this->money($d->amount) : 0, 'Method' => $d->method, 'Reference' => $d->reference ?? 'DEP-'.$d->ID, 'Recorded By' => $d->recorded_by, 'Reason' => $d->reason];
        }
    }

    private function utilizationRows(array $f): iterable
    {
        $start = CarbonImmutable::parse($f['from'], config('rental.timezone'));
        $end = min(CarbonImmutable::parse($f['to'], config('rental.timezone'))->addDay()->timestamp, now(config('rental.timezone'))->timestamp);
        $q = DB::table('vehicle_tb as v')->join('branch_tb as b', 'b.ID', '=', 'v.branch_id');
        $this->entity($q, $f, ['vehicle_id' => 'v.ID', 'branch_id' => 'v.branch_id']);
        foreach ($q->orderBy('v.ID')->get(['v.ID', 'v.vehicle_number', 'b.branch_name']) as $v) {
            $usage = [];
            $down = [];
            $completed = 0;
            $active = 0;
            foreach (DB::table('rental_tb as r')->leftJoin('rental_return_tb as a', fn ($j) => $j->on('a.rental_id', '=', 'r.ID')->where('a.status', 'Finalized'))->where('r.vehicle_id', $v->ID)->get(['r.actual_pickup_at', 'r.status', 'a.actual_return_at']) as $r) {
                $a = CarbonImmutable::parse($r->actual_pickup_at, config('rental.timezone'))->timestamp;
                $b = $r->actual_return_at ? CarbonImmutable::parse($r->actual_return_at, config('rental.timezone'))->timestamp : $end;
                if ($r->status === 'Completed' && $b >= $start->timestamp && $b < $end) {
                    $completed++;
                }if ($r->status === 'Active') {
                    $active++;
                }$a = max($a, $start->timestamp);
                $b = min($b, $end);
                if ($b > $a) {
                    $usage[] = [$a, $b];
                }
            }
            foreach (DB::table('maintenance_tb')->where('vehicle_id', $v->ID)->whereIn('status', ['Active', 'Completed'])->get() as $m) {
                $a = max(CarbonImmutable::parse($m->starts_at, config('rental.timezone'))->timestamp, $start->timestamp);
                $b = min($m->completed_at ? CarbonImmutable::parse($m->completed_at, config('rental.timezone'))->timestamp : $end, $end);
                if ($b > $a) {
                    $down[] = [$a, $b];
                }
            }
            $used = $this->unionSeconds($usage);
            $downtime = $this->unionSeconds($down);
            $covered = $this->unionSeconds([...$usage, ...$down]);
            yield ['Vehicle' => $v->vehicle_number, 'Branch' => $v->branch_name, 'Trips Completed' => $completed, 'Rental Days' => round($used / 86400, 3), 'Active Rentals' => $active, 'Maintenance Days' => round($downtime / 86400, 3), 'Unclassified Days' => round(max(0, $end - $start->timestamp - $covered) / 86400, 3), 'Measurement Note' => 'Unclassified time is not guaranteed available/idle: historical cleaning, inspection and fleet service dates are not fully recorded.'];
        }
    }

    private function unionSeconds(array $intervals): int
    {
        if (! $intervals) {
            return 0;
        }usort($intervals, fn ($a, $b) => $a[0] <=> $b[0]);
        [$a,$b] = array_shift($intervals);
        $sum = 0;
        foreach ($intervals as [$c,$d]) {
            if ($c <= $b) {
                $b = max($b, $d);
            } else {
                $sum += $b - $a;
                [$a,$b] = [$c, $d];
            }
        }

        return $sum + $b - $a;
    }
}
