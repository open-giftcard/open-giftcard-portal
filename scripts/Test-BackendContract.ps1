[CmdletBinding()]
param(
    [string]$BackendRepository = (Join-Path $PSScriptRoot '..\..\open-giftcard'),
    [uri]$BackendBaseUrl = 'http://localhost:5144'
)

$ErrorActionPreference = 'Stop'
$expectedBranch = 'main'
$expectedCommit = 'cfee9b1e17ab501e912d8aa8f84136d28e50dc6f'
$portalRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendRoot = (Resolve-Path $BackendRepository).Path

function ConvertTo-CanonicalJsonValue($Value) {
    if ($null -eq $Value) {
        return $null
    }

    if ($Value -is [PSCustomObject]) {
        $result = [ordered]@{}
        foreach ($property in $Value.PSObject.Properties | Sort-Object Name) {
            $result[$property.Name] = ConvertTo-CanonicalJsonValue $property.Value
        }
        return $result
    }

    if ($Value -is [Array]) {
        return @($Value | ForEach-Object { ConvertTo-CanonicalJsonValue $_ })
    }

    return $Value
}

$actualBranch = (& git -C $backendRoot branch --show-current).Trim()
$actualCommit = (& git -C $backendRoot rev-parse HEAD).Trim()
if ($actualBranch -ne $expectedBranch -or $actualCommit -ne $expectedCommit) {
    throw "Backend must be $expectedBranch at $expectedCommit. Found $actualBranch at $actualCommit."
}

$sourceChanges = & git -C $backendRoot status --short -- src
if ($sourceChanges) {
    throw "Backend source files are modified. Contract drift must be checked against the pinned source."
}

$snapshotPath = Join-Path $portalRoot 'contracts\backend.openapi.json'
$runningDocument = Invoke-WebRequest `
    -UseBasicParsing `
    -Uri ([uri]::new($BackendBaseUrl, '/swagger/v1/swagger.json')) `
    -TimeoutSec 20
$runningStream = New-Object System.IO.MemoryStream
$runningDocument.RawContentStream.Position = 0
$runningDocument.RawContentStream.CopyTo($runningStream)
$runningContent = [System.Text.Encoding]::UTF8.GetString($runningStream.ToArray())
$runningStream.Dispose()

$runningCanonical = ConvertTo-CanonicalJsonValue (
    $runningContent | ConvertFrom-Json) |
    ConvertTo-Json -Depth 100 -Compress
$snapshotCanonical = ConvertTo-CanonicalJsonValue (
    [System.IO.File]::ReadAllText(
        $snapshotPath,
        [System.Text.Encoding]::UTF8) | ConvertFrom-Json) |
    ConvertTo-Json -Depth 100 -Compress
$runningBytes = [System.Text.Encoding]::UTF8.GetBytes($runningCanonical)
$snapshotBytes = [System.Text.Encoding]::UTF8.GetBytes($snapshotCanonical)

$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
    $runningHash = [BitConverter]::ToString(
        $sha256.ComputeHash($runningBytes)).Replace('-', '')
    $snapshotHash = [BitConverter]::ToString(
        $sha256.ComputeHash($snapshotBytes)).Replace('-', '')
}
finally {
    $sha256.Dispose()
}

if ($runningHash -ne $snapshotHash) {
    $diagnosticPath = Join-Path $portalRoot '.local\contract-drift.openapi.json'
    New-Item -ItemType Directory -Force -Path (Split-Path $diagnosticPath) | Out-Null
    Set-Content -Path $diagnosticPath -Value $runningContent -NoNewline -Encoding UTF8
    throw "Backend contract drift detected. Snapshot: $snapshotHash; running: $runningHash."
}

Write-Output "Backend contract matches $expectedCommit ($snapshotHash)."
