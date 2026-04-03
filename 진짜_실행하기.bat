@echo off
rem This file is inside the project folder to ensure it works correctly.
echo Re-starting Local Server (Cleaning up previous instances)...
echo ------------------------------------------

rem Kill any existing node processes to prevent port clashing
taskkill /f /im node.exe >nul 2>&1

echo Starting Local Server...
echo ------------------------------------------
call npm.cmd run dev -- --open
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to start. Make sure Node.js is installed.
    pause
)
