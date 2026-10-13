# GEM Enterprise Market Entry — local, free-plan verification and preview
# From the repository root:
#   powershell -ExecutionPolicy Bypass -File .\ops\market-entry\Check.ps1 -Mode Check
#   powershell -ExecutionPolicy Bypass -File .\ops\market-entry\Check.ps1 -Mode Preview
#   powershell -ExecutionPolicy Bypass -File .\ops\market-entry\Check.ps1 -Mode Build
[CmdletBinding()]
param(
    [ValidateSet("Check", "Preview", "Build")]
    [string]$Mode = "Check",

    [switch]$InstallDependencies
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Invoke-Checked([string]$Description, [scriptblock]$Command) {
    Write-Host "==> $Description" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed (exit code $LASTEXITCODE)."
    }
}

Push-Location $repoRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is not installed. Use the repository-supported Node 24.x."
    }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw "pnpm is not available. Enable it with Corepack on a supported Node installation."
    }

    $version = (& node --version).Trim()
    if ($version -notmatch '^v24\.') {
        throw "This repository requires Node 24.x; detected $version. No changes were made."
    }

    if (-not (Test-Path "node_modules")) {
        if (-not $InstallDependencies) {
            throw "Dependencies are missing. Re-run with -InstallDependencies to run pnpm install --frozen-lockfile."
        }
        Invoke-Checked "Install project dependencies (no paid platform required)" {
            pnpm install --frozen-lockfile
        }
    }

    Invoke-Checked "Market entry and campaign attribution tests" {
        pnpm exec vitest run src/__tests__/market-entry-page.test.ts src/__tests__/gtm-activation-assets.test.ts
    }
    Invoke-Checked "TypeScript validation" {
        pnpm run typecheck
    }

    if ($Mode -eq "Build") {
        Invoke-Checked "Run the existing GEM production build process" {
            pnpm run build
        }
    }
    if ($Mode -eq "Preview") {
        Write-Host "Starting local GEM development preview. Open http://localhost:3000/market-entry" -ForegroundColor Green
        pnpm dev
    }
    if ($Mode -eq "Check") {
        Write-Host "GEM Market Entry verification passed. No publication or deployment was performed." -ForegroundColor Green
    }
}
finally {
    Pop-Location
}
