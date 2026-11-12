<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    protected $table = 'booking_tb';

    protected $primaryKey = 'ID';

    protected $guarded = ['ID'];

    protected function casts(): array
    {
        return ['pricing_snapshot' => 'array', 'total' => 'decimal:2'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id', 'ID');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id', 'ID');
    }

    public function rentalPackage(): BelongsTo
    {
        return $this->belongsTo(RentalPackage::class, 'package_id', 'ID');
    }
}
