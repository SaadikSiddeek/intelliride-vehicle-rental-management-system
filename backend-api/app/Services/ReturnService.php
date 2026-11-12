<?php

namespace App\Services;

use App\Models\Rental;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReturnService
{
    public function depositBalance(int $rentalId): array
    {
        $totals = ['Received' => 0, 'Applied' => 0, 'Refunded' => 0];
        foreach (DB::table('rental_deposit_tb')->where('rental_id', $rentalId)->get() as $entry) {
            $totals[$entry->entry_type] += BookingService::cents($entry->amount);
        }

        return [...$totals, 'Held' => $totals['Received'] - $totals['Applied'] - $totals['Refunded']];
    }

    public function millilitres(string|int|float $value): int
    {
        if (! preg_match('/^\d{1,5}(\.\d{1,3})?$/D', (string) $value)) {
            throw ValidationException::withMessages(['return_fuel_litres' => 'Enter litres with at most three decimal places.']);
        }
        [$whole,$fraction] = array_pad(explode('.', (string) $value), 2, '');

        return (int) $whole * 1000 + (int) str_pad($fraction, 3, '0');
    }

    private function multiply(int $a, int $b): int
    {
        if ($a < 0 || $b < 0 || ($b > 0 && $a > intdiv(99999999999999, $b))) {
            throw ValidationException::withMessages(['amount' => 'The assessed amount exceeds the supported invoice limit.']);
        }

        return $a * $b;
    }

    public function calculate(Rental $rental, object $assessment): array
    {
        $pricing = $rental->pricing_snapshot;
        $snapshot = $rental->rental_snapshot;
        $policy = $snapshot['return_policy'] ?? null;
        $blockers = [];
        if ($policy) {
            foreach (['weekly_monthly_hourly_rate', 'weekly_monthly_24h_cap', 'fuel_price_per_litre'] as $key) {
                if (! isset($policy[$key])) {
                    $policy[$key] = app(BusinessProfileService::class)->policy()[$key];
                }
            }
        }
        $return = CarbonImmutable::parse($assessment->actual_return_at, config('rental.timezone'));
        $pickup = CarbonImmutable::parse($rental->actual_pickup_at, config('rental.timezone'));
        $scheduled = CarbonImmutable::parse($snapshot['expected_return_at'], config('rental.timezone'));
        if ($return->lessThan($pickup) || $return->greaterThan(now(config('rental.timezone')))) {
            throw ValidationException::withMessages(['actual_return_at' => 'Return cannot be before pickup or in the future.']);
        }
        if ($assessment->ending_odometer < $rental->starting_odometer) {
            throw ValidationException::withMessages(['ending_odometer' => 'Ending odometer cannot be below the starting odometer.']);
        }
        $distance = $assessment->ending_odometer - $rental->starting_odometer;
        $extraKm = $pricing['included_km'] === null ? 0 : max(0, $distance - (int) $pricing['included_km']);
        $extraCharge = $this->multiply($extraKm, BookingService::cents($pricing['extra_km_charge']));
        $lateMinutes = max(0, (int) $scheduled->diffInMinutes($return, false));
        $hours = 0;
        $hourRate = null;
        $cap = null;
        $late = 0;
        if (! $policy) {
            $blockers[] = 'The rental has no confirmed return policy snapshot.';
        } elseif ($lateMinutes > (int) $policy['grace_minutes']) {
            $hours = (int) ceil($lateMinutes / 60);
            if ($pricing['billing_unit'] === 'day') {
                $daily = BookingService::cents($pricing['agreed_rate']);
                $hourRate = intdiv($daily * (int) $policy['daily_hourly_basis_points'] + 5000, 10000);
                $cap = $daily;
            } elseif (isset($policy['weekly_monthly_hourly_rate'],$policy['weekly_monthly_24h_cap'])) {
                $hourRate = BookingService::cents($policy['weekly_monthly_hourly_rate']);
                $cap = BookingService::cents($policy['weekly_monthly_24h_cap']);
            } else {
                $blockers[] = 'An explicit late hourly rate and 24-hour cap are required for weekly/monthly packages.';
            }
            if ($hourRate !== null && $cap !== null) {
                $late = $this->multiply(intdiv($hours, 24), $cap) + min($this->multiply($hours % 24, $hourRate), $cap);
            }
        }
        $missingMl = max(0, $this->millilitres($rental->pickup_fuel_litres) - $this->millilitres($assessment->return_fuel_litres));
        $fuel = 0;
        $fuelRate = null;
        if ($missingMl > 0) {
            if (! isset($policy['fuel_price_per_litre'])) {
                $blockers[] = 'A configured fuel price per litre is required for this fuel shortage.';
            } else {
                $fuelRate = BookingService::cents($policy['fuel_price_per_litre']);
                $fuel = $this->multiply(intdiv($missingMl, 1000), $fuelRate) + intdiv(($missingMl % 1000) * $fuelRate + 500, 1000) + BookingService::cents($policy['fuel_service_charge'] ?? '0.00');
            }
        }
        $damage = BookingService::cents($assessment->damage_charge);
        $estimate = BookingService::cents($assessment->damage_estimate);
        if ($damage > $estimate) {
            throw ValidationException::withMessages(['damage_charge' => 'Approved damage cannot exceed the documented estimate.']);
        }
        if ($damage > 0 && (empty($assessment->new_damage) || empty($assessment->damage_reason))) {
            $blockers[] = 'Applied damage needs a description and recorded approval reason.';
        }
        $additional = $extraCharge + $late + $fuel + $damage;
        if ($additional > 99999999999999) {
            throw ValidationException::withMessages(['amount' => 'The assessed amount exceeds the supported invoice limit.']);
        }
        $tax = intdiv($additional * (int) $pricing['tax_basis_points'] + 5000, 10000);
        $total = BookingService::cents($pricing['total']) + $additional + $tax;
        if ($total > 99999999999999) {
            throw ValidationException::withMessages(['ending_odometer' => 'The assessed charges exceed the supported invoice amount.']);
        }
        $advance = (int) DB::table('booking_payment_tb')->where('booking_id', $rental->booking_id)->get()->sum(fn ($p) => BookingService::cents($p->amount));
        $deposit = $this->depositBalance($rental->ID);
        $unpaid = max(0, $total - $advance);
        $apply = $assessment->apply_deposit ? min($deposit['Held'], $unpaid) : 0;
        if ($deposit['Held'] < 0) {
            $blockers[] = 'Deposit ledger is inconsistent and needs finance review.';
        }
        $quote = ['effective_return_policy' => $policy, 'rental_id' => $rental->ID, 'return_id' => $assessment->ID, 'revision' => $assessment->revision, 'duration_minutes' => (int) $pickup->diffInMinutes($return),
            'actual_distance_km' => $distance, 'included_km' => $pricing['included_km'], 'extra_km' => $extraKm, 'extra_km_rate' => $pricing['extra_km_charge'], 'extra_km_charge' => BookingService::money($extraCharge),
            'late_minutes' => $lateMinutes, 'grace_minutes' => $policy['grace_minutes'] ?? null, 'chargeable_late_hours' => $hours, 'late_hourly_rate' => $hourRate === null ? null : BookingService::money($hourRate), 'late_24h_cap' => $cap === null ? null : BookingService::money($cap), 'late_charge' => BookingService::money($late),
            'missing_fuel_litres' => intdiv($missingMl, 1000).'.'.str_pad((string) ($missingMl % 1000), 3, '0', STR_PAD_LEFT), 'fuel_price_per_litre' => $fuelRate === null ? null : BookingService::money($fuelRate), 'fuel_charge' => BookingService::money($fuel),
            'damage_estimate' => BookingService::money($estimate), 'damage_charge' => BookingService::money($damage), 'damage_approval_required' => $damage > 0,
            'base_rental_total' => $pricing['total'], 'additional_charges' => BookingService::money($additional), 'additional_tax' => BookingService::money($tax), 'total' => BookingService::money($total), 'booking_advance_amount' => BookingService::money($advance),
            'deposit_received' => BookingService::money($deposit['Received']), 'deposit_held' => BookingService::money(max(0, $deposit['Held'])), 'deposit_to_apply' => BookingService::money(max(0, $apply)), 'refundable_deposit' => BookingService::money(max(0, $deposit['Held'] - $apply)), 'outstanding' => BookingService::money(max(0, $unpaid - $apply)),
            'blockers' => $blockers, 'vehicle_after_return' => $assessment->vehicle_after_return];
        $quote['review_hash'] = hash_hmac('sha256', json_encode($quote, JSON_THROW_ON_ERROR), (string) config('app.key'));

        return $quote;
    }
}
