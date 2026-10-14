@echo off
title Shreeji Gems - Desktop Shortcut Installer
color 0A

echo =====================================================================
echo    💎 SHREEJI GEMS - CREATING DESKTOP SHORTCUT WITH GEMSTONE ICON
echo =====================================================================
echo.

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Create_Desktop_Shortcut.ps1"

echo.
pause
