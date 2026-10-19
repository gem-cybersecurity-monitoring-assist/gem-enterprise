# GEM Enterprise Market Entry — local, free-plan verification and preview
# Run from any directory:
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
$lockPath = Join-Path $repoRoot ".gem-market-entry-check.lock"
$lockStream = $null

function Invoke-Checked([string]$Description, [scriptblock]$Command) {
    Write-Host "==> $Description" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed (exit code $LASTEXITCODE)."
    }
}

Push-Location $repoRoot
try {
    # Check, Build, and Preview share generated Next.js files. Serialize runs.
    try {
        $lockStream = [System.IO.File]::Open(
            $lockPath,
            [System.IO.FileMode]::OpenOrCreate,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
    }
    catch {
        throw "Another GEM market-entry verification, build, or preview is active for this checkout. Close it before retrying."
    }

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is not installed. Use the repository-supported Node 24.x."
    }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw "pnpm is not available. Enable it with Corepack on a supported Node installation."
    }

    $version = (& node --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v24\.') {
        throw "This repository requires Node 24.x; detected $version. No changes were made."
    }

    $pnpmVersion = (& pnpm --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $pnpmVersion -ne "10.28.0") {
        throw "This repository requires pnpm 10.28.0; detected $pnpmVersion. Enable the pinned version with Corepack."
    }

    if ($InstallDependencies) {
        Invoke-Checked "Install dependencies from the lockfile" {
            pnpm install --frozen-lockfile
        }
    }
    elseif (-not (Test-Path "node_modules")) {
        throw "Dependencies are missing. Re-run with -InstallDependencies to install from the frozen lockfile."
    }

    Invoke-Checked "Market-entry and campaign attribution tests" {
        pnpm exec vitest run src/__tests__/market-entry-page.test.ts src/__tests__/gtm-activation-assets.test.ts
    }
    Invoke-Checked "TypeScript validation" {
        pnpm run typecheck
    }
    Invoke-Checked "ESLint validation" {
        pnpm run lint
    }

    if ($Mode -eq "Build") {
        Invoke-Checked "Run the existing GEM production build process" {
            pnpm run build
        }
    }
    elseif ($Mode -eq "Preview") {
        Write-Host "Starting the local GEM preview. Open http://localhost:3000/market-entry" -ForegroundColor Green
        Invoke-Checked "Start local preview" {
            pnpm dev
        }
    }
    else {
        Write-Host "GEM Market Entry verification passed. No publication or deployment was performed." -ForegroundColor Green
    }
}
finally {
    if ($null -ne $lockStream) {
        $lockStream.Dispose()
        Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}
