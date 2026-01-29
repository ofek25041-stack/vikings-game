@echo off
title Download GitHub Desktop
echo ==========================================
echo   GITHUB DESKTOP INSTALLER
echo ==========================================
echo.
echo Opening GitHub Desktop download page...
echo.
echo After installation:
echo 1. Sign in with GitHub
echo 2. File -^> New Repository
echo 3. Point to: %~dp0
echo 4. Publish repository (make it PUBLIC!)
echo 5. Go to render.com and deploy!
echo.

start https://desktop.github.com/

echo.
echo Download page opened in browser.
echo.
pause
