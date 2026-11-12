<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BookingService;
use App\Services\DashboardAnalyticsService;
use App\Services\ReportService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DashboardController extends Controller
{
    public function overview(Request $request, ReportService $reports)
    {
        app(RentalController::class)->authorizeStaff($request);
        $f = $request->validate(['from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'], 'branch_id' => ['nullable', 'integer', 'exists:branch_tb,ID']]);
        $now = CarbonImmutable::now(config('rental.timezone'));
        $f['from'] = $f['from'] ?? $now->startOfMonth()->toDateString();
        $f['to'] = $f['to'] ?? $now->toDateString();
        if ($f['to'] < $f['from'] || CarbonImmutable::parse($f['from'])->diffInDays(CarbonImmutable::parse($f['to'])) > 366) {
            throw ValidationException::withMessages(['to' => 'Select an ordered date range of at most 367 days.']);
        }
        $branch = $f['branch_id'] ?? null;
        $scope = fn ($q, $column) => $branch ? $q->where($column, $branch) : $q;
        $wall = $now->format('Y-m-d H:i:s');
        $active = $scope(DB::table('rental_tb as r')->where('r.status', 'Active'), 'r.pickup_branch_id');
        $activeBookings = $scope(DB::table('booking_tb')->where('status', 'Confirmed')->where('expected_return_at', '>', $wall), 'pickup_branch_id');
        $vehicles = $scope(DB::table('vehicle_tb as v'), 'v.branch_id');
        $available = (clone $vehicles)->where('v.status', 'Available')
            ->whereNotExists(function ($q) use ($wall) {
                $q->selectRaw('1')->from('booking_tb as b')->whereColumn('b.vehicle_id', 'v.ID')->whereIn('b.status', ['Confirmed', 'Converted to Rental'])->where('b.pickup_at', '<=', $wall)->where('b.expected_return_at', '>', $wall)
                    ->whereNotExists(fn ($r) => $r->selectRaw('1')->from('rental_tb as completed')->whereColumn('completed.booking_id', 'b.ID')->where('completed.status', 'Completed'));
            })->whereNotExists(fn ($q) => $q->selectRaw('1')->from('vehicle_unavailability_tb as u')->whereColumn('u.vehicle_id', 'v.ID')->whereIn('u.status', ['Scheduled', 'Active'])->where('u.starts_at', '<=', $wall)->where(fn ($e) => $e->whereNull('u.ends_at')->orWhere('u.ends_at', '>', $wall)))->count();
        $analytics = app(DashboardAnalyticsService::class);
        $financial = $analytics->finance($f);
        $period = $financial['period'];
        $daily = $financial['daily'];
        $payments = DB::table('invoice_payment_tb')->selectRaw('invoice_id, SUM(amount) AS amount')->groupBy('invoice_id');
        $applied = DB::table('rental_deposit_tb')->where('entry_type', 'Applied')->selectRaw('invoice_id, SUM(amount) AS amount')->groupBy('invoice_id');
        $invoices = $scope(DB::table('invoice_tb as i')->join('rental_tb as r', 'r.ID', '=', 'i.rental_id')->leftJoinSub($payments, 'p', 'p.invoice_id', '=', 'i.ID')->leftJoinSub($applied, 'a', 'a.invoice_id', '=', 'i.ID'), 'r.pickup_branch_id');

        $expression = '(i.total-i.booking_advance_amount-COALESCE(p.amount,0)-COALESCE(a.amount,0))';
        $balances = $invoices->selectRaw("COALESCE(SUM(CASE WHEN $expression>0 THEN $expression ELSE 0 END),0) as outstanding, COALESCE(SUM(CASE WHEN $expression>0 THEN 1 ELSE 0 END),0) as unpaid_count")->first();
        $outstanding = BookingService::cents($balances->outstanding);
        $unpaidCount = (int) $balances->unpaid_count;
        $depositGroups = $scope(DB::table('rental_deposit_tb as d')->join('rental_tb as r', 'r.ID', '=', 'd.rental_id'), 'r.pickup_branch_id')->selectRaw("d.rental_id,r.status,SUM(CASE WHEN d.entry_type='Received' THEN d.amount ELSE -d.amount END) as held")->groupBy('d.rental_id', 'r.status');
        $depositTotals = DB::query()->fromSub($depositGroups, 'h')->selectRaw("COALESCE(SUM(CASE WHEN held>0 THEN held ELSE 0 END),0) as held, COALESCE(SUM(CASE WHEN held>0 AND status='Completed' THEN held ELSE 0 END),0) as pending, COALESCE(SUM(CASE WHEN held>0 AND status='Completed' THEN 1 ELSE 0 END),0) as pending_count")->first();
        $held = BookingService::cents($depositTotals->held);
        $pendingSettlement = BookingService::cents($depositTotals->pending);
        $maintenance = $scope(DB::table('maintenance_tb as m')->join('vehicle_tb as v', 'v.ID', '=', 'm.vehicle_id'), 'v.branch_id');
        $docs = $scope(DB::table('vehicle_document_tb as d')->join('vehicle_tb as v', 'v.ID', '=', 'd.vehicle_id')->whereNull('d.superseded_at'), 'v.branch_id');
        $returns = (clone $active)->join('booking_tb as b', 'b.ID', '=', 'r.booking_id')->orderBy('b.expected_return_at')->limit(8)->get(['r.ID', 'r.rental_snapshot', 'b.expected_return_at'])->map(function ($r) use ($wall) {
            $s = json_decode($r->rental_snapshot, true);

            return ['rental_number' => 'RNT-'.str_pad($r->ID, 6, '0', STR_PAD_LEFT), 'customer' => $s['customer']['name'], 'vehicle' => $s['vehicle']['number'], 'expected_return_at' => $r->expected_return_at, 'overdue' => $r->expected_return_at < $wall];
        });

        return response()->json(['status' => true, 'data' => ['filters' => $f, 'as_of' => $wall, 'timezone' => config('rental.timezone'),
            'current' => ['active_rentals' => (clone $active)->count(), 'confirmed_bookings' => $activeBookings->count(), 'overdue_rentals' => (clone $active)->join('booking_tb as b', 'b.ID', '=', 'r.booking_id')->where('b.expected_return_at', '<', $wall)->count(), 'upcoming_returns' => (clone $active)->join('booking_tb as b', 'b.ID', '=', 'r.booking_id')->whereBetween('b.expected_return_at', [$wall, $now->addDays(7)->format('Y-m-d H:i:s')])->count(), 'available_vehicles' => $available, 'fleet_total' => (clone $vehicles)->count(), 'outstanding_invoices' => $unpaidCount, 'outstanding_balance' => BookingService::money($outstanding), 'deposit_held' => BookingService::money($held), 'completed_deposit_count' => (int) $depositTotals->pending_count, 'completed_deposit_unsettled' => BookingService::money($pendingSettlement), 'active_maintenance' => (clone $maintenance)->where('m.status', 'Active')->count(), 'scheduled_maintenance' => (clone $maintenance)->where('m.status', 'Scheduled')->count(), 'expired_documents' => (clone $docs)->whereDate('d.expires_on', '<', $now->toDateString())->count(), 'expiring_documents' => (clone $docs)->whereBetween('d.expires_on', [$now->toDateString(), $now->addDays(30)->toDateString()])->count()],
            'period' => $period, 'daily' => $daily, 'analytics' => $analytics->operations($f), 'returns' => $returns,
            'fleet_status' => (clone $vehicles)->selectRaw('v.status as name, COUNT(*) as value')->groupBy('v.status')->get(),
        ]])->header('Cache-Control', 'private, no-store');
    }
}
