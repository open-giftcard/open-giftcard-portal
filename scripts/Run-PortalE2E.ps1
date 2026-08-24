[CmdletBinding()]
param(
    [string]$BackendRepository,
    [string]$BackendEnvironmentFile,
    [switch]$KeepDatabases,
    [switch]$LeaveRunning
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($BackendRepository)) {
    $BackendRepository = Join-Path $PSScriptRoot '..\..\open-giftcard'
}
$backendDatabase = 'giftcard_portal_e2e_backend'
$backendMigrator = 'giftcard_portal_e2e_migrator'
$backendApp = 'giftcard_portal_e2e_app'
$portalDatabase = 'giftcard_portal_e2e_sessions'
$portalMigrator = 'giftcard_portal_e2e_sessions_migrator'
$portalApp = 'giftcard_portal_e2e_sessions_app'
$backendPort = 5144
$bffPort = 5179
$webPort = 5183

$portalRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releaseContract = Get-Content -Raw -LiteralPath (
    Join-Path $portalRoot 'RELEASE_COMPATIBILITY.json') | ConvertFrom-Json
$expectedCommit = [string]$releaseContract.backendContract.commit
$backendRoot = (Resolve-Path $BackendRepository).Path
if ([string]::IsNullOrWhiteSpace($BackendEnvironmentFile)) {
    $BackendEnvironmentFile = Join-Path $backendRoot '.env'
}
$webRoot = Join-Path $portalRoot 'src\GiftCardPortal.Web'
# Tool locations. Override with environment variables when they are not on
# PATH or not in the default install location.
$psql = if ($env:PSQL_PATH) { $env:PSQL_PATH }
    elseif (Get-Command psql -ErrorAction SilentlyContinue) { (Get-Command psql).Source }
    else { 'C:\Program Files\PostgreSQL\18\bin\psql.exe' }
$ef = Join-Path $portalRoot '.local\tools\dotnet-ef.exe'
$nodeBin = if ($env:NODE_BIN) { $env:NODE_BIN }
    elseif (Get-Command node -ErrorAction SilentlyContinue) { Split-Path (Get-Command node).Source }
    else { 'C:\Program Files\nodejs' }
$pnpmBin = if ($env:PNPM_BIN) { $env:PNPM_BIN }
    elseif (Get-Command pnpm -ErrorAction SilentlyContinue) { Split-Path (Get-Command pnpm).Source }
    else { $nodeBin }
$node = Join-Path $nodeBin 'node.exe'
$vite = Join-Path $webRoot 'node_modules\vite\bin\vite.js'
$playwright = Join-Path $webRoot 'node_modules\@playwright\test\cli.js'
$logRoot = Join-Path $portalRoot '.local\e2e\logs'
$backendArtifacts = Join-Path $portalRoot '.local\e2e\backend-artifacts'
$backendProject = Join-Path $backendRoot 'src\GiftCardPlatform.Api\GiftCardPlatform.Api.csproj'
$backendAssembly = Join-Path $backendArtifacts 'bin\GiftCardPlatform.Api\debug\GiftCardPlatform.Api.dll'
$bffRoot = Join-Path $portalRoot 'src\GiftCardPortal.Bff'
$bffAssembly = Join-Path $bffRoot 'bin\Debug\net10.0\GiftCardPortal.Bff.dll'

function Assert-DisposableName([string]$Value) {
    if (!$Value.StartsWith('giftcard_portal_e2e_', [StringComparison]::Ordinal)) {
        throw "Refusing to mutate non-E2E PostgreSQL object '$Value'."
    }
}

function Assert-LocalPortAvailable([int]$Port) {
    $listener = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback,
        $Port
    )
    try {
        $listener.Start()
    }
    catch {
        throw "Local E2E port $Port is already in use. Stop the existing listener or choose another isolated port before running this script."
    }
    finally {
        $listener.Stop()
    }
}

function Read-DotEnv([string]$Path) {
    $values = @{}
    foreach ($line in Get-Content $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $values[$Matches[1]] = $Matches[2].Trim()
        }
    }
    return $values
}

