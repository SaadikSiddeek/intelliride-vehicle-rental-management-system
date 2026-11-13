<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AccessService;
use App\Services\BusinessProfileService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DeploymentAuditCommand extends Command
{
    protected $signature = 'intelliride:deployment-audit {--user= : Deployment-local account ID to inspect}';

    protected $description = 'Read-only, redacted deployment readiness and authorization report';

    public function handle(AccessService $access): int
    {
        $connection = config('database.default');
        $report = [
            'environment' => app()->environment(), 'debug_enabled' => (bool) config('app.debug'),
            'app_url' => config('app.url'), 'app_key_present' => filled(config('app.key')),
            'configuration_cached' => app()->configurationIsCached(), 'routes_cached' => app()->routesAreCached(),
            'database_driver' => config('database.connections.'.$connection.'.driver'),
            'cache_store' => config('cache.default'), 'session_driver' => config('session.driver'),
            'session_secure_cookie' => config('session.secure'), 'session_same_site' => config('session.same_site'),
            'authentication' => 'Sanctum bearer personal access tokens',
            'cors_origins' => config('cors.allowed_origins'), 'cors_credentials' => config('cors.supports_credentials'),
            'legacy_customer_assignment_count' => count(config('customer_access.users', [])),
            'operations_assignment_mode' => config('access.operations_users') === null ? 'legacy customer IDs plus explicitly configured roles' : 'explicit operations IDs plus explicitly configured roles',
            'operations_role_names' => config('access.operations_roles', []),
            'image_processing_available' => app(BusinessProfileService::class)->imageProcessingAvailable(),
            'image_webp_available' => function_exists('imagecreatefromwebp'),
            'zip_available' => class_exists(\ZipArchive::class),
            'storage_app_writable' => is_writable(storage_path('app')),
            'upload_max_filesize' => ini_get('upload_max_filesize'), 'post_max_size' => ini_get('post_max_size'),
        ];
        try {
            $ran = Schema::hasTable('migrations') ? DB::table('migrations')->pluck('migration')->all() : [];
            $files = app('migrator')->getMigrationFiles(database_path('migrations'));
            $report['pending_migrations'] = array_values(array_diff(array_keys($files), $ran));
            $report['tables'] = [];
            foreach (['booking_tb', 'booking_payment_tb', 'rental_tb', 'rental_return_tb', 'invoice_tb', 'invoice_payment_tb', 'rental_deposit_tb', 'vehicle_unavailability_tb', 'maintenance_tb', 'vehicle_document_tb', 'business_profile_tb', 'business_profile_audit_tb'] as $table) {
                $report['tables'][$table] = Schema::hasTable($table);
            }
            if ($id = $this->option('user')) {
                if (! ctype_digit((string) $id)) {
                    $this->error('User must be a numeric account ID.');

                    return self::FAILURE;
                }
                $user = User::find($id);
                $report['account'] = $user ? ['id' => $user->getKey(), 'active' => (bool) $user->status, 'role_id' => $user->role_id, 'role_name' => DB::table('roles_tb')->where('ID', $user->role_id)->value('role_name'), 'employee_link_found' => ctype_digit((string) $user->emp_id) && DB::table('staff_tb')->where('ID', $user->emp_id)->exists(), 'capabilities' => $access->capabilities($user)] : ['found' => false];
            }
        } catch (\Throwable $exception) {
            // Do not expose a DSN, password, SQL parameters, or stack trace in a diagnostic artifact.
            $report['database_check'] = 'Failed; inspect private service logs securely.';
            $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return self::FAILURE;
        }
        $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return self::SUCCESS;
    }
}
