<?php

namespace App\Models;

use App\Services\AccessService;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
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
    protected $appends = ['can_manage_business', 'display_name', 'has_profile_photo', 'permissions', 'authorization_mode', 'effective_permissions'];

    public function getAuthorizationModeAttribute(): string
    {
        return app(\App\Services\PermissionService::class)->enabled() ? 'rbac' : 'legacy';
    }

    public function getEffectivePermissionsAttribute(): array
    {
        return app(\App\Services\PermissionService::class)->effective($this);
    }

    public function getCanManageBusinessAttribute(): bool
    {
        return app(AccessService::class)->company($this);
    }

    public function getPermissionsAttribute(): array
    {
        return app(AccessService::class)->capabilities($this);
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
            'must_change_password' => 'boolean',
            'password' => 'hashed',
        ];
    }
}
