param([switch]$Frontend)
$ErrorActionPreference = 'Stop'
$backend = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($env:INTELLIRIDE_RBAC_DEMO -eq '1' -or $env:DB_DATABASE -like '*.rbac-demo.sqlite' -or $env:LARAVEL_STORAGE_PATH -like '*rbac-demo*') {
    throw 'Demo overrides are present in this terminal. Open a fresh PowerShell window for the main localhost application.'
}
if ($Frontend) {
    $env:VITE_API_BASE_URL = 'http://localhost:8000'
    Set-Location (Join-Path $backend '..\frontend')
    npm run dev -- --host localhost --port 3000 --strictPort
    exit $LASTEXITCODE
}
$php = (Get-Command php -ErrorAction SilentlyContinue).Source
if (!$php -and (Test-Path 'C:\php\php.exe')) { $php = 'C:\php\php.exe' }
if (!$php) { throw 'PHP was not found.' }
Set-Location $backend
& $php artisan intelliride:local-status
if ($LASTEXITCODE -ne 0) { throw 'The main local database configuration did not pass verification. No server was started.' }
& $php artisan serve --host=127.0.0.1 --port=8000 --no-reload
exit $LASTEXITCODE
