$LogFile = Join-Path $env:USERPROFILE ".nemoclaw-watchdog.log"

function Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    Add-Content -Path $LogFile -Value "$ts [watchdog] $msg"
}

if (Test-Path $LogFile) {
    if ((Get-Item $LogFile).Length -gt 5MB) {
        Move-Item $LogFile "$LogFile.old" -Force
        Log "Log rotated"
    }
}

$wslOk = $false
try {
    $r = wsl -d Ubuntu -- echo OK 2>$null
    if ($r -eq "OK") { $wslOk = $true }
} catch { }

if (-not $wslOk) {
    Log "WSL not running, starting"
    wsl -d Ubuntu -- echo started 2>$null
    Start-Sleep -Seconds 3
}

$supOk = $false
try {
    $r = wsl -d Ubuntu -- bash -c 'pgrep -f nemoclaw-supervisor >/dev/null 2>&1; echo $?' 2>$null
    if ($r -eq "0") { $supOk = $true }
} catch { }

if ($supOk) {
    Log "Supervisor running OK"
    exit 0
}

Log "Supervisor not running, starting"

try {
    wsl -d Ubuntu -- bash -c 'cd /mnt/c/Development/Projects/NemoClaw && nohup bash scripts/start-supervisor.sh >> /tmp/nemoclaw-watchdog-start.log 2>&1 &' 2>$null
} catch {
    Log "Failed to launch start command"
    exit 1
}

Start-Sleep -Seconds 10

$supOk2 = $false
try {
    $r = wsl -d Ubuntu -- bash -c 'pgrep -f nemoclaw-supervisor >/dev/null 2>&1; echo $?' 2>$null
    if ($r -eq "0") { $supOk2 = $true }
} catch { }

if ($supOk2) {
    Log "Supervisor started OK"
} else {
    Log "Supervisor failed to start"
}
