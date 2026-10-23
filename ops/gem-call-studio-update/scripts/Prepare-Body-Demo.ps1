#requires -Version 5.1
<#
GEM Virtual Team Studio — install the experimental free 2D body-motion demo.
Does not enable premium APIs, merge GitHub branches, or restart the remote agent.
Must run in the Windows user's own session, elevated only if Program Files requires it.
#>
[CmdletBinding()]
param([switch]$ValidateOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"
$App=Join-Path $env:ProgramFiles "GEM Call Studio\app"
$Local=Join-Path $env:LOCALAPPDATA "GEM-Enterprise\Body-Demo"
$Audit=Join-Path $Local "last-install-report.json"
$Repo="https://raw.githubusercontent.com/support371/gem-enterprise/cdd3b8c4d5105dfe168bdef7efb63056508632f3/ops/gem-call-studio-update/app"
$ModelUri="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
$Files=@("src\pose-puppet.js","src\studio.js","public\index.html")
$Stage=Join-Path $Local "incoming"
$Backup=Join-Path $Local ("backup-"+(Get-Date -Format "yyyyMMdd-HHmmss"))
$Status="FAILED";$Issue="";$Checks=@()
function Check([string]$Name,[bool]$Value,[string]$Detail){
  $script:Checks+=@{name=$Name;ok=$Value;detail=$Detail}
  Write-Output ("{0} {1}: {2}" -f $(if($Value){"PASS"}else{"FAIL"}),$Name,$Detail)
  if(-not $Value){throw "$Name - $Detail"}
}
try{
  New-Item -ItemType Directory -Force -Path $Local|Out-Null
  Check "Installed app" (Test-Path -LiteralPath $App) $App
  $Node=(Get-Command node.exe -ErrorAction SilentlyContinue).Source
  Check "Node runtime" ([bool]$Node) "Node available"
  $Build=Join-Path $App "node_modules\esbuild\bin\esbuild"
  Check "Existing builder" (Test-Path -LiteralPath $Build) "esbuild installed; no new paid service needed"
  $Memory=Get-CimInstance Win32_OperatingSystem
  Check "Available memory" ($Memory.FreePhysicalMemory -ge 650000) "$([math]::Round($Memory.FreePhysicalMemory/1024)) MB free for model/build"
  if(-not $ValidateOnly){
    New-Item -ItemType Directory -Force -Path $Stage,$Backup|Out-Null
    foreach($Relative in $Files){
      $Path=Join-Path $Stage $Relative
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path)|Out-Null
      $Url=$Repo+"/"+($Relative -replace "\\","/")
      Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing -TimeoutSec 40
      Check ("Downloaded "+$Relative) ((Get-Item -LiteralPath $Path).Length -gt 200) "Code fetched from pinned GitHub commit"
      if($Relative.EndsWith(".js")){ & $Node --check $Path;Check ("Syntax "+$Relative) ($LASTEXITCODE -eq 0) "Syntax accepted" }
    }
    $html=Get-Content -LiteralPath (Join-Path $Stage "public\index.html") -Raw
    Check "2D demo UI" ($html -match 'id="tryPuppet"' -and $html -match 'pose-motion-demo-20261012') "Control and new cache key available"
    $Model=Join-Path $App "public\models\pose_landmarker_lite.task"
    if(-not (Test-Path -LiteralPath $Model) -or (Get-Item -LiteralPath $Model).Length -ne 5777746){
      New-Item -ItemType Directory -Force -Path (Split-Path $Model)|Out-Null
      $Temporary=$Model+".download"
      Invoke-WebRequest -Uri $ModelUri -OutFile $Temporary -UseBasicParsing -TimeoutSec 90
      Check "MediaPipe model size" ((Get-Item -LiteralPath $Temporary).Length -eq 5777746) "Official 5.8 MB pose model"
      Move-Item -LiteralPath $Temporary -Destination $Model -Force
    }
    Check "Pose model" ((Get-Item -LiteralPath $Model).Length -eq 5777746) "Available locally"
    $OldBundle=Join-Path $App "public\\assets\\studio.js"
    $SavedBundle=Join-Path $Backup "studio.js.bundle.bak"
    if(Test-Path -LiteralPath $OldBundle){Copy-Item -LiteralPath $OldBundle -Destination $SavedBundle -Force}
    foreach($Relative in $Files){
      $Original=Join-Path $App $Relative
      $Saved=Join-Path $Backup $Relative
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Saved)|Out-Null
      if(Test-Path -LiteralPath $Original){Copy-Item -LiteralPath $Original -Destination $Saved -Force}
      Copy-Item -LiteralPath (Join-Path $Stage $Relative) -Destination $Original -Force
    }
    Push-Location $App
    try{
      & $Node $Build src/studio.js --bundle --format=esm --platform=browser --target=es2022 --outfile=public/assets/studio.js
      Check "Studio bundle" ($LASTEXITCODE -eq 0) "Built without paid services"
    }catch{
      foreach($Relative in $Files){
        $Saved=Join-Path $Backup $Relative
        if(Test-Path -LiteralPath $Saved){Copy-Item -LiteralPath $Saved -Destination (Join-Path $App $Relative) -Force}
      }
      if(Test-Path -LiteralPath $SavedBundle){Copy-Item -LiteralPath $SavedBundle -Destination $OldBundle -Force}
      throw
    }finally{Pop-Location}
  }
  $Base="http://127.0.0.1:8765"
  try{
    $Health=Invoke-RestMethod -Uri "$Base/api/health" -TimeoutSec 5
    Check "Local server" ($Health.status -eq "ok") "Server responding"
    $Page=(Invoke-WebRequest -Uri "$Base/" -UseBasicParsing -TimeoutSec 5).Content
    Check "Studio page" ($Page -match 'tryPuppet') "2D mode available over loopback"
    $Resource=Invoke-WebRequest -Uri "$Base/models/pose_landmarker_lite.task" -Method Head -UseBasicParsing -TimeoutSec 8
    Check "Pose model served" ($Resource.StatusCode -eq 200) "Pose tracking model accessible"
  }catch{
    $script:Checks+=@{name="Local server and URL";ok=$false;detail=$_.Exception.Message}
    Write-Output "PARTIAL: files prepared, but browser/server needs a live check"
  }
  $Status=if(@($Checks|Where-Object{-not $_.ok}).Count){"PARTIAL"}else{"PASS"}
}catch{
  $Issue=$_.Exception.Message
  Write-Warning $Issue
}finally{
  $Report=@{status=$Status;time=(Get-Date).ToString("o");validateOnly=[bool]$ValidateOnly;backup=$Backup;issue=$Issue;checks=$Checks}
  $Report|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $Audit -Encoding UTF8
  Write-Output "GEM_BODY_DEMO_STATUS=$Status"
  Write-Output "Report: $Audit"
  if($Status -eq "PASS"){Write-Output "Open http://127.0.0.1:8765/ and choose Try free 2D body demo."}
}
