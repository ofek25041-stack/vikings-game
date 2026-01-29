@echo off
title Deploy to Render.com - Step by Step
echo ==========================================
echo   DEPLOY VIKINGS GAME TO RENDER.COM
echo ==========================================
echo.

echo This guide will help you deploy your game to the cloud!
echo.
echo PREREQUISITES:
echo   1. Git installed (check: git --version)
echo   2. GitHub account
echo   3. Render.com account (free)
echo.
pause

echo.
echo ==========================================
echo   STEP 1: Initialize Git Repository
echo ==========================================
echo.

if exist ".git" (
    echo [OK] Git repository already exists!
) else (
    echo Initializing git...
    git init
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Git not installed!
        echo Download from: https://git-scm.com/download/win
        pause
        exit /b 1
    )
    echo [OK] Git initialized!
)

echo.
echo ==========================================
echo   STEP 2: Add Files to Git
echo ==========================================
echo.

echo Adding all files...
git add .
git commit -m "Initial commit - Vikings Game for deployment"

echo.
echo [OK] Files committed to git!
echo.

echo ==========================================
echo   STEP 3: Create GitHub Repository
echo ==========================================
echo.
echo Now you need to:
echo.
echo 1. Go to: https://github.com/new
echo 2. Repository name: vikings-game
echo 3. Make it PUBLIC (required for free Render.com)
echo 4. DO NOT add README, .gitignore, or license
echo 5. Click "Create repository"
echo.
echo When done, copy the repository URL (should be like):
echo   https://github.com/YOUR_USERNAME/vikings-game.git
echo.

set /p REPO_URL="Paste your GitHub repository URL here: "

if "%REPO_URL%"=="" (
    echo [ERROR] No URL provided!
    pause
    exit /b 1
)

echo.
echo Connecting to GitHub...
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] Push failed. You may need to authenticate with GitHub.
    echo.
    echo Try these steps:
    echo 1. Go to: https://github.com/settings/tokens
    echo 2. Generate new token (classic)
    echo 3. Select "repo" scope
    echo 4. Use the token as password when pushing
    echo.
    echo Then run: git push -u origin main
    pause
    exit /b 1
)

echo.
echo [OK] Code pushed to GitHub!
echo.

echo ==========================================
echo   STEP 4: Deploy to Render.com
echo ==========================================
echo.
echo Now go to: https://render.com
echo.
echo 1. Sign up for a FREE account (or log in)
echo 2. Click "New +" → "Web Service"
echo 3. Click "Connect GitHub" and authorize Render
echo 4. Select your "vikings-game" repository
echo 5. Configure:
echo    - Name: vikings-game
echo    - Environment: Node
echo    - Build Command: npm install
echo    - Start Command: node server.js
echo    - Plan: Free
echo 6. Click "Create Web Service"
echo.
echo Render will deploy your game automatically!
echo You'll get a URL like: https://vikings-game.onrender.com
echo.
echo NOTE: Free tier sleeps after 15 min of inactivity.
echo It will wake up automatically when someone visits!
echo.

echo ==========================================
echo   DEPLOYMENT COMPLETE!
echo ==========================================
echo.
echo Your next steps:
echo 1. Wait for Render to finish deploying (5-10 minutes)
echo 2. Copy your public URL
echo 3. Share with friends!
echo.
echo Your game will be online 24/7! 🎉
echo.

pause
