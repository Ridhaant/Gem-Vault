# =====================================================================
# SHREEJI GEMS - 100% Offline App Launcher
# =====================================================================
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

$targetUrl = "http://127.0.0.1:8000/"

# 1a. Start High-Performance Python SQLite Backend on Port 8000 if available
$backendRunning = $false
try {
    $backendCheck = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($backendCheck.StatusCode -eq 200) {
        $backendRunning = $true
    }
} catch {
    $backendRunning = $false
}

if (-not $backendRunning) {
    $backendDir = Join-Path $scriptDir "backend"
    if (Test-Path (Join-Path $backendDir "server.py")) {
        $psiBack = New-Object System.Diagnostics.ProcessStartInfo
        $psiBack.FileName = "cmd.exe"
        $psiBack.Arguments = "/c python server.py"
        $psiBack.WorkingDirectory = $backendDir
        $psiBack.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $psiBack.CreateNoWindow = $true
        $psiBack.UseShellExecute = $true
        try { 
            [System.Diagnostics.Process]::Start($psiBack) | Out-Null 
            for ($b = 0; $b -lt 12; $b++) {
                Start-Sleep -Milliseconds 400
                try {
                    $bCheck = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
                    if ($bCheck.StatusCode -eq 200) { 
                        $backendRunning = $true
                        break 
                    }
                } catch {}
            }
        } catch {}
    }
}

# 1b. If Python backend is active, port 8000 serves both frontend & API seamlessly!
# If backend is unavailable, fall back to offline server on port 5173
if (-not $backendRunning) {
    $targetUrl = "http://127.0.0.1:5173/"
    $serverRunning = $false
    try {
        $resp = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200 -and ($resp.Content -match "Shreeji Gems|Gemstones CRM")) {
            $serverRunning = $true
        }
    } catch {
        $serverRunning = $false
    }

    if (-not $serverRunning) {
        $docsDir = Join-Path $scriptDir "docs"
        if (Test-Path $docsDir) {
            $psiPy = New-Object System.Diagnostics.ProcessStartInfo
            $psiPy.FileName = "cmd.exe"
            $psiPy.Arguments = "/c python -m http.server 5173 --directory `"$docsDir`""
            $psiPy.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
            $psiPy.CreateNoWindow = $true
            $psiPy.UseShellExecute = $true
            try {
                [System.Diagnostics.Process]::Start($psiPy) | Out-Null
                Start-Sleep -Milliseconds 1200
            } catch {}
        }
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
