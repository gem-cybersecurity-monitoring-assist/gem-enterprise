#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$NodePath,

    [string]$InstallRoot = "C:\Program Files\GEM Laptop Backend",

    [string]$RuntimeRoot = "C:\ProgramData\GEM Continuity"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$server = Join-Path $InstallRoot "src\server.mjs"
$dashboard = Join-Path $InstallRoot "public\index.html"
$logRoot = Join-Path $RuntimeRoot "logs"
$stdout = Join-Path $logRoot "laptop-backend.stdout.log"
$stderr = Join-Path $logRoot "laptop-backend.stderr.log"

foreach ($required in @($NodePath, $server, $dashboard)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Required laptop backend file is missing: $required"
    }
}

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$env:GEM_LAPTOP_BIND = "127.0.0.1"
$env:GEM_LAPTOP_PORT = "8766"
$env:GEM_LAPTOP_ROOT = $RuntimeRoot
$env:GEM_LAPTOP_REQUEST_DIR = Join-Path $RuntimeRoot "requests"
$env:GEM_LAPTOP_STATUS_FILE = Join-Path $RuntimeRoot "status.json"
$env:GEM_LAPTOP_TOKEN_FILE = Join-Path $RuntimeRoot "auth-token.txt"
$env:GEM_LAPTOP_AUDIT_FILE = Join-Path $logRoot "laptop-backend-audit.jsonl"
$env:GEM_LAPTOP_DASHBOARD_FILE = $dashboard

Set-Location -LiteralPath $InstallRoot

try {
    & $NodePath $server 1>> $stdout 2>> $stderr

    if ($LASTEXITCODE -ne 0) {
        throw "GEM Laptop Backend exited with code $LASTEXITCODE."
    }
}
catch {
    Add-Content `
        -LiteralPath $stderr `
        -Encoding UTF8 `
        -Value "[$(Get-Date -Format o)] $($_.Exception.Message)"

    throw
}
