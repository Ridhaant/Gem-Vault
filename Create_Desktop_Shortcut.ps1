$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

$shortcutPath = Join-Path $desktop "Shreeji Gems - Gemstones CRM.lnk"
$targetVbs = Join-Path $scriptDir "Launch_GemVault.vbs"
$iconPath = Join-Path $scriptDir "gemvault.ico"

# Ensure target launcher and icon exist
if (-not (Test-Path $targetVbs)) {
    Write-Warning "Launch_GemVault.vbs not found at $targetVbs"
}

$s = $ws.CreateShortcut($shortcutPath)
# wscript runs with NO black terminal window
$s.TargetPath = "wscript.exe"
$s.Arguments = "`"$targetVbs`""
$s.WorkingDirectory = $scriptDir
$s.IconLocation = "$iconPath, 0"
$s.Description = "Shreeji Gems CRM & Packet Master (100% Offline)"
$s.Save()

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " SUCCESS: Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host " Shortcut: $shortcutPath" -ForegroundColor White
Write-Host " Target:   wscript.exe `"$targetVbs`"" -ForegroundColor White
Write-Host " Icon:     $iconPath" -ForegroundColor White
Write-Host "=====================================================================" -ForegroundColor Cyan
