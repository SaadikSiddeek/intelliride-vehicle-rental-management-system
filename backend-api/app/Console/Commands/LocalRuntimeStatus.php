<?php

namespace App\Console\Commands;

use App\Services\PermissionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LocalRuntimeStatus extends Command
{
    protected $signature = 'intelliride:local-status';
    protected $description = 'Verify the normal local MySQL runtime without printing credentials or changing data';

    public function handle(PermissionService $permissions): int
    {
        $connection = DB::connection();
        $host = config('database.connections.'.config('database.default').'.host');
        if (! app()->environment('local') || $connection->getDriverName() !== 'mysql'
            || $connection->getDatabaseName() !== 'intelliride_rental' || ! in_array($host, ['localhost', '127.0.0.1'], true)) {
            $this->error('Expected the local MySQL intelliride_rental database. Check inherited terminal overrides and .env; nothing was changed.');
            return self::FAILURE;
        }
        $this->info('Main project: '.base_path());
        $this->line('Database: mysql / intelliride_rental (local)');
        $this->line('Authorization: '.($permissions->enabled() ? 'RBAC active' : 'legacy — explicit RBAC account mapping not activated'));
        $this->line('RBAC schema: '.(Schema::hasTable('authorization_state_tb') && Schema::hasColumn('users_tb', 'user_type') ? 'installed' : 'pending'));
        $this->line('Frontend: http://localhost:3000');
        $this->line('Backend: http://localhost:8000');
        return self::SUCCESS;
    }
}
