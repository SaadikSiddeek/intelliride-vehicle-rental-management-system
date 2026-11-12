<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    protected $table = 'vehicle_tb';

    protected $primaryKey = 'ID';

    protected $guarded = ['ID'];

    public function rentalPackages(): HasMany
    {
        return $this->hasMany(RentalPackage::class, 'vehicle_id', 'ID');
    }
}
