#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Version = "3.2.0-alpha.1"
$BackendTaskName = "GEM Laptop Backend v3.2.0"
$AgentTaskName = "GEM Laptop Session Agent v3.2.0"
$InstallRoot = "C:\Program Files\GEM Laptop Backend"
$RuntimeRoot = "C:\ProgramData\GEM Continuity"
$RequestRoot = Join-Path $RuntimeRoot "requests"
$LogRoot = Join-Path $RuntimeRoot "logs"
$TokenPath = Join-Path $RuntimeRoot "auth-token.txt"
$StatusPath = Join-Path $RuntimeRoot "status.json"
$HealthUrl = "http://127.0.0.1:8766/api/health"
$LocalDashboard = "http://127.0.0.1:8766"
$ExpectedMainPinokio = "C:\pinokio\api\gem-decart-live-studio"
$ExistingGemRoot = "C:\Program Files\GEM Call Studio"
$ExistingOrchestrator = Join-Path $ExistingGemRoot "scripts\GEM-All-Apps-Orchestrator.ps1"
$WindowsPowerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$SourceRoot = Split-Path $PSScriptRoot -Parent
$ReportPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "GEM-LAPTOP-BACKEND-ACCESS.txt"

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)

    return $principal.IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator
    )
}

function Write-Step {
    param([string]$Message)

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor DarkCyan
}

function New-AccessToken {
    $bytes = New-Object byte[] 48
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }

    return [Convert]::ToBase64String($bytes).
        TrimEnd("=").
        Replace("+", "-").
        Replace("/", "_")
}

function Get-TailscaleCli {
    return @(
        "C:\Program Files\Tailscale\tailscale.exe",
        "C:\Program Files (x86)\Tailscale\tailscale.exe",
        "$env:LOCALAPPDATA\Tailscale\tailscale.exe",
        "$env:LOCALAPPDATA\Programs\Tailscale\tailscale.exe"
    ) |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1
}

function Get-TailscaleIdentity {
    param([string]$Cli)

    try {
        $json = (& $Cli status --json 2>$null) -join "`n"
        $status = $json | ConvertFrom-Json
        $address = [string](
            @($status.Self.TailscaleIPs | Where-Object { $_ -match '^100\.' }) |
                Select-Object -First 1
        )
        $dnsName = ([string]$status.Self.DNSName).TrimEnd(".")

        return [ordered]@{
            address = $address
            dnsName = $dnsName
            state = [string]$status.BackendState
        }
    }
    catch {
        return [ordered]@{
            address = ""
            dnsName = ""
            state = "Unavailable"
        }
    }
}

if (-not (Test-Administrator)) {
    throw "Open Windows PowerShell with Run as administrator."
}

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$currentUser = $currentIdentity.Name
$currentSid = $currentIdentity.User.Value
$desktopUser = [string](Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).UserName

if ([string]::IsNullOrWhiteSpace($desktopUser)) {
    throw "No interactive Windows desktop user is signed in."
}

if ($desktopUser -ine $currentUser) {
    throw "Run this while signed in as $desktopUser, not $currentUser."
}

if ($currentUser -match '\\gemremote$') {
    throw "Do not install this as gemremote. Use the normal GEM ASSIST desktop."
}

Write-Step "1. Verifying guarded prerequisites"

foreach ($required in @(
    (Join-Path $SourceRoot "src\server.mjs"),
    (Join-Path $SourceRoot "public\index.html"),
    (Join-Path $SourceRoot "windows\run-backend.ps1"),
    (Join-Path $SourceRoot "windows\session-agent.ps1"),
    $WindowsPowerShell,
    $ExistingGemRoot,
    $ExistingOrchestrator,
    $ExpectedMainPinokio
)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required prerequisite is missing: $required"
    }
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $node) {
    throw "Node.js is missing. Install the approved Node runtime before continuing."
}

$nodeVersionText = (& $node.Source --version).Trim().TrimStart("v")
$nodeMajor = [int]($nodeVersionText.Split(".")[0])

if ($nodeMajor -lt 22) {
    throw "Node.js 22 or newer is required. Found $nodeVersionText."
}

$tailscaleService = Get-Service -Name "Tailscale" -ErrorAction SilentlyContinue
$tailscaleCli = Get-TailscaleCli

if (-not $tailscaleService -or -not $tailscaleCli) {
    throw "Tailscale must already be installed and authenticated on this laptop."
}

Set-Service -Name "Tailscale" -StartupType Automatic

