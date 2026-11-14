param([switch]$Setup, [switch]$Frontend)
$ErrorActionPreference = 'Stop'
$backend = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$demoDirectory = Join-Path $backend 'storage\app\rbac-demo'
$database = Join-Path $demoDirectory 'training.rbac-demo.sqlite'
$php = (Get-Command php -ErrorAction SilentlyContinue).Source
if (!$php -and (Test-Path 'C:\php\php.exe')) { $php = 'C:\php\php.exe' }
if (!$php) { throw 'PHP was not found.' }
if (Test-Path (Join-Path $backend 'bootstrap\cache\config.php')) { throw 'A shared config cache exists. Use a separate uncached checkout for the demo; no cache was modified.' }
if ($Frontend) {
    # A development-only same-origin proxy avoids changing production CORS.
    $env:VITE_API_BASE_URL = ''
    $env:INTELLIRIDE_RBAC_DEMO = '1'
    Set-Location (Join-Path $backend '..\frontend')
    npm run dev -- --host 127.0.0.1 --port 3001 --strictPort
    exit $LASTEXITCODE
}
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = $database
$env:DB_URL = ''
$env:APP_ENV = 'local'
$env:APP_DEBUG = 'false'
$env:APP_URL = 'http://127.0.0.1:8001'
$env:CACHE_STORE = 'array'
$env:SESSION_DRIVER = 'array'
$env:QUEUE_CONNECTION = 'sync'
$env:MAIL_MAILER = 'log'
$env:LARAVEL_STORAGE_PATH = Join-Path $demoDirectory 'runtime'
foreach ($folder in @('logs', 'app', 'framework\cache\data', 'framework\sessions', 'framework\views')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $env:LARAVEL_STORAGE_PATH $folder) | Out-Null
}
Set-Location $backend
if ($Setup) {
    New-Item -ItemType Directory -Force -Path $demoDirectory | Out-Null
    if (!(Test-Path -LiteralPath $database)) { New-Item -ItemType File -Path $database | Out-Null }
    & $php -d extension=pdo_sqlite -d extension=sqlite3 artisan migrate --force
    if ($LASTEXITCODE -ne 0) { throw 'Demo migrations failed. Existing data was not reset.' }
    & $php -d extension=pdo_sqlite -d extension=sqlite3 artisan intelliride:rbac-initialize
    exit $LASTEXITCODE
}
if (!(Test-Path -LiteralPath $database)) { throw 'Run this script with -Setup first.' }
# Run the request process directly: artisan serve does not forward PHP -d options.
$router = Join-Path $backend 'vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
Set-Location (Join-Path $backend 'public')
& $php -d extension=pdo_sqlite -d extension=sqlite3 -S '127.0.0.1:8001' $router
exit $LASTEXITCODE
