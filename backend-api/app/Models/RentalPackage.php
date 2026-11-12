<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalPackage extends Model
{
    protected $table = 'rental_package_tb';

    protected $primaryKey = 'ID';

    protected $guarded = ['ID'];

    protected function casts(): array
    {
        return ['rate_per_unit' => 'decimal:2', 'security_deposit' => 'decimal:2',
            'extra_km_charge' => 'decimal:2', 'status' => 'boolean'];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id', 'ID');
    }
}
