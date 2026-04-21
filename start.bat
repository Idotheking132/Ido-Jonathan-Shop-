@echo off
echo ========================================
echo   Ido ^& Jonathan Shop - Starting...
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting server...
echo.
node server.js

pause
