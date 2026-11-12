<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $table = 'customer_tb';

    protected $primaryKey = 'ID';

    protected $guarded = ['ID'];

    public function documents(): HasMany
    {
        return $this->hasMany(CustomerDocument::class, 'customer_id', 'ID');
    }
}
