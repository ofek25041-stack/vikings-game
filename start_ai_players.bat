@echo off
title Vikings AI Manager
echo Starting AI Players...
echo (Make sure the Server is running first!)
echo.

:: 1. Try global node
where node >nul 2>nul
if %errorlevel% equ 0 (
    node ai_manager.js
    pause
    exit
)

:: 2. Try Explicit Path (Winget Install)
if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" ai_manager.js
    pause
    exit
)

echo Node.js not found. Please install Node.js.
pause
