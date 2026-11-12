<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rental extends Model
{
    protected $table = 'rental_tb';

    protected $primaryKey = 'ID';

    protected $guarded = ['ID'];

    protected function casts(): array
    {
        return ['pricing_snapshot' => 'array', 'rental_snapshot' => 'array', 'pickup_fuel_litres' => 'decimal:3', 'identity_verified' => 'boolean', 'licence_verified' => 'boolean'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'ID');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id', 'ID');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id', 'ID');
    }

    public function handedOverBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handed_over_by', 'ID');
    }

    public function deposits(): HasMany
    {
        return $this->hasMany(RentalDeposit::class, 'rental_id', 'ID');
    }
}
