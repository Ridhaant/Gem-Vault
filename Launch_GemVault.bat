@echo off
title Shreeji Gems - Gemstones CRM
color 0A

echo =====================================================================
echo    SHREEJI GEMS - GEMSTONES CRM AND PACKET INVENTORY MASTER
echo    100%% Local, Offline and Transferable Software (Air-Gapped)
echo =====================================================================
echo.
echo [*] Initializing Shreeji Gems desktop environment...

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launch.ps1"

echo.
echo [OK] Shreeji Gems launched successfully!
ping 127.0.0.1 -n 3 >nul
exit
