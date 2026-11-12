<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerDocument extends Model
{
    protected $table = 'customer_document_tb';

    protected $primaryKey = 'ID';

    protected $guarded = ['ID'];

    protected $hidden = ['path'];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id', 'ID');
    }
}
