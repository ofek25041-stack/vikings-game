@echo off
echo Killing node and chrome...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM chrome.exe 2>nul
timeout /t 2 /nobreak >nul

echo Starting server...
start /B node server.js
timeout /t 2 /nobreak >nul

echo Opening Chrome Incognito...
start chrome --incognito "http://localhost:3000"

echo Done! Check the game now.
pause
