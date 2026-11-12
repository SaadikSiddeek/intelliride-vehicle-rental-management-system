<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'role_id',
    'username',
    'email',
    'password',
    'emp_id',
    'status',
])]
#[Hidden([
    'password',
    'remember_token',
    'profile_photo_path',
])]
class User extends Authenticatable
{
    protected $appends = ['can_manage_business', 'display_name', 'has_profile_photo'];

    public function getCanManageBusinessAttribute(): bool
    {
        return $this->status && in_array((string) $this->getAuthIdentifier(), config('customer_access.users', []), true) && $this->role_id && strtolower(trim((string) DB::table('roles_tb')->where('ID', $this->role_id)->value('role_name'))) === 'admin';
    }

    public function getDisplayNameAttribute(): string
    {
        return $this->username ?: 'My account';
    }

    public function getHasProfilePhotoAttribute(): bool
    {
        return ! empty($this->attributes['profile_photo_path']);
    }

    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Database table.
     */
    protected $table = 'users_tb';

    /**
     * Primary key.
     */
    protected $primaryKey = 'ID';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => 'boolean',
            'password' => 'hashed',
        ];
    }
}
