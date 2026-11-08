#requires -Version 5.1
[CmdletBinding()]
param([switch]$NoBrowser,[switch]$Hold)

Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"

$Root=Join-Path $env:ProgramFiles "GEM Call Studio"
$Scripts=Join-Path $Root "scripts"
$App=Join-Path $Root "app"
$NodeWorker="C:\Program Files\nodejs\node.exe"
$ObsFastJs=Join-Path $App "obs-fast-start.mjs"
$DecartWarmupJs=Join-Path $App "decart-warmup.mjs"
$Runtime=Join-Path $env:LOCALAPPDATA "GEM-Enterprise\Call-Studio"
$Logs=Join-Path $Runtime "logs"
$Log=Join-Path $Logs "project-start-v2.3.1.log"
$State=Join-Path $Runtime "project-start-state.json"
$Pinokio=Join-Path $env:LOCALAPPDATA "Programs\Pinokio\Pinokio.exe"
$Supervisor=Join-Path $Scripts "GEM-Call-Studio-Supervisor.ps1"
$Orchestrator=Join-Path $Scripts "GEM-All-Apps-Orchestrator.ps1"
$ObsFast=Join-Path $Scripts "GEM-OBS-FastStart.ps1"
$Warmup=Join-Path $Scripts "GEM-Decart-Warmup.ps1"
$SetKey=Join-Path $Scripts "Set-Decart-Key.ps1"
$KeyFile=Join-Path $Runtime "decart-key-v2.protected"
$HealthUrl="http://127.0.0.1:8765/api/health"
$StudioUrl="http://127.0.0.1:8765/?autoConnect=fast"
$StudioProfile=Join-Path $Runtime "studio-edge-profile"
$Clock=[Diagnostics.Stopwatch]::StartNew()

New-Item -ItemType Directory -Path $Logs,$StudioProfile -Force|Out-Null

