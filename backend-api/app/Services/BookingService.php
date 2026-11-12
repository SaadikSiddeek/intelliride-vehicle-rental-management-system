<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class BookingService
{
    public const UNIT_MINUTES = ['day' => 1440, 'week' => 10080, 'month' => 43200];

    public static function cents(string|int|float $value): int
    {
        if (! preg_match('/^\d{1,10}(\.\d{1,2})?$/D', (string) $value)) {
            throw ValidationException::withMessages(['amount' => 'Enter a valid amount with at most two decimal places.']);
        }
        [$whole, $fraction] = array_pad(explode('.', (string) $value), 2, '');

        return (int) $whole * 100 + (int) str_pad($fraction, 2, '0');
    }

    public static function money(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }

    public function canOverride($user): bool
    {
        return in_array((string) $user->getAuthIdentifier(), config('rental.pricing_user_ids', []), true);
    }

    public function quote(array $data, $user, ?object $package = null): array
    {
        $package ??= DB::table('rental_package_tb')->where('ID', $data['package_id'])->first();
        if (! $package || ! (int) $package->status || (int) $package->vehicle_id !== (int) $data['vehicle_id']) {
            throw ValidationException::withMessages(['package_id' => 'Select an active package for this vehicle.']);
        }
        $timezone = config('rental.timezone');
        $pickup = CarbonImmutable::createFromFormat('!Y-m-d\TH:i', $data['pickup_at'], $timezone);
        $return = CarbonImmutable::createFromFormat('!Y-m-d\TH:i', $data['expected_return_at'], $timezone);
        $minutes = (int) $pickup->diffInMinutes($return, false);
        if ($minutes <= 0 || $minutes > 527040) {
            throw ValidationException::withMessages(['expected_return_at' => 'Return must be after pickup and within 366 days.']);
        }
        $unitMinutes = self::UNIT_MINUTES[$package->billing_unit];
        $units = max((int) $package->minimum_units, (int) ceil($minutes / $unitMinutes));
        $rate = self::cents($package->rate_per_unit);
        $agreed = isset($data['agreed_rate']) ? self::cents($data['agreed_rate']) : $rate;
        $discount = self::cents($data['discount'] ?? '0');
        if (($rate !== $agreed || $discount > 0) && ! $this->canOverride($user)) {
            throw ValidationException::withMessages(['discount' => 'Pricing override permission is required.']);
        }
        $extras = [];
        $extraTotal = 0;
        foreach ($data['extras'] ?? [] as $code) {
            $extra = config('rental.extras.'.$code);
            if (! $extra) {
                throw ValidationException::withMessages(['extras' => 'An extra is no longer available.']);
            }
            $amount = self::cents($extra['amount']);
            $extraTotal += $amount;
            $extras[] = ['code' => $code, 'label' => $extra['label'], 'amount' => self::money($amount)];
        }
        $subtotal = $agreed * $units + $extraTotal;
        if ($discount > $subtotal) {
            throw ValidationException::withMessages(['discount' => 'Discount cannot exceed the subtotal.']);
        }
        $taxBasisPoints = (int) config('rental.tax_basis_points', 0);
        if ($taxBasisPoints < 0 || $taxBasisPoints > 10000) {
            throw ValidationException::withMessages(['tax' => 'The configured tax rate must be reviewed by an administrator.']);
        }
        $taxable = $subtotal - $discount;
        $tax = intdiv($taxable * $taxBasisPoints + 5000, 10000);
        $total = $taxable + $tax;
        if ($total > 99999999999999) {
            throw ValidationException::withMessages(['package_id' => 'This rental exceeds the supported amount.']);
        }

        return [
            'version' => 1, 'currency' => 'LKR', 'timezone' => $timezone,
            'quoted_at' => now()->toIso8601String(), 'package_id' => $package->ID,
            'package_name' => $package->package_name, 'billing_unit' => $package->billing_unit,
            'duration_minutes' => $minutes, 'units' => $units,
            'package_rate' => self::money($rate), 'agreed_rate' => self::money($agreed),
            'included_km' => $package->included_km_per_unit === null ? null : $units * (int) $package->included_km_per_unit,
            'included_km_per_unit' => $package->included_km_per_unit,
            'extra_km_charge' => (string) $package->extra_km_charge,
            'extras' => $extras, 'subtotal' => self::money($subtotal),
            'discount' => self::money($discount), 'tax_basis_points' => $taxBasisPoints,
            'tax' => self::money($tax), 'total' => self::money($total),
            'security_deposit' => (string) $package->security_deposit,
            'pricing_authorized_by' => ($rate !== $agreed || $discount > 0) ? $user->getAuthIdentifier() : null,
        ];
    }

    public static function excludeCompletedRentals($query, string $bookingTable = 'booking_tb'): void
    {
        if (Schema::hasTable('rental_tb')) {
            $query->whereNotExists(fn ($q) => $q->selectRaw('1')->from('rental_tb as completed_rental')
                ->whereColumn('completed_rental.booking_id', $bookingTable.'.ID')->where('completed_rental.status', 'Completed'));
        }
    }

    public function assertAvailable(array $data, ?int $exceptBooking = null, ?int $exceptBlock = null): void
    {
        // Every reservation writer must hold vehicle_tb.ID FOR UPDATE first.
        $pickup = str_replace('T', ' ', $data['pickup_at']).':00';
        $return = str_replace('T', ' ', $data['expected_return_at']).':00';
        $query = DB::table('booking_tb')->where('vehicle_id', $data['vehicle_id'])
            ->whereIn('status', ['Confirmed', 'Converted to Rental'])
            ->where('pickup_at', '<', $return)->where('expected_return_at', '>', $pickup);
        self::excludeCompletedRentals($query);
        if ($exceptBooking) {
            $query->where('ID', '!=', $exceptBooking);
        }
        if ($query->lockForUpdate()->first(['ID'])) {
            throw ValidationException::withMessages(['vehicle_id' => 'This vehicle is reserved for the selected period.']);
        }
        $blockedQuery = DB::table('vehicle_unavailability_tb')->where('vehicle_id', $data['vehicle_id'])
            ->whereIn('status', ['Scheduled', 'Active'])->where('starts_at', '<', $return)
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', $pickup));
        if ($exceptBlock) {
            $blockedQuery->where('ID', '!=', $exceptBlock);
        }
        $blocked = $blockedQuery->lockForUpdate()->first(['ID']);
        if ($blocked) {
            throw ValidationException::withMessages(['vehicle_id' => 'Maintenance or an active rental blocks this period.']);
        }
    }
}