function Invoke-Psql(
    [string]$Database,
    [string]$User,
    [string]$Password,
    [string]$Sql
) {
    $previousPassword = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $Password
        $Sql | & $psql `
            --host localhost `
            --port 5432 `
            --username $User `
            --dbname $Database `
            --no-psqlrc `
            --set ON_ERROR_STOP=1 `
            --quiet
        if ($LASTEXITCODE -ne 0) {
            throw "PostgreSQL command failed for database '$Database'."
        }
    }
    finally {
        $env:PGPASSWORD = $previousPassword
    }
}

function Wait-Http([uri]$Uri, [System.Diagnostics.Process]$Process) {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(60)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        if ($Process.HasExited) {
            throw "Process $($Process.Id) exited before $Uri became ready."
        }

        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }

    throw "Timed out waiting for $Uri."
}

function Stop-OwnedProcess([System.Diagnostics.Process]$Process) {
    if ($null -ne $Process -and !$Process.HasExited) {
        Stop-Process -Id $Process.Id -Force
        $Process.WaitForExit(10000) | Out-Null
    }
}

foreach ($name in @(
    $backendDatabase,
    $backendMigrator,
    $backendApp,
    $portalDatabase,
    $portalMigrator,
    $portalApp
)) {
    Assert-DisposableName $name
}
foreach ($port in @($backendPort, $bffPort, $webPort)) {
    Assert-LocalPortAvailable $port
}

if (!(Test-Path $psql)) {
    throw "PostgreSQL 18 psql was not found at '$psql'."
}
if (!(Test-Path $ef)) {
    throw "Install the pinned local EF tool: dotnet tool install dotnet-ef --tool-path .local\tools --version 10.0.10"
}
if (!(Test-Path $playwright)) {
    throw "Install frontend dependencies and Playwright browsers before running E2E."
}
if (!(Test-Path $vite)) {
    throw "Install frontend dependencies before running E2E."
}

$actualCommit = (& git -C $backendRoot rev-parse HEAD).Trim()
if ($actualCommit -ne $expectedCommit) {
    throw "Backend must be at accepted commit $expectedCommit. Found $actualCommit."
}

$sourceChanges = & git -C $backendRoot status --short -- src
if ($sourceChanges) {
    throw "Backend source files are modified; refusing to run against an unpinned implementation."
}

$backendEnvironment = Read-DotEnv $BackendEnvironmentFile
$administrator = $backendEnvironment['POSTGRES_SUPERUSER']
$administratorPassword = $backendEnvironment['POSTGRES_SUPERUSER_PASSWORD']
if ([string]::IsNullOrWhiteSpace($administrator) -or
    [string]::IsNullOrWhiteSpace($administratorPassword)) {
    throw "The backend .env must provide POSTGRES_SUPERUSER and POSTGRES_SUPERUSER_PASSWORD."
}

$backendPassword = [Guid]::NewGuid().ToString('N')
$migratorPassword = [Guid]::NewGuid().ToString('N')
$portalPassword = [Guid]::NewGuid().ToString('N')
$portalMigratorPassword = [Guid]::NewGuid().ToString('N')
$jwtKey = "{0}{1}" -f [Guid]::NewGuid().ToString('N'), [Guid]::NewGuid().ToString('N')
$bootstrapSecret = "{0}{1}" -f [Guid]::NewGuid().ToString('N'), [Guid]::NewGuid().ToString('N')
$platformEmail = 'portal.platform.e2e@example.test'
$platformPassword = 'Portal-Platform-E2E-only-2026!'
$organizationEmail = 'portal.organization.e2e@example.test'
$organizationPassword = 'Portal-Organization-E2E-only-2026!'
$shareSenderEmail = 'portal.share.sender.e2e@example.test'
$shareSenderPassword = 'Portal-Share-Sender-E2E-only-2026!'

$backendProcess = $null
$bffProcess = $null
$webProcess = $null
$previousPath = $env:Path
$previousArtifactsPath = $env:ArtifactsPath
$completed = $false

New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

try {
    $dropSql = @"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN ('$backendDatabase', '$portalDatabase')
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $backendDatabase;
DROP DATABASE IF EXISTS $portalDatabase;
DROP ROLE IF EXISTS $backendApp;
DROP ROLE IF EXISTS $backendMigrator;
DROP ROLE IF EXISTS $portalApp;
DROP ROLE IF EXISTS $portalMigrator;
"@
    Invoke-Psql 'postgres' $administrator $administratorPassword $dropSql

    $createSql = @"
CREATE ROLE $backendMigrator LOGIN PASSWORD '$migratorPassword'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE $backendApp LOGIN PASSWORD '$backendPassword'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE $portalApp LOGIN PASSWORD '$portalPassword'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE $portalMigrator LOGIN PASSWORD '$portalMigratorPassword'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE DATABASE $backendDatabase OWNER $backendMigrator;
CREATE DATABASE $portalDatabase OWNER $portalMigrator;
"@
    Invoke-Psql 'postgres' $administrator $administratorPassword $createSql

    $databaseSql = @"
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE SCHEMA organizations AUTHORIZATION $backendMigrator;
CREATE SCHEMA audit AUTHORIZATION $backendMigrator;
CREATE SCHEMA identity AUTHORIZATION $backendMigrator;
CREATE SCHEMA "authorization" AUTHORIZATION $backendMigrator;
CREATE SCHEMA ledger AUTHORIZATION $backendMigrator;
CREATE SCHEMA corporate_credits AUTHORIZATION $backendMigrator;
CREATE SCHEMA gift_cards AUTHORIZATION $backendMigrator;
CREATE SCHEMA distribution AUTHORIZATION $backendMigrator;
CREATE SCHEMA sharing AUTHORIZATION $backendMigrator;
CREATE SCHEMA payments AUTHORIZATION $backendMigrator;
GRANT CONNECT ON DATABASE $backendDatabase TO $backendMigrator, $backendApp;
GRANT USAGE ON SCHEMA organizations, audit, identity, "authorization",
    ledger, corporate_credits, gift_cards, distribution, sharing, payments TO $backendApp;
REVOKE CREATE ON SCHEMA organizations, audit, identity, "authorization",
    ledger, corporate_credits, gift_cards, distribution, sharing, payments FROM $backendApp;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE $backendMigrator IN SCHEMA organizations
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $backendApp;
ALTER DEFAULT PRIVILEGES FOR ROLE $backendMigrator IN SCHEMA "authorization"
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $backendApp;
ALTER DEFAULT PRIVILEGES FOR ROLE $backendMigrator IN SCHEMA identity
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $backendApp;
ALTER DEFAULT PRIVILEGES FOR ROLE $backendMigrator IN SCHEMA audit
    GRANT SELECT, INSERT ON TABLES TO $backendApp;
ALTER DEFAULT PRIVILEGES FOR ROLE $backendMigrator IN SCHEMA ledger
    GRANT SELECT, INSERT ON TABLES TO $backendApp;
ALTER DEFAULT PRIVILEGES FOR ROLE $backendMigrator IN SCHEMA corporate_credits
    GRANT SELECT, INSERT ON TABLES TO $backendApp;
ALTER DEFAULT PRIVILEGES FOR ROLE $backendMigrator IN SCHEMA gift_cards
    GRANT SELECT, INSERT, UPDATE ON TABLES TO $backendApp;
ALTER DEFAULT PRIVILEGES FOR ROLE $backendMigrator IN SCHEMA distribution
    GRANT SELECT, INSERT, UPDATE ON TABLES TO $backendApp;
ALTER DEFAULT PRIVILEGES FOR ROLE $backendMigrator IN SCHEMA sharing
    GRANT SELECT, INSERT, UPDATE ON TABLES TO $backendApp;
ALTER DEFAULT PRIVILEGES FOR ROLE $backendMigrator IN SCHEMA payments
    GRANT SELECT, INSERT, UPDATE ON TABLES TO $backendApp;
"@
    Invoke-Psql $backendDatabase $administrator $administratorPassword $databaseSql

    & dotnet build `
        (Join-Path $portalRoot 'GiftCardPortal.slnx') `
        --configuration Debug `
        --no-restore
    if ($LASTEXITCODE -ne 0) {
        throw 'Portal build failed.'
    }

    & dotnet restore `
        $backendProject `
        --artifacts-path $backendArtifacts
    if ($LASTEXITCODE -ne 0) {
        throw 'Pinned backend restore failed.'
    }
    & dotnet build `
        $backendProject `
        --configuration Debug `
        --no-restore `
        --artifacts-path $backendArtifacts
    if ($LASTEXITCODE -ne 0) {
        throw 'Pinned backend build failed.'
    }

    $env:ArtifactsPath = $backendArtifacts
    $env:GIFTCARD_MIGRATIONS_CONNECTION =
        "Host=localhost;Port=5432;Database=$backendDatabase;Username=$backendMigrator;Password=$migratorPassword"
    $migrationContexts = @(
        @('GiftCardPlatform.Modules.Organizations', 'OrganizationsDbContext'),
        @('GiftCardPlatform.Modules.Audit', 'AuditDbContext'),
        @('GiftCardPlatform.Modules.Authorization', 'AuthorizationDbContext'),
        @('GiftCardPlatform.Modules.Identity', 'IdentityDbContext'),
        @('GiftCardPlatform.Modules.Ledger', 'LedgerDbContext'),
        @('GiftCardPlatform.Modules.CorporateCredits', 'CorporateCreditsDbContext'),
        @('GiftCardPlatform.Modules.GiftCards', 'GiftCardsDbContext'),
        @('GiftCardPlatform.Modules.Distribution', 'DistributionDbContext'),
        @('GiftCardPlatform.Modules.Sharing', 'SharingDbContext'),
        @('GiftCardPlatform.Modules.Payments', 'PaymentsDbContext')
    )
    foreach ($migration in $migrationContexts) {
        & $ef database update `
            --project (Join-Path $backendRoot "src\$($migration[0])") `
            --startup-project (Join-Path $backendRoot 'src\GiftCardPlatform.Api') `
            --context $migration[1] `
            --no-build
        if ($LASTEXITCODE -ne 0) {
            throw "Migration failed for $($migration[1])."
        }
    }

    $env:ConnectionStrings__Default =
        "Host=localhost;Port=5432;Database=$backendDatabase;Username=$backendApp;Password=$backendPassword"
    $env:Authentication__Jwt__SigningKey = $jwtKey
    $env:Authentication__LoginRateLimit__PermitLimit = '20'
    $env:Networking__ForwardedHeaders__KnownProxies__0 = '127.0.0.1'
    $env:Bootstrap__PlatformAdministrator__Secret = $bootstrapSecret
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = "http://127.0.0.1:$backendPort"
    $backendProcess = Start-Process `
        -FilePath 'dotnet' `
        -ArgumentList @($backendAssembly) `
        -WorkingDirectory (Split-Path $backendProject) `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput (Join-Path $logRoot 'backend.out.log') `
        -RedirectStandardError (Join-Path $logRoot 'backend.err.log')
    Wait-Http "http://127.0.0.1:$backendPort/health/ready" $backendProcess

    & (Join-Path $portalRoot 'scripts\Test-BackendContract.ps1') `
        -BackendRepository $backendRoot `
        -BackendBaseUrl "http://127.0.0.1:$backendPort"

    Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/bootstrap/platform-administrator" `
        -Headers @{ 'X-Platform-Bootstrap-Secret' = $bootstrapSecret } `
        -ContentType 'application/json' `
        -Body (@{
            email = $platformEmail
            password = $platformPassword
        } | ConvertTo-Json) | Out-Null
    $login = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/auth/login" `
        -ContentType 'application/json' `
        -Body (@{ email = $platformEmail; password = $platformPassword } | ConvertTo-Json)
    $authorization = @{ Authorization = "Bearer $($login.accessToken)" }
    $organization = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/organizations" `
        -Headers $authorization `
        -ContentType 'application/json' `
        -Body (@{ name = 'Portal E2E'; code = 'PORTAL-E2E' } | ConvertTo-Json)
    foreach ($sequence in 1..12) {
        Invoke-RestMethod `
            -Method Post `
            -Uri "http://127.0.0.1:$backendPort/api/v1/corporate-credits/allocations" `
            -Headers $authorization `
            -ContentType 'application/json' `
            -Body (@{
                organizationId = $organization.id
                amount = 100
                currency = 'TRY'
                businessReference = 'PORTAL-E2E-FUND-{0:d3}' -f $sequence
                idempotencyKey = 'portal-e2e-allocation-{0:d3}' -f $sequence
            } | ConvertTo-Json) | Out-Null
    }
    Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/organizations" `
        -Headers $authorization `
        -ContentType 'application/json' `
        -Body (@{
            name = 'Portal Filtered Customer'
            code = 'PORTAL-FILTER'
        } | ConvertTo-Json) | Out-Null
    $organizationUser = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/users" `
        -Headers $authorization `
        -ContentType 'application/json' `
        -Body (@{
            email = $organizationEmail
            password = $organizationPassword
        } | ConvertTo-Json)
    foreach ($browserName in @('firefox', 'chromium', 'mobile-chromium')) {
        Invoke-RestMethod `
            -Method Post `
            -Uri "http://127.0.0.1:$backendPort/api/v1/users" `
            -Headers $authorization `
            -ContentType 'application/json' `
            -Body (@{
                email = "portal.team.$browserName@example.test"
                password = "Portal-Team-$browserName-E2E-only-2026!"
            } | ConvertTo-Json) | Out-Null
    }
    Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/organizations/$($organization.id)/initial-administrator" `
        -Headers $authorization `
        -ContentType 'application/json' `
        -Body (@{ userId = $organizationUser.id } | ConvertTo-Json) | Out-Null
    $organizationLogin = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/auth/login" `
        -ContentType 'application/json' `
        -Body (@{
            email = $organizationEmail
            password = $organizationPassword
        } | ConvertTo-Json)
    $organizationAuthorization = @{
        Authorization = "Bearer $($organizationLogin.accessToken)"
        'X-Organization-Id' = $organization.id
    }
    foreach ($sequence in 1..21) {
        Invoke-RestMethod `
            -Method Post `
            -Uri "http://127.0.0.1:$backendPort/api/v1/organizations/$($organization.id)/subsidiaries" `
            -Headers $organizationAuthorization `
            -ContentType 'application/json' `
            -Body (@{
                name = 'Portal Branch {0:d3}' -f $sequence
                code = 'PORTAL-BR-{0:d3}' -f $sequence
            } | ConvertTo-Json) | Out-Null
    }

    # Seed one claimed card and one pending share so staff reconciliation is
    # exercised over real Phase 3 sharing data. Without this the sharing counts
    # would render a constant zero, which cannot distinguish a clean check from
    # one that never ran. Sharing is a cardholder action and the portal has no
    # share commands by design, so the seed uses the backend API directly.
    $shareCardExpiry = [DateTimeOffset]::UtcNow.AddYears(1).ToString('O')
    $shareBatch = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/organizations/$($organization.id)/gift-card-batches/" `
        -Headers $organizationAuthorization `
        -ContentType 'application/json' `
        -Body (@{
            batchReference = 'PORTAL-E2E-SHARE-SEED'
            idempotencyKey = 'portal-e2e-share-seed-v1'
            items = @(
                @{
                    itemReference = 'SHARE-SENDER'
                    amount = 100
                    currency = 'TRY'
                    validFromUtc = $null
                    expiresAtUtc = $shareCardExpiry
                    isTransferable = $true
                    isDivisible = $true
                    contactType = 'Email'
                    recipientContact = $shareSenderEmail
                }
            )
        } | ConvertTo-Json -Depth 8)
    $shareSeedItem = $shareBatch.items |
        Where-Object itemReference -eq 'SHARE-SENDER'
    if ($null -eq $shareSeedItem -or
        [string]::IsNullOrWhiteSpace([string]$shareSeedItem.invitationId)) {
        throw "The share seed batch returned no usable item: $($shareBatch | ConvertTo-Json -Depth 6 -Compress)"
    }
    $shareSeedDelivery = Invoke-RestMethod `
        -Method Get `
        -Uri "http://127.0.0.1:$backendPort/api/v1/development/organizations/$($organization.id)/claim-deliveries/$($shareSeedItem.invitationId)" `
        -Headers $organizationAuthorization
    $shareSeedTokenMatch = [regex]::Match(
        [string]$shareSeedDelivery.claimUrl,
        '[?&]token=([^&]+)')
    if (!$shareSeedTokenMatch.Success) {
        throw "The seeded activation delivery carried no claim token: $($shareSeedDelivery | ConvertTo-Json -Depth 6 -Compress)"
    }
    $shareSeedToken = [Uri]::UnescapeDataString(
        $shareSeedTokenMatch.Groups[1].Value)
    $shareSeedClaim = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/gift-card-claims" `
        -ContentType 'application/json' `
        -Body (@{
            claimToken = $shareSeedToken
            password = $shareSenderPassword
            idempotencyKey = 'portal-e2e-share-seed-claim-v1'
        } | ConvertTo-Json)
    $shareSenderLogin = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/auth/login" `
        -ContentType 'application/json' `
        -Body (@{
            email = $shareSenderEmail
            password = $shareSenderPassword
        } | ConvertTo-Json)
    Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/me/gift-cards/$($shareSeedClaim.giftCard.id)/shares" `
        -Headers @{ Authorization = "Bearer $($shareSenderLogin.accessToken)" } `
        -ContentType 'application/json' `
        -Body (@{
            amount = 20
            idempotencyKey = 'portal-e2e-share-seed-share-v1'
        } | ConvertTo-Json) | Out-Null

    # Seed one confirmed payment and one partial refund through the public API.
    # The portal remains read-only; this gives every browser a stable, real
    # receipt to search and inspect without writing directly to Payments.
    $posClient = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/pos/clients" `
        -Headers $authorization `
        -ContentType 'application/json' `
        -Body (@{
            code = 'PORTAL-E2E-POS'
            displayName = 'Portal E2E checkout'
        } | ConvertTo-Json)
    $posTerminal = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/pos/clients/$($posClient.id)/terminals" `
        -Headers $authorization `
        -ContentType 'application/json' `
        -Body (@{
            code = 'PORTAL-E2E-TILL'
            storeReference = 'PORTAL-E2E-STORE'
        } | ConvertTo-Json)
    $posLogin = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/pos/auth/token" `
        -ContentType 'application/json' `
        -Body (@{
            clientCode = $posClient.code
            clientSecret = $posClient.secret
            terminalCode = $posTerminal.code
        } | ConvertTo-Json)
    $posAuthorization = @{ Authorization = "Bearer $($posLogin.accessToken)" }
    $paymentCredential = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/me/gift-cards/$($shareSeedClaim.giftCard.id)/payment-tokens" `
        -Headers @{ Authorization = "Bearer $($shareSenderLogin.accessToken)" }
    $paymentProvision = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/pos/payment-provisions" `
        -Headers $posAuthorization `
        -ContentType 'application/json' `
        -Body (@{
            paymentToken = $null
            paymentCode = $paymentCredential.numericCode
            amount = 30
            posTransactionReference = 'PORTAL-E2E-RECEIPT'
        } | ConvertTo-Json)
    Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/pos/payment-provisions/$($paymentProvision.id)/confirm" `
        -Headers $posAuthorization `
        -ContentType 'application/json' `
        -Body (@{ amount = 30 } | ConvertTo-Json) | Out-Null
    Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$backendPort/api/v1/pos/payment-provisions/$($paymentProvision.id)/refunds" `
        -Headers $posAuthorization `
        -ContentType 'application/json' `
        -Body (@{
            amount = 12
            idempotencyKey = 'portal-e2e-payment-refund-v1'
            posTransactionReference = 'PORTAL-E2E-RETURN'
            reason = 'Portal reporting verification'
        } | ConvertTo-Json) | Out-Null

    $env:ConnectionStrings__Portal =
        "Host=localhost;Port=5432;Database=$portalDatabase;Username=$portalApp;Password=$portalPassword"
    $env:ConnectionStrings__PortalMigrations =
        "Host=localhost;Port=5432;Database=$portalDatabase;Username=$portalMigrator;Password=$portalMigratorPassword"
    & dotnet $bffAssembly --migrate
    if ($LASTEXITCODE -ne 0) {
        throw 'Portal session database migration failed.'
    }
    $env:Backend__BaseUrl = "http://127.0.0.1:$backendPort"
    $env:ASPNETCORE_URLS = "http://127.0.0.1:$bffPort"
    $bffProcess = Start-Process `
        -FilePath 'dotnet' `
        -ArgumentList @($bffAssembly) `
        -WorkingDirectory $bffRoot `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput (Join-Path $logRoot 'bff.out.log') `
        -RedirectStandardError (Join-Path $logRoot 'bff.err.log')
    Wait-Http "http://127.0.0.1:$bffPort/health" $bffProcess

    $env:Path = "$nodeBin;$pnpmBin;$previousPath"
    $webProcess = Start-Process `
        -FilePath $node `
        -ArgumentList @(
            $vite,
            '--host',
            '127.0.0.1',
            '--port',
            $webPort,
            '--strictPort'
        ) `
        -WorkingDirectory $webRoot `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput (Join-Path $logRoot 'web.out.log') `
        -RedirectStandardError (Join-Path $logRoot 'web.err.log')
    Wait-Http "http://127.0.0.1:$webPort" $webProcess

    $env:PORTAL_BASE_URL = "http://127.0.0.1:$webPort"
    $env:PORTAL_E2E_PLATFORM_EMAIL = $platformEmail
    $env:PORTAL_E2E_PLATFORM_PASSWORD = $platformPassword
    $env:PORTAL_E2E_ORGANIZATION_EMAIL = $organizationEmail
    $env:PORTAL_E2E_ORGANIZATION_PASSWORD = $organizationPassword
    & $node $playwright test --config (Join-Path $webRoot 'playwright.config.ts')
    if ($LASTEXITCODE -ne 0) {
        throw 'Playwright E2E tests failed.'
    }

    Write-Output 'Portal platform, POS reporting, and organization E2E passed in Firefox, Chromium, and mobile Chromium.'
    $completed = $true
    if ($LeaveRunning) {
        @{
            Backend = $backendProcess.Id
            Bff = $bffProcess.Id
            Web = $webProcess.Id
        } |
            ConvertTo-Json |
            Set-Content (Join-Path $portalRoot '.local\e2e\preview-processes.json')
        Write-Output "Preview is ready at http://127.0.0.1:$webPort"
    }
}
finally {
    $leavePreviewRunning = $LeaveRunning -and $completed
    if (!$leavePreviewRunning) {
        Stop-OwnedProcess $webProcess
        Stop-OwnedProcess $bffProcess
        Stop-OwnedProcess $backendProcess
    }
    $env:Path = $previousPath
    $env:ArtifactsPath = $previousArtifactsPath

    if (!$leavePreviewRunning -and !$KeepDatabases -and
        ![string]::IsNullOrWhiteSpace($administrator) -and
        ![string]::IsNullOrWhiteSpace($administratorPassword)) {
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
DROP ROLE IF EXISTS $portalMigrator;
"@
        Invoke-Psql 'postgres' $administrator $administratorPassword $cleanupSql
    }
}