function Log([string]$Message,[string]$Level="INFO"){
  Add-Content -LiteralPath $Log -Value "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fff')] [$Level] [$($Clock.ElapsedMilliseconds)ms] $Message" -Encoding UTF8
}
function Healthy(){
  try{
    $h=Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 1
    return ($h.status -eq "ok" -and $h.version -eq "2.3.1")
  }catch{return $false}
}
function DecartNeedsVerification(){
  $authState=Join-Path $Runtime "decart-auth-state.json"
  if(-not(Test-Path -LiteralPath $authState)){return $true}
  try{
    $s=Get-Content -LiteralPath $authState -Raw|ConvertFrom-Json
    if($s.authenticated -ne $true -or -not $s.checkedAt){return $true}
    $checked=[DateTimeOffset]::Parse([string]$s.checkedAt)
    return (([DateTimeOffset]::Now-$checked).TotalMinutes -gt 30)
  }catch{return $true}
}
function Read-ProtectedValue([string]$Path,[string]$EntropyText){
  try{
    Add-Type -AssemblyName System.Security
    $encoded=(Get-Content -LiteralPath $Path -Raw).Trim()
    $protected=[Convert]::FromBase64String($encoded)
    $entropy=[Text.Encoding]::UTF8.GetBytes($EntropyText)
    $plain=[Security.Cryptography.ProtectedData]::Unprotect($protected,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    try{return [Text.Encoding]::UTF8.GetString($plain).Trim()}
    finally{[Array]::Clear($plain,0,$plain.Length)}
  }catch{return ""}
}
function Start-BackendDirect(){
  $node="C:\Program Files\nodejs\node.exe"
  $server=Join-Path $Root "app\server.mjs"
  $obsSecret=Join-Path $Runtime "obs-password-v2.protected"
  $key=Read-ProtectedValue $KeyFile "GEM-Call-Studio-V2-Decart-Key"
  $obsPassword=Read-ProtectedValue $obsSecret "GEM-Call-Studio-V2-OBS-Control"
  if($key -notmatch '^(dct_|sk-)\S{15,}$'){$key=""}
  if($obsPassword.Length -lt 20){throw "Protected OBS control password could not be read."}
  if(-not(Test-Path -LiteralPath $node)){throw "Node.js runtime missing."}
  $env:PORT="8765";$env:HOST="127.0.0.1";$env:DECART_ALLOWED_ORIGIN="http://127.0.0.1:8765"
  $env:DECART_API_KEY=$key;$env:GEM_ORCHESTRATOR_STATE=(Join-Path $Runtime "all-apps-v2.3.1-state.json")
  $env:OBS_WEBSOCKET_ADDRESS="ws://127.0.0.1:4455";$env:OBS_WEBSOCKET_PASSWORD=$obsPassword;$env:GEM_OBS_MANAGED="1"
  $out=Join-Path $Logs "server-v2.3.1.out.log";$err=Join-Path $Logs "server-v2.3.1.err.log"
  $quotedServer='"'+$server+'"'
  Start-Process -FilePath $node -ArgumentList @($quotedServer) -WorkingDirectory (Join-Path $Root "app") -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err|Out-Null
  Remove-Item Env:DECART_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:OBS_WEBSOCKET_PASSWORD -ErrorAction SilentlyContinue
}
function ProcessCommandExists([string]$Pattern){
  return [bool](Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue|Where-Object{$_.CommandLine -and $_.CommandLine -match $Pattern}|Select-Object -First 1)
}
function LaunchHidden([string]$Script,[string[]]$Extra=@()){
  $q='"'+$Script+'"'
  $args=@("-NoProfile","-ExecutionPolicy","Bypass","-File",$q)+$Extra
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList $args|Out-Null
}
function Open-StudioSingleton(){
  if($NoBrowser){return}
  $profilePattern=[regex]::Escape($StudioProfile)
  if(ProcessCommandExists $profilePattern){
    Log "Dedicated GEM Studio browser is already running."
    return
  }
  $edgeCandidates=@(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
  )
  $Edge=$edgeCandidates|Where-Object{Test-Path -LiteralPath $_}|Select-Object -First 1
  if($Edge){
    $profileArg='--user-data-dir="'+$StudioProfile+'"'
    Start-Process -FilePath $Edge -ArgumentList @(
      $profileArg,
      "--app=$StudioUrl",
      "--no-first-run",
      "--no-default-browser-check"
    )|Out-Null
    Log "Dedicated singleton GEM Studio window opened." "READY"
  }else{
    Start-Process $StudioUrl|Out-Null
    Log "Default browser Studio window opened." "READY"
  }
}

$Created=$false
$Mutex=[Threading.Mutex]::new($true,"Local\GEMProjectStartV231",[ref]$Created)
if(-not $Created){
  Log "Duplicate start request ignored; existing startup owner retained." "WARN"
  $dupDeadline=(Get-Date).AddSeconds(30)
  do{
    if(Healthy){break}
    Start-Sleep -Milliseconds 150
  }while((Get-Date)-lt $dupDeadline)
  if(Healthy){
    Open-StudioSingleton
    Write-Output "GEM_PROJECT_READY"
  }
  if($Hold){
    $stopFile=Join-Path $Runtime "stop-all-v2.3.1.request"
    while(-not(Test-Path -LiteralPath $stopFile)){Start-Sleep -Seconds 2}
  }
  exit 0
}

try{
  Log "FINAL GEM project start requested."

  foreach($f in @($Pinokio,$Supervisor,$Orchestrator,$NodeWorker,$ObsFastJs)){
    if(-not(Test-Path -LiteralPath $f)){throw "Required component missing: $f"}
  }

  # Optional cloud credentials do not block free local startup.
  # Start the core first, then launch Pinokio immediately in parallel.
  if(-not(Healthy)){
    Start-BackendDirect
    Log "Node backend direct-start requested in the master process."
  }else{
    Log "Node backend already healthy."
  }

  if(-not(Get-Process -Name Pinokio -ErrorAction SilentlyContinue)){
    Start-Process -FilePath $Pinokio|Out-Null
    Log "Pinokio launch requested in parallel with backend readiness."
  }else{Log "Pinokio already running."}

  $deadline=(Get-Date).AddSeconds(30)
  do{
    if(Healthy){break}
    Start-Sleep -Milliseconds 100
  }while((Get-Date)-lt $deadline)
  if(-not(Healthy)){throw "Backend failed to reach health during 30-second startup window."}

  $BackendReadyMs=$Clock.ElapsedMilliseconds
  Log "Node backend healthy." "READY"

  Open-StudioSingleton
  $StudioReadyMs=$Clock.ElapsedMilliseconds

  # Core is usable. Launch lightweight Node workers immediately.
  Start-Process -FilePath $NodeWorker -ArgumentList ('"'+$ObsFastJs+'"') -WorkingDirectory $App -WindowStyle Hidden | Out-Null
  Log "OBS Node fast-start worker dispatched."
  LaunchHidden $Orchestrator @("-Guardian","-NoOpenStudio","-ExternalObsPrep")
  Log "OBS/helper/monitoring orchestrator dispatched in background."

  if((Test-Path -LiteralPath $KeyFile) -and (Test-Path -LiteralPath $DecartWarmupJs) -and (DecartNeedsVerification)){
    Start-Process -FilePath $NodeWorker -ArgumentList ('"'+$DecartWarmupJs+'"') -WorkingDirectory $App -WindowStyle Hidden | Out-Null
    Log "Decart Node verification worker dispatched."
  }else{
    Log "Optional cloud warmup skipped or recent verification reused."
  }

  [ordered]@{
    version="2.3.1"
    architecture="single-owner-parallel-fast-start"
    pinokioRunning=[bool](Get-Process -Name Pinokio -ErrorAction SilentlyContinue)
    backendHealthy=$true
    decartKeyConfigured=[bool](Test-Path -LiteralPath $KeyFile)
    backendReadyMs=$BackendReadyMs
    studioReadyMs=$StudioReadyMs
    cameraOpenedAtStartup=$false
    oneStudioWindow=$true
    helpersContinueInBackground=$true
    updatedAt=(Get-Date).ToString("o")
  }|ConvertTo-Json|Set-Content -LiteralPath $State -Encoding UTF8

  Log "Core startup complete; background services continue independently." "READY"
  Write-Output "GEM_PROJECT_READY"
  try{$Mutex.ReleaseMutex()}catch{}
  $Mutex.Dispose()

  if($Hold){
    $stopFile=Join-Path $Runtime "stop-all-v2.3.1.request"
    while(-not(Test-Path -LiteralPath $stopFile)){Start-Sleep -Seconds 2}
  }
}catch{
  Log $_.Exception.Message "ERROR"
  [ordered]@{
    version="2.3.1"
    architecture="single-owner-parallel-fast-start"
    backendHealthy=[bool](Healthy)
    error=$_.Exception.Message
    elapsedMs=$Clock.ElapsedMilliseconds
    updatedAt=(Get-Date).ToString("o")
  }|ConvertTo-Json|Set-Content -LiteralPath $State -Encoding UTF8
  try{$Mutex.ReleaseMutex()}catch{}
  $Mutex.Dispose()
  exit 1
}