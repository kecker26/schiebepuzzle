@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

echo.
echo ========================================
echo   Schiebepuzzle - Production Build
echo ========================================
echo.

REM Navigiere zum Projektverzeichnis
cd /d "%~dp0"

REM Prüfe ob node_modules existiert
if not exist "node_modules" (
    echo Dependencies werden installiert...
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo FEHLER: npm install fehlgeschlagen
        pause
        exit /b 1
    )
    echo Dependencies erfolgreich installiert.
    echo.
)

REM Erstelle Production Build
echo Erstelle Production-Build...
echo.
call npm run build

if !errorlevel! equ 0 (
    echo.
    echo ========================================
    echo   Build erfolgreich!
    echo   Ausgabe im Ordner: dist/
    echo ========================================
    echo.
) else (
    echo.
    echo FEHLER: Build fehlgeschlagen
    echo.
)

pause
