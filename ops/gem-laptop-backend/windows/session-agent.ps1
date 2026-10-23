#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ContinuityVersion = "3.2.0-alpha.1"
$CoreVersion = "2.3.1"
$InstallRoot = Join-Path $env:ProgramFiles "GEM Call Studio"
$ScriptsRoot = Join-Path $InstallRoot "scripts"
$Orchestrator = Join-Path $ScriptsRoot "GEM-All-Apps-Orchestrator.ps1"
$StopScript = Join-Path $ScriptsRoot "Stop-GEM-All-Apps.ps1"
$Diagnostics = Join-Path $ScriptsRoot "GEM-Diagnostics.ps1"
$Runtime = Join-Path $env:LOCALAPPDATA "GEM-Enterprise\Call-Studio"
$OrchestratorStatePath = Join-Path $Runtime "all-apps-v2.3.1-state.json"
$MainPinokioPath = "C:\pinokio\api\gem-decart-live-studio"
$HealthUrl = "http://127.0.0.1:8765/api/health"
$DashboardUrl = "http://127.0.0.1:8766"
$Base44ControlCenter = "https://gem-studio-control-center-copy-ac4835bd.base44.app"
$Base44AdditionalStudio = "https://astonishing-gem-studio-link.base44.app"

$Root = Join-Path $env:ProgramData "GEM Continuity"
$Requests = Join-Path $Root "requests"
$Logs = Join-Path $Root "logs"
$StatusPath = Join-Path $Root "status.json"
$SessionFlag = Join-Path $Root "session-enabled.flag"
$AgentLog = Join-Path $Logs "session-agent-v3.2.0.log"
$Base44Payload = Join-Path $Root "base44-device-registration.json"

$AllowedActions = @(
    "start",
    "stop",
    "restart",
    "open",
    "base44",
    "doctor",
    "sleep"
)

$StartupGraceSeconds = 300
$RecoveryWindowMinutes = 30
$MaximumRecoveryAttempts = 3

New-Item -ItemType Directory -Path $Requests, $Logs -Force | Out-Null

