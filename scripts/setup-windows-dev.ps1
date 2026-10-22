# GEM Enterprise - one-time Windows dev setup.
# Run in a NORMAL (non-admin) PowerShell window:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-windows-dev.ps1
# or paste the whole file. Safe to re-run: every step skips what is already done.
# Installs user-scope only (Scoop + fnm), never touches production, never prints secrets.
& {
  $ErrorActionPreference = 'Continue'

  # ---- Settings ---------------------------------------------------------------
  $RepoUrl     = 'https://github.com/gem-cybersecurity-monitoring-assist/gem-enterprise.git'
  $RepoDir     = Join-Path $HOME 'source\gem-enterprise'
  $NodeMajor   = '24'
  $PnpmVersion = '10.28.0'
  $Shell       = (Get-Process -Id $PID).Path   # run installers in a child process of this same PowerShell

  # ---- Helpers ----------------------------------------------------------------
  function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
  function Ok($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
  function Warn($msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }
  function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
  function Refresh-Path {
    $env:Path = @(
      [Environment]::GetEnvironmentVariable('Path', 'User'),
      [Environment]::GetEnvironmentVariable('Path', 'Machine'),
      "$HOME\scoop\shims", "$HOME\.local\bin"
    ) -join ';'
  }
  function Add-UserPath($dir) {
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (($user -split ';') -notcontains $dir) {
      [Environment]::SetEnvironmentVariable('Path', "$user;$dir", 'User')
    }
  }
  function Run($label, [scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) { throw "$label failed (exit $LASTEXITCODE)" }
  }
  function Retry($label, [scriptblock]$cmd, [int]$attempts = 3) {
    for ($i = 1; $i -le $attempts; $i++) {
      & $cmd
      if ($LASTEXITCODE -eq 0) { return }
      Warn "$label failed (attempt $i of $attempts)"
    }
    throw "$label failed after $attempts attempts - check the network (VPN, proxy, antivirus HTTPS scanning)"
  }

  try {
    # ---- 0. Guard rails ---------------------------------------------------------
    Step 'Checking session'
    $principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
      throw 'This window is elevated. Close it, open PowerShell normally (not "Run as administrator"), and paste again.'
    }
    Ok "Non-admin PowerShell $($PSVersionTable.PSVersion) as $env:USERNAME"

    $policy = Get-ExecutionPolicy -Scope CurrentUser
    if ($policy -in @('Undefined', 'Restricted', 'AllSigned')) {
      Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
      Ok 'Execution policy set to RemoteSigned for your user only'
    } else { Ok "Execution policy ($policy) already allows local scripts" }

    # A wrong system clock makes every HTTPS download fail (CERT_NOT_YET_VALID / TLS timeouts).
    $netTime = $null
    try {
      $dateHeader = (Invoke-WebRequest -Uri 'http://www.msftconnecttest.com/connecttest.txt' -Method Head -UseBasicParsing -TimeoutSec 15).Headers['Date']
      $netTime = [datetime]::Parse("$dateHeader").ToUniversalTime()
    } catch { Warn 'Could not check the system clock (offline?) - continuing' }
    if ($netTime) {
      $skew = [math]::Abs(((Get-Date).ToUniversalTime() - $netTime).TotalMinutes)
      if ($skew -gt 5) {
        Start-Process 'ms-settings:dateandtime'
        throw ("System clock is off by {0:N0} minutes. Turn on 'Set time automatically', click 'Sync now', then run this again." -f $skew)
      }
      Ok 'System clock is correct'
    }

    # ---- 1. Scoop (user-scope package manager) ----------------------------------
    Step 'Scoop'
    if (-not (Have scoop)) {
      Run 'Scoop installer' { & $Shell -NoProfile -ExecutionPolicy RemoteSigned -Command "irm https://get.scoop.sh | iex" }
      Refresh-Path
    }
    Ok "scoop $(scoop --version | Select-Object -Last 1)"

    # ---- 2. CLI tools via Scoop -------------------------------------------------
    Step 'Git, GitHub CLI, fnm, Supabase CLI'
    if (-not (Have git)) { Run 'scoop install git' { scoop install git } }
    if (-not (Have gh))  { Run 'scoop install gh'  { scoop install gh } }
    if (-not (Have fnm)) { Run 'scoop install fnm' { scoop install fnm } }
    if (-not (Have supabase)) {
      if ((scoop bucket list | Out-String) -notmatch 'supabase') {
        Run 'scoop bucket add supabase' { scoop bucket add supabase https://github.com/supabase/scoop-bucket.git }
      }
      Run 'scoop install supabase' { scoop install supabase }
    }
    Refresh-Path
    Ok (git --version); Ok ((gh --version) | Select-Object -First 1); Ok "fnm $(fnm --version)"; Ok "supabase $(supabase --version)"

    # ---- 3. Node 24 via fnm (repo requires engines.node 24.x) -------------------
    Step "Node.js $NodeMajor"
    Run 'fnm install' { fnm install $NodeMajor }
    Run 'fnm default' { fnm default $NodeMajor }
    fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
    $hook = 'fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression'
    if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force | Out-Null }
    if (-not (Select-String -Path $PROFILE -SimpleMatch $hook -Quiet)) {
      Add-Content -Path $PROFILE -Value "`n# fnm (Node version manager)`n$hook"
      Ok "Added fnm hook to $PROFILE"
    }
    Ok "node $(node --version)"

    # ---- 4. pnpm + Vercel CLI ---------------------------------------------------
    Step 'pnpm and Vercel CLI'
    if (-not (Have pnpm) -or ((pnpm --version) -ne $PnpmVersion)) {
      Run 'npm install pnpm' { npm install -g "pnpm@$PnpmVersion" --no-fund --no-audit }
    }
    if (-not (Have vercel)) { Run 'npm install vercel' { npm install -g vercel --no-fund --no-audit } }
    Ok "pnpm $(pnpm --version)"; Ok "vercel $(vercel --version 2>$null | Select-Object -Last 1)"

    # ---- 5. Claude Code (native installer, no admin) ----------------------------
    Step 'Claude Code'
    if (-not (Have claude)) {
      Run 'Claude Code installer' { & $Shell -NoProfile -ExecutionPolicy RemoteSigned -Command "irm https://claude.ai/install.ps1 | iex" }
      Add-UserPath "$HOME\.local\bin"
      Refresh-Path
    }
    $gitBash = @("$env:ProgramFiles\Git\bin\bash.exe", "$HOME\scoop\apps\git\current\bin\bash.exe") |
      Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($gitBash -and -not [Environment]::GetEnvironmentVariable('CLAUDE_CODE_GIT_BASH_PATH', 'User')) {
      [Environment]::SetEnvironmentVariable('CLAUDE_CODE_GIT_BASH_PATH', $gitBash, 'User')
      $env:CLAUDE_CODE_GIT_BASH_PATH = $gitBash
      Ok "Claude Code will use Git Bash at $gitBash"
    }
    Ok (claude --version)

    # ---- 6. Sign-ins (browser opens; skipped if already signed in) --------------
    Step 'Sign-ins'
    gh auth status --hostname github.com *> $null
    if ($LASTEXITCODE -ne 0) { Retry 'gh auth login' { gh auth login --hostname github.com --git-protocol https --web } }
    Run 'gh auth setup-git' { gh auth setup-git }
    Ok 'GitHub signed in (git uses gh credentials)'

    vercel whoami *> $null
    if ($LASTEXITCODE -ne 0) { Run 'vercel login' { vercel login } }
    Ok 'Vercel signed in'

    supabase projects list *> $null
    if ($LASTEXITCODE -ne 0) { Run 'supabase login' { supabase login } }
    Ok 'Supabase signed in'

    # ---- 7. Repository ------------------------------------------------------------
    Step "Repository at $RepoDir"
    if (-not (Test-Path (Join-Path $RepoDir '.git'))) {
      New-Item -ItemType Directory -Path (Split-Path $RepoDir) -Force | Out-Null
      Run 'git clone' { git clone -c core.autocrlf=false $RepoUrl $RepoDir }
    } else {
      Run 'git fetch' { git -C $RepoDir fetch origin --prune }
      if (git -C $RepoDir status --porcelain) { Warn 'Local changes present - skipped pull (nothing overwritten)' }
      else { git -C $RepoDir pull --ff-only; if ($LASTEXITCODE -ne 0) { Warn 'Fast-forward pull not possible - left branch as is' } }
    }
    Set-Location $RepoDir
    Ok "Branch: $(git branch --show-current)"

    # ---- 8. Install + local verification (no database is contacted) ---------------
    Step 'Install and verify'
    Retry 'pnpm install' { pnpm install --frozen-lockfile }
    $setDbUrl = -not $env:POSTGRES_PRISMA_URL
    if ($setDbUrl) {   # placeholder for this window only, so Prisma can validate/generate offline
      $env:POSTGRES_PRISMA_URL      = 'postgresql://ci:ci@localhost:5432/gem_ci'
      $env:POSTGRES_URL_NON_POOLING = 'postgresql://ci:ci@localhost:5432/gem_ci'
    }
    $results = foreach ($script in 'db:generate', 'db:schema:check', 'claims:check', 'lint', 'typecheck', 'test', 'build') {
      Write-Host "`n--- pnpm run $script" -ForegroundColor DarkCyan
      $t = Measure-Command { pnpm run $script | Out-Host }
      [pscustomobject]@{ Check = $script; Result = $(if ($LASTEXITCODE -eq 0) { 'PASS' } else { "FAIL ($LASTEXITCODE)" }); Seconds = [int]$t.TotalSeconds }
    }
    if ($setDbUrl) { Remove-Item Env:POSTGRES_PRISMA_URL, Env:POSTGRES_URL_NON_POOLING }
    git restore next-env.d.ts 2>$null   # build regenerates this file; keep the tree clean

    # ---- 9. Summary -------------------------------------------------------------
    Step 'Summary'
    $results | Format-Table -AutoSize | Out-Host
    Write-Host 'Next: in this folder run   claude remote-control --name "GEM Enterprise"' -ForegroundColor Green
    Write-Host '      then open claude.ai/code (or the Claude app) and pick that session.' -ForegroundColor Green
    Write-Host '      Dev server: pnpm dev' -ForegroundColor Green
  }
  catch {
    Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Fix the issue above and paste the script again - completed steps are skipped.' -ForegroundColor Red
  }
}
