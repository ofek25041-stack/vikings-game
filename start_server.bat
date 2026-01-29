@echo off
title Vikings Game Server
echo Starting Server...

:: 1. Try global node
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Found global Node.js
    node server.js
    pause
    exit
)

:: 1.5 Try Explicit Path (Winget Install)
if exist "C:\Program Files\nodejs\node.exe" (
    echo Found Node.js at Program Files
    "C:\Program Files\nodejs\node.exe" server.js
    pause
    exit
)

:: 2. Try Adobe Node from Program Files
if exist "C:\Program Files\Adobe\Adobe Photoshop 2022\node.exe" (
    echo Found Fallback Node (Photoshop)
    "C:\Program Files\Adobe\Adobe Photoshop 2022\node.exe" server.js
    pause
    exit
)

:: 3. Try other locations if needed...

echo.
echo ===================================================
echo CRITICAL ERROR: Node.js was not found on your PC.
echo ===================================================
echo.
echo The game server requires 'Node.js' to run.
echo.
echo BUT DO NOT WORRY!
echo You can still play the game in "Offline Backup Mode".
echo Just open index.html and play.
echo.
pause