if ($tailscaleService.Status -ne "Running") {
    Start-Service -Name "Tailscale"
    Start-Sleep -Seconds 4
}

$tailscaleIdentity = Get-TailscaleIdentity -Cli $tailscaleCli

if ($tailscaleIdentity.state -ne "Running" -or -not $tailscaleIdentity.address) {
    throw "Tailscale is installed but the laptop is not connected to the tailnet."
}

Write-Host "Node.js: $nodeVersionText" -ForegroundColor Green
Write-Host "Pinokio MAIN: $ExpectedMainPinokio" -ForegroundColor Green
Write-Host "Tailscale: $($tailscaleIdentity.address)" -ForegroundColor Green

Write-Step "2. Installing the isolated laptop backend"

New-Item -ItemType Directory -Path $InstallRoot, $RuntimeRoot, $RequestRoot, $LogRoot -Force | Out-Null

foreach ($directory in @("src", "public", "windows")) {
    $destination = Join-Path $InstallRoot $directory
    Remove-Item -LiteralPath $destination -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -LiteralPath (Join-Path $SourceRoot $directory) -Destination $destination -Recurse -Force
}

Copy-Item -LiteralPath (Join-Path $SourceRoot "package.json") -Destination (Join-Path $InstallRoot "package.json") -Force

if (-not (Test-Path -LiteralPath $TokenPath -PathType Leaf)) {
    [IO.File]::WriteAllText(
        $TokenPath,
        (New-AccessToken),
        (New-Object Text.UTF8Encoding($false))
    )
}

$accessToken = (Get-Content -LiteralPath $TokenPath -Raw).Trim()

if ($accessToken.Length -lt 32) {
    throw "The generated laptop access token is invalid."
}

$systemAce = "*S-1-5-18:(OI)(CI)F"
$administratorsAce = "*S-1-5-32-544:(OI)(CI)F"
$currentAce = "$currentSid`:(OI)(CI)F"

& "$env:SystemRoot\System32\icacls.exe" `
    $RuntimeRoot `
    /inheritance:r `
    /grant:r `
    $systemAce `
    $administratorsAce `
    $currentAce `
    /T `
    /C | Out-Null

& "$env:SystemRoot\System32\icacls.exe" `
    $InstallRoot `
    /inheritance:e `
    /grant:r `
    $systemAce `
    $administratorsAce `
    "$currentSid`:(OI)(CI)RX" `
    /T `
    /C | Out-Null

Write-Host "Installed to $InstallRoot" -ForegroundColor Green
Write-Host "Local secrets remain in $RuntimeRoot" -ForegroundColor Green

Write-Step "3. Registering the background backend and desktop agent"

foreach ($taskName in @($BackendTaskName, $AgentTaskName)) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}

$backendRunner = Join-Path $InstallRoot "windows\run-backend.ps1"
$agent = Join-Path $InstallRoot "windows\session-agent.ps1"

$backendArguments = (
    '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' +
    $backendRunner +
    '" -NodePath "' +
    $node.Source +
    '"'
)

$agentArguments = (
    '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' +
    $agent +
    '"'
)

$backendAction = New-ScheduledTaskAction -Execute $WindowsPowerShell -Argument $backendArguments
$agentAction = New-ScheduledTaskAction -Execute $WindowsPowerShell -Argument $agentArguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentSid
$principal = New-ScheduledTaskPrincipal -UserId $currentSid -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
    -TaskName $BackendTaskName `
    -Action $backendAction `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

