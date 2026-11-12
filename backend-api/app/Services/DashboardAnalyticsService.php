<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class DashboardAnalyticsService
{
    private function scope($q, $column, $branch)
    {
        return $branch ? $q->where($column, $branch) : $q;
    }

    public function finance(array $f): array
    {
        $branch = $f['branch_id'] ?? null;
        $base = $this->scope(DB::table('invoice_tb as i')->join('rental_tb as r', 'r.ID', '=', 'i.rental_id'), 'r.pickup_branch_id', $branch)->whereBetween('i.issued_on', [$f['from'], $f['to']]);
        $i = (clone $base)->selectRaw('COUNT(*) as count, COALESCE(SUM(i.total-i.tax),0) as revenue, COALESCE(SUM(i.total),0) as gross, COALESCE(SUM(i.tax),0) as tax, COALESCE(SUM(i.discount),0) as discount, COALESCE(SUM(i.additional_charges),0) as additional')->first();
        $daily = [];
        $cash = 0;
        foreach ((clone $base)->selectRaw('i.issued_on as day, SUM(i.total-i.tax) as amount')->groupBy('i.issued_on')->get() as $d) {
            $daily[$d->day] = ['date' => $d->day, 'revenue' => (float) $d->amount, 'cash' => 0];
        }
        foreach (['booking_payment_tb', 'invoice_payment_tb'] as $table) {
            $q = DB::table($table.' as p');
            if ($table === 'invoice_payment_tb') {
                $q->join('invoice_tb as i', 'i.ID', '=', 'p.invoice_id')->join('booking_tb as b', 'b.ID', '=', 'i.booking_id');
            } else {
                $q->join('booking_tb as b', 'b.ID', '=', 'p.booking_id');
            }
            $this->scope($q, 'b.pickup_branch_id', $branch)->whereBetween('p.paid_on', [$f['from'], $f['to']]);
            foreach ($q->selectRaw('p.paid_on as day, SUM(p.amount) as amount')->groupBy('p.paid_on')->get() as $d) {
                $cash += BookingService::cents($d->amount);
                $daily[$d->day] ??= ['date' => $d->day, 'revenue' => 0, 'cash' => 0];
                $daily[$d->day]['cash'] += BookingService::cents($d->amount) / 100;
            }
        }
        $start = CarbonImmutable::parse($f['from'], config('rental.timezone'));
        $end = CarbonImmutable::parse($f['to'], config('rental.timezone'))->addDay();
        $deposit = $this->scope(DB::table('rental_deposit_tb as d')->join('rental_tb as r', 'r.ID', '=', 'd.rental_id'), 'r.pickup_branch_id', $branch)->where('d.created_at', '>=', $start->utc()->format('Y-m-d H:i:s'))->where('d.created_at', '<', $end->utc()->format('Y-m-d H:i:s'))->selectRaw('d.entry_type, SUM(d.amount) as amount')->groupBy('d.entry_type')->pluck('amount', 'entry_type');
        $series = [];
        for ($day = $start; $day < $end; $day = $day->addDay()) {
            $series[] = $daily[$day->toDateString()] ?? ['date' => $day->toDateString(), 'revenue' => 0, 'cash' => 0];
        }

        return ['period' => ['Recognized Revenue' => BookingService::money(BookingService::cents($i->revenue)), 'Invoice Total' => BookingService::money(BookingService::cents($i->gross)), 'Tax' => BookingService::money(BookingService::cents($i->tax)), 'Discount' => BookingService::money(BookingService::cents($i->discount)), 'Additional Charges' => BookingService::money(BookingService::cents($i->additional)), 'Rental Cash Received' => BookingService::money($cash), 'Deposit Received' => BookingService::money(BookingService::cents($deposit['Received'] ?? '0')), 'Deposit Applied' => BookingService::money(BookingService::cents($deposit['Applied'] ?? '0')), 'Deposit Refunded' => BookingService::money(BookingService::cents($deposit['Refunded'] ?? '0')), 'invoices_issued' => (int) $i->count], 'daily' => $series];
    }

    public function operations(array $f): array
    {
        $now = CarbonImmutable::now(config('rental.timezone'));
        $wall = $now->format('Y-m-d H:i:s');
        $branch = $f['branch_id'] ?? null;
        $bookings = $this->scope(DB::table('booking_tb as b')->join('customer_tb as c', 'c.ID', '=', 'b.customer_id')->join('vehicle_tb as v', 'v.ID', '=', 'b.vehicle_id')->join('branch_tb as br', 'br.ID', '=', 'b.pickup_branch_id'), 'b.pickup_branch_id', $branch);
        $pickups = (clone $bookings)->where('b.status', 'Confirmed')->where('b.pickup_at', '>=', $wall)->orderBy('b.pickup_at')->limit(6)->get(['b.ID as id', 'c.full_name as customer', 'v.vehicle_number as vehicle', 'br.branch_name as branch', 'b.pickup_at', 'b.status']);
        $trend = (clone $bookings)->whereBetween('b.pickup_at', [$f['from'].' 00:00:00', $f['to'].' 23:59:59'])->selectRaw('DATE(b.pickup_at) as date, COUNT(*) as bookings')->groupByRaw('DATE(b.pickup_at)')->orderBy('date')->get();
        $rentals = $this->scope(DB::table('rental_tb as r'), 'r.pickup_branch_id', $branch);
        $returns = (clone $rentals)->join('booking_tb as b', 'b.ID', '=', 'r.booking_id')->where('r.status', 'Active');
        $todayReturns = (clone $returns)->whereBetween('b.expected_return_at', [$now->startOfDay()->format('Y-m-d H:i:s'), $now->endOfDay()->format('Y-m-d H:i:s')])->count();
        $upcoming = (clone $returns)->orderBy('b.expected_return_at')->limit(6)->get(['r.ID as id', 'r.rental_snapshot', 'r.handover_staff_name as staff', 'b.expected_return_at'])->map(function ($r) use ($wall) {
            $s = json_decode($r->rental_snapshot, true);

            return ['id' => $r->id, 'rental_number' => 'RNT-'.str_pad($r->id, 6, '0', STR_PAD_LEFT), 'customer' => $s['customer']['name'], 'vehicle' => $s['vehicle']['number'], 'branch' => $s['pickup_branch'], 'staff' => $r->staff, 'expected_return_at' => $r->expected_return_at, 'overdue' => $r->expected_return_at < $wall];
        });
        $top = (clone $rentals)->join('vehicle_tb as v', 'v.ID', '=', 'r.vehicle_id')->whereBetween('r.actual_pickup_at', [$f['from'].' 00:00:00', $f['to'].' 23:59:59'])->selectRaw('v.ID as id,v.vehicle_number as vehicle,COUNT(*) as trips')->groupBy('v.ID', 'v.vehicle_number')->orderByDesc('trips')->limit(5)->get();
        $status = (clone $rentals)->whereBetween('r.actual_pickup_at', [$f['from'].' 00:00:00', $f['to'].' 23:59:59'])->selectRaw('r.status as name,COUNT(*) as value')->groupBy('r.status')->get();
        $activities = [];
        foreach ((clone $bookings)->orderByDesc('b.created_at')->limit(5)->get(['b.ID', 'b.created_at', 'c.full_name', 'v.vehicle_number']) as $b) {
            $activities[] = ['kind' => 'Booking created', 'reference' => 'BKG-'.str_pad($b->ID, 6, '0', STR_PAD_LEFT), 'description' => $b->full_name.' · '.$b->vehicle_number, 'at' => $b->created_at, 'path' => '/booking-management/manage?open='.$b->ID];
        }
        foreach ((clone $rentals)->orderByDesc('r.created_at')->limit(5)->get(['r.ID', 'r.created_at', 'r.rental_snapshot', 'r.handover_staff_name']) as $r) {
            $s = json_decode($r->rental_snapshot, true);
            $activities[] = ['kind' => 'Vehicle handed over', 'reference' => 'RNT-'.str_pad($r->ID, 6, '0', STR_PAD_LEFT), 'description' => $s['vehicle']['number'].' · '.$r->handover_staff_name, 'at' => $r->created_at, 'path' => '/active-rental-management/manage?open='.$r->ID];
        }
        $assessment = $this->scope(DB::table('rental_return_tb as a')->join('rental_tb as r', 'r.ID', '=', 'a.rental_id'), 'r.pickup_branch_id', $branch);
        foreach ((clone $assessment)->where('a.status', 'Finalized')->orderByDesc('a.finalized_at')->limit(5)->get(['a.ID', 'a.finalized_at', 'a.receiving_staff_name']) as $a) {
            $activities[] = ['kind' => 'Return finalized', 'reference' => 'RET-'.$a->ID, 'description' => $a->receiving_staff_name, 'at' => $a->finalized_at, 'path' => '/return-management/manage?open='.$a->ID];
        }
        foreach (['invoice_tb' => 'Invoice issued', 'invoice_payment_tb' => 'Payment recorded'] as $table => $label) {
            $q = DB::table($table.' as x');
            if ($table === 'invoice_payment_tb') {
                $q->join('invoice_tb as i', 'i.ID', '=', 'x.invoice_id')->join('rental_tb as r', 'r.ID', '=', 'i.rental_id');
            } else {
                $q->join('rental_tb as r', 'r.ID', '=', 'x.rental_id');
            }$this->scope($q, 'r.pickup_branch_id', $branch);
            foreach ($q->orderByDesc('x.created_at')->limit(5)->get($table === 'invoice_payment_tb' ? ['x.ID', 'x.created_at', 'x.invoice_id'] : ['x.ID', 'x.created_at']) as $x) {
                $activities[] = ['kind' => $label, 'reference' => ($table === 'invoice_tb' ? 'INV-' : 'PAY-').str_pad($x->ID, 6, '0', STR_PAD_LEFT), 'description' => 'Authenticated financial entry', 'at' => $x->created_at, 'path' => '/invoice-management/manage?open='.($table === 'invoice_tb' ? $x->ID : $x->invoice_id)];
            }
        }
        usort($activities, fn ($a, $b) => strcmp($b['at'] ?? '', $a['at'] ?? ''));
        $activities = array_slice($activities, 0, 8);
        foreach ($activities as &$a) {
            $a['at'] = $a['at'] ? CarbonImmutable::parse($a['at'], 'UTC')->setTimezone(config('rental.timezone'))->format('Y-m-d H:i:s') : null;
        }
        $previousEnd = CarbonImmutable::parse($f['from'])->subDay();
        $days = (int) CarbonImmutable::parse($f['from'])->diffInDays(CarbonImmutable::parse($f['to'])) + 1;
        $previous = $this->finance([...$f, 'from' => $previousEnd->subDays($days - 1)->toDateString(), 'to' => $previousEnd->toDateString()]);

        return ['today_bookings' => (clone $bookings)->where('b.status', 'Confirmed')->whereDate('b.pickup_at', $now->toDateString())->count(), 'today_returns' => $todayReturns, 'pending_reviews' => (clone $assessment)->where('a.status', 'Pending Review')->count(), 'inspection_vehicles' => $this->scope(DB::table('vehicle_tb')->where('status','Inspection Required'), 'branch_id', $branch)->count(), 'pickups' => $pickups, 'returns' => $upcoming, 'booking_trend' => $trend, 'top_vehicles' => $top, 'rental_status' => $status, 'activity' => $activities, 'previous' => ['from' => $previousEnd->subDays($days - 1)->toDateString(), 'to' => $previousEnd->toDateString(), 'revenue' => $previous['period']['Recognized Revenue'], 'cash' => $previous['period']['Rental Cash Received']]];
    }
}
