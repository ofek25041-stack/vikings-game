@echo off
title Vikings Ngrok Direct
echo Starting Ngrok Tunnel...
echo.
echo Please wait for the URL to appear below...
echo.
call node_modules\.bin\ngrok.cmd http 3000
pause
