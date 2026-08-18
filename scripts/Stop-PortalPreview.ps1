[CmdletBinding()]
param(
    [string]$BackendRepository
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($BackendRepository)) {
    $BackendRepository = Join-Path $PSScriptRoot '..\..\open-giftcard'
}

$portalRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendRoot = (Resolve-Path $BackendRepository).Path
$statePath = Join-Path $portalRoot '.local\e2e\preview-processes.json'
$expectedStateRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $portalRoot '.local\e2e'))
$resolvedStatePath = [System.IO.Path]::GetFullPath($statePath)
if (!$resolvedStatePath.StartsWith(
    $expectedStateRoot + [System.IO.Path]::DirectorySeparatorChar,
    [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to use preview state outside '$expectedStateRoot'."
}

if (Test-Path $statePath) {
    $state = Get-Content -Raw $statePath | ConvertFrom-Json
    $expectedCommands = @{
        Backend = 'GiftCardPlatform.Api.dll'
        Bff = 'GiftCardPortal.Bff.dll'
        Web = 'vite.js'
    }

    foreach ($name in $expectedCommands.Keys) {
        $processId = [int]$state.$name
        $process = Get-CimInstance Win32_Process `
            -Filter "ProcessId = $processId" `
            -ErrorAction SilentlyContinue
        if ($null -eq $process) {
            continue
        }

        if ($process.CommandLine -notlike "*$($expectedCommands[$name])*") {
            throw "PID $processId no longer belongs to the $name preview process."
        }

        Stop-Process -Id $processId -Force
    }
}

$environment = @{}
foreach ($line in Get-Content (Join-Path $backendRoot '.env')) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $environment[$Matches[1]] = $Matches[2].Trim()
    }
}

$administrator = $environment['POSTGRES_SUPERUSER']
$administratorPassword = $environment['POSTGRES_SUPERUSER_PASSWORD']
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$backendDatabase = 'giftcard_portal_e2e_backend'
$portalDatabase = 'giftcard_portal_e2e_sessions'
$backendApp = 'giftcard_portal_e2e_app'
$backendMigrator = 'giftcard_portal_e2e_migrator'
$portalApp = 'giftcard_portal_e2e_sessions_app'
foreach ($name in @(
    $backendDatabase,
    $portalDatabase,
    $backendApp,
    $backendMigrator,
    $portalApp
)) {
    if (!$name.StartsWith('giftcard_portal_e2e_', [StringComparison]::Ordinal)) {
        throw "Refusing to remove non-E2E PostgreSQL object '$name'."
    }
}

$cleanupSql = @"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN ('$backendDatabase', '$portalDatabase')
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $backendDatabase;
DROP DATABASE IF EXISTS $portalDatabase;
DROP ROLE IF EXISTS $backendApp;
DROP ROLE IF EXISTS $backendMigrator;
DROP ROLE IF EXISTS $portalApp;
"@
$previousPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $administratorPassword
    $cleanupSql | & $psql `
        --host localhost `
        --port 5432 `
        --username $administrator `
        --dbname postgres `
        --no-psqlrc `
        --set ON_ERROR_STOP=1 `
        --quiet
    if ($LASTEXITCODE -ne 0) {
        throw 'PostgreSQL preview cleanup failed.'
    }
}
finally {
    $env:PGPASSWORD = $previousPassword
}

if (Test-Path $resolvedStatePath) {
    Remove-Item -LiteralPath $resolvedStatePath -Force
}

Write-Output 'Portal preview processes and disposable PostgreSQL objects were removed.'