function Write-AgentLog {
    param(
        [Parameter(Mandatory)]
        [string]$Message,

        [ValidateSet("INFO", "WARN", "ERROR", "READY")]
        [string]$Level = "INFO"
    )

    Add-Content `
        -LiteralPath $AgentLog `
        -Encoding UTF8 `
        -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$Level] $Message"
}

function Get-GemHealth {
    try {
        return Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 4
    }
    catch {
        return $null
    }
}

function Get-OrchestratorState {
    if (-not (Test-Path -LiteralPath $OrchestratorStatePath -PathType Leaf)) {
        return $null
    }

    try {
        return Get-Content -LiteralPath $OrchestratorStatePath -Raw |
            ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Get-TailscaleState {
    $cli = @(
        "C:\Program Files\Tailscale\tailscale.exe",
        "C:\Program Files (x86)\Tailscale\tailscale.exe",
        "$env:LOCALAPPDATA\Tailscale\tailscale.exe",
        "$env:LOCALAPPDATA\Programs\Tailscale\tailscale.exe"
    ) |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1

    if (-not $cli) {
        return [ordered]@{
            address = ""
            dnsName = ""
            state = "Missing"
        }
    }

    try {
        $json = (& $cli status --json 2>$null) -join "`n"
        $status = $json | ConvertFrom-Json
        $address = [string](
            @($status.Self.TailscaleIPs | Where-Object { $_ -match '^100\.' }) |
                Select-Object -First 1
        )

        return [ordered]@{
            address = $address
            dnsName = ([string]$status.Self.DNSName).TrimEnd(".")
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

function Test-GemPipelineReady {
    $health = Get-GemHealth
    $obs = [bool](Get-Process -Name "obs64" -ErrorAction SilentlyContinue)
    $obsWebSocket = [bool](
        Get-NetTCPConnection `
            -LocalPort 4455 `
            -State Listen `
            -ErrorAction SilentlyContinue
    )

    return [bool](
        $health -and
        $health.status -eq "ok" -and
        [string]$health.version -eq $CoreVersion -and
        $health.keyConfigured -eq $true -and
        $obs -and
        $obsWebSocket
    )
}

function Save-Status {
    param([string]$LastAction = "")

    $health = Get-GemHealth
    $orchestrator = Get-OrchestratorState
    $tailscale = Get-TailscaleState
    $sshd = Get-Service -Name "sshd" -ErrorAction SilentlyContinue
    $obs = [bool](Get-Process -Name "obs64" -ErrorAction SilentlyContinue)
    $pinokio = [bool](
        Get-Process -ErrorAction SilentlyContinue |
            Where-Object { $_.ProcessName -match "pinokio" } |
            Select-Object -First 1
    )

    $snapshot = [ordered]@{
        continuityVersion = $ContinuityVersion
        coreVersion = $CoreVersion
        agentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        mainPinokioPath = $MainPinokioPath
        mainPinokioPresent = Test-Path -LiteralPath $MainPinokioPath -PathType Container
        backendHealthy = [bool](
            $health -and
            $health.status -eq "ok" -and
            [string]$health.version -eq $CoreVersion -and
            $health.keyConfigured -eq $true
        )
        pipelineReady = Test-GemPipelineReady
        health = $health
        orchestrator = $orchestrator
        obsRunning = $obs
        obsWebSocket = [bool](
            Get-NetTCPConnection `
                -LocalPort 4455 `
                -State Listen `
                -ErrorAction SilentlyContinue
        )
        pinokioRunning = $pinokio
        tailscale = $tailscale
        openSsh = [ordered]@{
            status = $(if ($sshd) { [string]$sshd.Status } else { "Missing" })
            port22 = [bool](
                Get-NetTCPConnection `
                    -LocalPort 22 `
                    -State Listen `
                    -ErrorAction SilentlyContinue
            )
        }
        sessionEnabled = Test-Path -LiteralPath $SessionFlag
        lastAction = $LastAction
        startupGraceSeconds = $StartupGraceSeconds
        virtualCameraValidated = $false
        transformedOutputValidated = $false
        updatedAt = (Get-Date).ToString("o")
    }

    $temporary = "$StatusPath.tmp"

    $snapshot |
        ConvertTo-Json -Depth 15 |
        Set-Content -LiteralPath $temporary -Encoding UTF8

    Move-Item -LiteralPath $temporary -Destination $StatusPath -Force
}

function Read-Request {
    param([string]$Action)

    if ($Action -notin $AllowedActions) {
        throw "Action is not allowlisted: $Action"
    }

    $path = Join-Path $Requests "$Action.request"

    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $null
    }

    try {
        $request = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json

        if ([string]$request.action -ne $Action) {
            throw "Request action does not match its file name."
        }

        return $request
    }
    catch {
        Write-AgentLog "Rejected malformed $Action request: $($_.Exception.Message)" "ERROR"
        return $null
    }
    finally {
        Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
    }
}

function Start-GemPipeline {
    if (Test-GemPipelineReady) {
        Write-AgentLog "Start request received; the verified backend and OBS path is already ready." "READY"
        return
    }

    if (-not (Test-Path -LiteralPath $MainPinokioPath -PathType Container)) {
        throw "Expected Pinokio MAIN folder is missing: $MainPinokioPath"
    }

    if (-not (Test-Path -LiteralPath $Orchestrator -PathType Leaf)) {
        throw "GEM orchestrator is missing: $Orchestrator"
    }

    Start-Process `
        -FilePath "powershell.exe" `
        -WindowStyle Hidden `
        -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", "`"$Orchestrator`""
        ) | Out-Null

    Write-AgentLog "Started GEM in the signed-in interactive desktop session." "READY"
}

function Stop-GemPipeline {
    if (-not (Test-Path -LiteralPath $StopScript -PathType Leaf)) {
        throw "GEM stop script is missing: $StopScript"
    }

    & powershell.exe `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File $StopScript

    Write-AgentLog "Stopped the coordinated GEM application flow." "READY"
}

function Open-GemInterfaces {
    Start-Process $DashboardUrl
    Start-Sleep -Milliseconds 400
    Start-Process $Base44ControlCenter
    Start-Sleep -Milliseconds 400
    Start-Process $Base44AdditionalStudio
    Write-AgentLog "Opened the local laptop dashboard and both Base44 surfaces." "READY"
}

function Write-Base44Payload {
    $raw = Get-Content -LiteralPath $StatusPath -Raw | ConvertFrom-Json

    $payload = [ordered]@{
        schemaVersion = 1
        deviceName = "GEM-ASSIST"
        continuityVersion = [string]$raw.continuityVersion
        coreVersion = [string]$raw.coreVersion
        online = $true
        backendHealthy = $raw.backendHealthy -eq $true
        pipelineReady = $raw.pipelineReady -eq $true
        obsReady = ($raw.obsRunning -eq $true -and $raw.obsWebSocket -eq $true)
        pinokioRunning = $raw.pinokioRunning -eq $true
        lastAction = [string]$raw.lastAction
        updatedAt = [string]$raw.updatedAt
    }

    $payload |
        ConvertTo-Json -Depth 8 |
        Set-Content -LiteralPath $Base44Payload -Encoding UTF8
}

function Open-Base44 {
    Save-Status "base44"
    Write-Base44Payload
    Start-Process $Base44ControlCenter
    Start-Sleep -Milliseconds 400
    Start-Process $Base44AdditionalStudio
    Write-AgentLog "Refreshed the no-secret Base44 device payload and opened both surfaces." "READY"
}

function Start-Diagnostics {
    if (-not (Test-Path -LiteralPath $Diagnostics -PathType Leaf)) {
        throw "GEM diagnostics script is missing: $Diagnostics"
    }

    Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", "`"$Diagnostics`"",
            "-OpenReport"
        ) | Out-Null

    Write-AgentLog "Opened GEM diagnostics." "READY"
}

function Suspend-GemComputer {
    Add-Type -AssemblyName System.Windows.Forms
    Save-Status "sleep-requested"
    Write-AgentLog "Putting the PC into wakeable sleep." "READY"
    Start-Sleep -Seconds 2

    [System.Windows.Forms.Application]::SetSuspendState(
        [System.Windows.Forms.PowerState]::Suspend,
        $false,
        $false
    ) | Out-Null
}

$created = $false
$mutex = New-Object `
    Threading.Mutex(
        $true,
        "Local\GEMLaptopSessionAgentV320",
        [ref]$created
    )

if (-not $created) {
    exit 0
}

$restartHistory = New-Object System.Collections.Generic.List[datetime]
$lastLaunchAttempt = [datetime]::MinValue
$circuitLogged = $false
$lastAction = "agent-started"

try {
    Write-AgentLog "GEM laptop interactive session agent started." "READY"
    Save-Status $lastAction

    while ($true) {
        if (Read-Request "start") {
            New-Item -ItemType File -Path $SessionFlag -Force | Out-Null
            Start-GemPipeline
            $lastLaunchAttempt = Get-Date
            $restartHistory.Clear()
            $circuitLogged = $false
            $lastAction = "start"
        }

        if (Read-Request "stop") {
            Remove-Item -LiteralPath $SessionFlag -Force -ErrorAction SilentlyContinue
            Stop-GemPipeline
            $lastLaunchAttempt = [datetime]::MinValue
            $restartHistory.Clear()
            $circuitLogged = $false
            $lastAction = "stop"
        }

        if (Read-Request "restart") {
            New-Item -ItemType File -Path $SessionFlag -Force | Out-Null
            Stop-GemPipeline
            Start-Sleep -Seconds 5
            Start-GemPipeline
            $lastLaunchAttempt = Get-Date
            $restartHistory.Clear()
            $circuitLogged = $false
            $lastAction = "restart"
        }

        if (Read-Request "open") {
            Open-GemInterfaces
            $lastAction = "open"
        }

        if (Read-Request "base44") {
            Open-Base44
            $lastAction = "base44"
        }

        if (Read-Request "doctor") {
            Start-Diagnostics
            $lastAction = "doctor"
        }

        if (Read-Request "sleep") {
            $lastAction = "sleep"
            Save-Status $lastAction
            Suspend-GemComputer
        }

        $ready = Test-GemPipelineReady

        if ((Test-Path -LiteralPath $SessionFlag) -and -not $ready) {
            $now = Get-Date
            $cutoff = $now.AddMinutes(-$RecoveryWindowMinutes)

            for ($index = $restartHistory.Count - 1; $index -ge 0; $index--) {
                if ($restartHistory[$index] -lt $cutoff) {
                    $restartHistory.RemoveAt($index)
                }
            }

            $secondsSinceLaunch = if ($lastLaunchAttempt -eq [datetime]::MinValue) {
                [double]::PositiveInfinity
            }
            else {
                ($now - $lastLaunchAttempt).TotalSeconds
            }

            if ($secondsSinceLaunch -ge $StartupGraceSeconds) {
                if ($restartHistory.Count -lt $MaximumRecoveryAttempts) {
                    $restartHistory.Add($now)
                    Start-GemPipeline
                    $lastLaunchAttempt = $now
                    $circuitLogged = $false
                    $lastAction = "auto-recovery"
                    Write-AgentLog "Automatic recovery requested after the five-minute startup grace period." "WARN"
                }
                elseif (-not $circuitLogged) {
                    $circuitLogged = $true
                    $lastAction = "recovery-circuit-open"
                    Write-AgentLog "Automatic recovery circuit opened after three attempts in thirty minutes." "ERROR"
                }
            }
        }
        elseif ($ready) {
            $restartHistory.Clear()
            $circuitLogged = $false

            if ($lastAction -in @("start", "restart", "auto-recovery", "agent-started")) {
                $lastAction = "ready"
            }
        }

        Save-Status $lastAction
        Start-Sleep -Seconds 3
    }
}
catch {
    Write-AgentLog $_.Exception.Message "ERROR"
    Save-Status "agent-failed"
}
finally {
    if ($created) {
        $mutex.ReleaseMutex() | Out-Null
    }

    $mutex.Dispose()
}
