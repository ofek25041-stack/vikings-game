@echo off
title Test LocalTunnel Installation
echo ==========================================
echo   TESTING LOCALTUNNEL
echo ==========================================
echo.

echo Step 1: Checking if npm is installed...
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found!
    echo You need to install Node.js first.
    echo Download from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo [OK] npm found!
echo.

echo Step 2: Checking npm version...
npm --version
echo.

echo Step 3: Checking if localtunnel is installed...
where lt >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] LocalTunnel is installed!
    lt --version
    echo.
    echo You can now run: start_localtunnel.bat
) else (
    echo [INFO] LocalTunnel is NOT installed yet.
    echo.
    echo Do you want to install it now? (Y/N)
    set /p answer="Install? (Y/N): "
    
    if /i "%answer%"=="Y" (
        echo.
        echo Installing localtunnel...
        call npm install -g localtunnel
        
        if %ERRORLEVEL% EQU 0 (
            echo.
            echo [OK] Installation successful!
            echo You can now run: start_localtunnel.bat
        ) else (
            echo.
            echo [ERROR] Installation failed!
            echo Try running this manually:
            echo   npm install -g localtunnel
        )
    )
)

echo.
echo ==========================================
echo   TEST COMPLETE
echo ==========================================
pause
