# Install the NemoClaw watchdog as a Windows Scheduled Task.
# Run this once from an elevated PowerShell prompt:
#   powershell -ExecutionPolicy Bypass -File scripts\install-watchdog-task.ps1

$TaskName = "NemoClaw-Watchdog"
$ScriptPath = Join-Path $PSScriptRoot "watchdog.ps1"

# Remove existing task if present
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Trigger 1: On user logon
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Trigger 2: Every 5 minutes repeating (for 365 days)
$triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 365)

# Action: run the watchdog PowerShell script
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

# Settings: run whether user is logged on or not, don't stop on idle
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Register the task
Register-ScheduledTask `
    -TaskName $TaskName `
    -Description "Ensures NemoClaw supervisor is always running in WSL" `
    -Trigger $triggerLogon, $triggerRepeat `
    -Action $action `
    -Settings $settings `
    -RunLevel Highest `
    -Force

Write-Host "Scheduled task '$TaskName' installed."
Write-Host "  Script: $ScriptPath"
Write-Host "  Triggers: On logon + every 5 minutes"
Write-Host ""
Write-Host "To test: schtasks /run /tn $TaskName"
Write-Host "To remove: Unregister-ScheduledTask -TaskName $TaskName"
