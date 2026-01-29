@echo off
title Vikings Game - Auto Deploy Script
echo ==========================================
echo   VIKINGS GAME - AUTOMATED DEPLOYMENT
echo ==========================================
echo.
echo This script will automatically:
echo 1. Authenticate with GitHub
echo 2. Create repository
echo 3. Upload all game files
echo.
echo Press any key to start...
pause >nul

echo.
echo Step 1: Checking if gh is installed...
gh --version
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] GitHub CLI not found!
    echo Please run: install_git.bat
    pause
    exit /b 1
)

echo [OK] GitHub CLI found!
echo.

echo Step 2: Authenticating with GitHub...
echo.
echo A browser window will open.
echo Please login and authorize GitHub CLI.
echo.
pause

gh auth login --web

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Authentication failed!
    pause
    exit /b 1
)

echo.
echo [OK] Authenticated successfully!
echo.

echo Step 3: Creating GitHub repository...
echo.

gh repo create vikings-game --public --source=. --remote=origin --description="Vikings Strategy Game - Multiplayer Browser Game"

if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Repository might already exist or creation failed.
    echo Trying to push to existing repository...
)

echo.
echo Step 4: Pushing code to GitHub...
echo.

git add .
git commit -m "Initial commit - Vikings Game deployment"
git branch -M main
git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Push failed!
    echo.
    echo Try these steps manually:
    echo 1. Go to: https://github.com/new
    echo 2. Create repo: vikings-game
    echo 3. Upload files manually
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   SUCCESS! Code is on GitHub!
echo ==========================================
echo.
echo Next steps:
echo 1. Go to: https://render.com
echo 2. Sign in with GitHub
echo 3. Click "New + → Web Service"
echo 4. Select "vikings-game"
echo 5. Click "Create Web Service"
echo.
echo Your game will be live in 5-10 minutes!
echo.
pause
