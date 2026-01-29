@echo off
title Cloudflare Tunnel Setup
echo Installing Cloudflare Tunnel...
echo.

REM Check if cloudflared is installed
where cloudflared >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Cloudflared already installed!
    echo.
    goto START_TUNNEL
)

echo Cloudflared not found. Please download it from:
echo https://github.com/cloudflare/cloudflared/releases/latest
echo.
echo Download: cloudflared-windows-amd64.exe
echo Rename it to: cloudflared.exe
echo Put it in this folder or add to PATH
echo.
pause
exit

:START_TUNNEL
echo Starting Cloudflare Tunnel...
echo.
echo Your game will be available at a public URL (https://xxx.trycloudflare.com)
echo Keep this window OPEN to keep the tunnel active!
echo.

cloudflared tunnel --url http://localhost:3000

pause
