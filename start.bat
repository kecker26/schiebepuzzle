@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

echo.
echo ========================================
echo   Schiebepuzzle App - Entwicklungsserver
echo ========================================
echo.

REM Navigiere zum Projektverzeichnis
cd /d "%~dp0"

REM Pruefe ob node_modules existiert
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

REM Pruefe, ob bereits eine passende Schiebepuzzle-Instanz auf Port 5173 laeuft
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2; if ($response.Content -match '<title>Schiebepuzzle</title>') { exit 0 } else { exit 2 } } catch { exit 1 }"
if !errorlevel! equ 0 (
    echo Entwicklungsserver laeuft bereits unter http://127.0.0.1:5173/
    start "" "http://127.0.0.1:5173/"
    exit /b 0
)

if !errorlevel! equ 2 (
    echo.
    echo FEHLER: Port 5173 wird bereits von einer anderen Anwendung verwendet.
    echo Bitte diese Anwendung schliessen oder den Port freigeben.
    pause
    exit /b 1
)

REM Starte Entwicklungsserver
echo Starte Entwicklungsserver...
echo.
call npm run dev

pause
