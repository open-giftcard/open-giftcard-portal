[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$generatedRoot = Join-Path $repositoryRoot 'src\GiftCardPortal.Web\dist'
$committedRoot = Join-Path $repositoryRoot 'src\GiftCardPortal.Bff\wwwroot'

if (-not (Test-Path -LiteralPath $generatedRoot -PathType Container)) {
    throw "Generated frontend output is missing at '$generatedRoot'. Run pnpm run build first."
}

function Get-Manifest([string] $root) {
    $manifest = @{}
    $prefix = $root.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    foreach ($file in Get-ChildItem -LiteralPath $root -File -Recurse) {
        if (-not $file.FullName.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Bundle file '$($file.FullName)' escaped '$root'."
        }

        $relative = $file.FullName.Substring($prefix.Length).Replace('\', '/')
        $manifest[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    }

    return $manifest
}

$generated = Get-Manifest $generatedRoot
$committed = Get-Manifest $committedRoot
$differences = @()

foreach ($path in @($generated.Keys + $committed.Keys | Sort-Object -Unique)) {
    if (-not $generated.ContainsKey($path)) {
        $differences += "committed-only: $path"
    }
    elseif (-not $committed.ContainsKey($path)) {
        $differences += "generated-only: $path"
    }
    elseif ($generated[$path] -ne $committed[$path]) {
        $differences += "content-differs: $path"
    }
}

if ($differences.Count -gt 0) {
    throw "The committed SPA bundle differs from a clean build:`n$($differences -join "`n")"
}

Write-Host "Committed SPA bundle matches $($generated.Count) generated files."
