@echo off
title LocalTunnel Setup
echo ==========================================
echo   LOCALTUNNEL - Free Public URL
echo ==========================================
echo.

REM Check if localtunnel is installed
echo Checking if LocalTunnel is installed...
where lt >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] LocalTunnel is already installed!
    echo.
    goto START_TUNNEL
)

echo [INFO] LocalTunnel not found. Installing...
echo This will take a few seconds...
echo.

REM Install localtunnel
call npm install -g localtunnel

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Installation failed!
    echo.
    echo Possible reasons:
    echo  1. npm is not installed
    echo  2. No internet connection
    echo  3. Permission issues
    echo.
    echo Try running this command manually in CMD:
    echo   npm install -g localtunnel
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Installation complete!
echo.

:START_TUNNEL
echo Starting LocalTunnel on port 3000...
echo.
echo ==========================================
echo  INSTRUCTIONS:
echo ==========================================
echo 1. Keep this window OPEN
echo 2. When you see a URL like https://xxx.loca.lt
echo 3. Copy and share it with friends!
echo.
echo Note: First time visitors might see a warning page
echo They just need to click "Continue" to access the game
echo ==========================================
echo.

REM Run localtunnel
lt --port 3000

REM If we get here, lt exited (error or manual stop)
echo.
echo [INFO] Tunnel stopped or error occurred.
echo.

pause
