<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalDeposit extends Model
{
    protected $table = 'rental_deposit_tb';

    protected $primaryKey = 'ID';

    protected $guarded = ['ID'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class, 'rental_id', 'ID');
    }
}
