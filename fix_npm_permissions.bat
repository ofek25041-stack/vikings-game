@echo off
title Fix PowerShell Execution Policy
echo ==========================================
echo   FIXING NPM PERMISSIONS
echo ==========================================
echo.
echo This will allow npm to run properly.
echo.
echo Running as Administrator is recommended!
echo.
pause

echo Changing execution policy...
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Execution policy changed successfully!
    echo You can now install and use npm packages.
) else (
    echo.
    echo [WARNING] Could not change policy automatically.
    echo.
    echo MANUAL FIX:
    echo 1. Open PowerShell as Administrator
    echo 2. Run this command:
    echo    Set-ExecutionPolicy RemoteSigned
    echo 3. Type Y and press Enter
)

echo.
pause