Register-ScheduledTask `
    -TaskName $AgentTaskName `
    -Action $agentAction `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

Start-ScheduledTask -TaskName $BackendTaskName
Start-ScheduledTask -TaskName $AgentTaskName

Write-Host "Backend task registered." -ForegroundColor Green
Write-Host "Interactive desktop task registered." -ForegroundColor Green

Write-Step "4. Configuring continuity without exposing a public port"

& "$env:SystemRoot\System32\powercfg.exe" /change standby-timeout-ac 0 | Out-Null
& "$env:SystemRoot\System32\powercfg.exe" /change hibernate-timeout-ac 0 | Out-Null
& "$env:SystemRoot\System32\powercfg.exe" /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 | Out-Null
& "$env:SystemRoot\System32\powercfg.exe" /setactive SCHEME_CURRENT | Out-Null

$sshd = Get-Service -Name "sshd" -ErrorAction SilentlyContinue

if ($sshd) {
    Set-Service -Name "sshd" -StartupType Automatic
    if ($sshd.Status -ne "Running") {
        Start-Service -Name "sshd"
    }
}

$serveOutput = ""
$serveEnabled = $false

try {
    $serveOutput = (& $tailscaleCli serve --bg --yes $LocalDashboard 2>&1) -join "`r`n"
    $serveEnabled = ($LASTEXITCODE -eq 0)
}
catch {
    $serveOutput = $_.Exception.Message
}

Write-Host "AC sleep and hibernation disabled; lid-close on AC is Do nothing." -ForegroundColor Green
Write-Host "The backend remains bound to 127.0.0.1; Tailscale Serve is the private proxy." -ForegroundColor Green

Write-Step "5. Verifying the local backend and interactive agent"

$health = $null
$deadline = (Get-Date).AddSeconds(90)

while ((Get-Date) -lt $deadline) {
    try {
        $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 5
        if ($health.status -eq "ok" -and $health.authConfigured -eq $true) {
            break
        }
    }
    catch {}

    Start-Sleep -Seconds 2
}

if (-not $health -or $health.status -ne "ok" -or $health.authConfigured -ne $true) {
    $stderr = Join-Path $LogRoot "laptop-backend.stderr.log"
    if (Test-Path -LiteralPath $stderr) {
        Get-Content -LiteralPath $stderr -Tail 80
    }
    throw "The local laptop backend did not pass its health check."
}

$agentDeadline = (Get-Date).AddSeconds(90)

while ((Get-Date) -lt $agentDeadline) {
    if (Test-Path -LiteralPath $StatusPath -PathType Leaf) {
        try {
            $status = Get-Content -LiteralPath $StatusPath -Raw | ConvertFrom-Json
            if ([string]$status.agentUser -eq $currentUser -and [int]$status.startupGraceSeconds -eq 300) {
                break
            }
        }
        catch {}
    }

    Start-Sleep -Seconds 2
}

if (-not (Test-Path -LiteralPath $StatusPath -PathType Leaf)) {
    throw "The interactive desktop agent did not create status.json."
}

$status = Get-Content -LiteralPath $StatusPath -Raw | ConvertFrom-Json

if ([string]$status.agentUser -ne $currentUser) {
    throw "The desktop agent started under $($status.agentUser), not $currentUser."
}

if ([int]$status.startupGraceSeconds -ne 300) {
    throw "The running desktop agent does not report the required five-minute startup grace."
}

$privateUrl = if ($serveEnabled -and $tailscaleIdentity.dnsName) {
    "https://$($tailscaleIdentity.dnsName)"
}
else {
    "Tailscale Serve is not active. Local URL only: $LocalDashboard"
}

$report = @(
    "GEM LAPTOP BACKEND $Version INSTALLED",
    "Time: $(Get-Date -Format o)",
    "",
    "LOCAL DASHBOARD",
    $LocalDashboard,
    "",
    "PRIVATE PHONE URL",
    $privateUrl,
    "",
    "ACCESS TOKEN",
    $accessToken,
    "",
    "IMPORTANT",
    "Keep this token private. Do not commit it or send it in chat.",
    "The GEM ASSIST Windows account must remain signed in for OBS, Pinokio, cameras, and virtual-camera control.",
    "The laptop must remain powered and online unless a separate Wake-on-LAN relay is installed.",
    "",
    "TAILSCALE SERVE RESULT",
    $serveOutput,
    "",
    "INSTALLATION EVIDENCE",
    "Backend health: $($health.status)",
    "Agent user: $($status.agentUser)",
    "Startup grace: $($status.startupGraceSeconds) seconds",
    "Pinokio MAIN present: $($status.mainPinokioPresent)",
    "OBS Virtual Camera validated: False — manual release gate",
    "Transformed output validated: False — manual release gate"
) -join [Environment]::NewLine

[IO.File]::WriteAllText(
    $ReportPath,
    $report,
    (New-Object Text.UTF8Encoding($false))
)

& "$env:SystemRoot\System32\icacls.exe" `
    $ReportPath `
    /inheritance:r `
    /grant:r `
    "$currentSid`:F" `
    /C | Out-Null

Start-Process notepad.exe $ReportPath
Start-Process $LocalDashboard

Write-Host ""
Write-Host "GEM LAPTOP BACKEND INSTALLATION PASSED" -ForegroundColor Green
Write-Host "Local URL: $LocalDashboard" -ForegroundColor Green
Write-Host "Private URL: $privateUrl" -ForegroundColor Green
Write-Host "Access details opened in Notepad." -ForegroundColor Cyan
