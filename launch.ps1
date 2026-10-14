# =====================================================================
# SHREEJI GEMS - 100% Offline App Launcher
# =====================================================================
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

$targetUrl = "http://127.0.0.1:5173/"

# 1. Check if offline server on port 5173 is already running
$serverRunning = $false
try {
    $resp = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($resp.StatusCode -eq 200) {
        $serverRunning = $true
    }
} catch {
    $serverRunning = $false
}

# 2. If server is not running, start it detached in background
if (-not $serverRunning) {
    $frontendDir = Join-Path $scriptDir "frontend"
    
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c npm run dev -- --host 0.0.0.0 --port 5173"
    $psi.WorkingDirectory = $frontendDir
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $psi.CreateNoWindow = $true
    $psi.UseShellExecute = $true
    [System.Diagnostics.Process]::Start($psi) | Out-Null

    # Wait up to 12 seconds for the server to become responsive
    $started = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 600
        try {
            $check = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($check.StatusCode -eq 200) {
                $started = $true
                break
            }
        } catch {}
    }
}

# 3. Locate browser executable for borderless standalone app mode
$browserExe = $null
$pf86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
$pf = [Environment]::GetEnvironmentVariable('ProgramFiles')
$localApp = [Environment]::GetEnvironmentVariable('LocalAppData')

$candidates = @(
    (Join-Path $pf86 "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $pf "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $localApp "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $pf "Google\Chrome\Application\chrome.exe"),
    (Join-Path $pf86 "Google\Chrome\Application\chrome.exe"),
    (Join-Path $localApp "Google\Chrome\Application\chrome.exe"),
    (Join-Path $pf "BraveSoftware\Brave-Browser\Application\brave.exe")
)

foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) {
        $browserExe = $c
        break
    }
}

# 4. Launch SHREEJI GEMS in standalone native app window
if ($browserExe) {
    Start-Process -FilePath $browserExe -ArgumentList "--app=$targetUrl"
} else {
    Start-Process $targetUrl
}
