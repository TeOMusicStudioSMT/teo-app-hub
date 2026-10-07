@echo off
cd /d "%~dp0"
title Katedra OtakOS - uruchamianie

echo ============================================
echo    KATEDRA OtakOS  -  Wymiar 0.00G (V_ZERO)
echo ============================================
echo.

REM --- Sprawdzenie Node.js ---
where node >nul 2>nul
if errorlevel 1 (
    echo [BLAD] Brak Node.js w PATH. Zainstaluj Node.js 20+ i uruchom ponownie.
    echo.
    pause
    exit /b
)

REM --- Zaleznosci (pierwszy raz) ---
if not exist "node_modules" (
    echo [SETUP] Instaluje zaleznosci ^(pierwszy raz, moze potrwac^)...
    call npm install --legacy-peer-deps --no-audit
)

echo [1/4] Wybudzanie lokalnego Ducha ^(Ollama^)...
start "" /MIN ollama serve

REM --- Jedno okno Terminala "katedra": most, UI i studia jako ZAKLADKI obok siebie (2026-10-07).
REM     Bez Windows Terminal (albo OTAKOS_TERMINAL=okna) - osobne okna jak dawniej.
set "WT="
if not "%OTAKOS_TERMINAL%"=="okna" if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe" set "WT=%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe"

echo [2/4] Otwieranie Mostu ^(Wiesio-Bridge :3001^)...
if defined WT (
    "%WT%" -w katedra new-tab --title "Wiesio-Bridge" -d "%~dp0." cmd /k "node wiesio-bridge.js"
) else (
    start "Wiesio-Bridge" cmd /k "node wiesio-bridge.js"
)

REM --- Sprawdzenie Multica ---
where multica >nul 2>nul
if errorlevel 1 (
    echo [UWAGA] Brak multica w PATH. Pominiecie uruchomienia demona Multica.
) else (
    echo [Most-Multica] Uruchamianie demona Multica...
    if defined WT (
        "%WT%" -w katedra new-tab --title "Multica" -d "%~dp0." cmd /k "multica daemon start"
    ) else (
        start "Multica-Daemon" cmd /k "multica daemon start"
    )
)

echo [3/4] Rozpalanie UI ^(Vite :5176^)...
if defined WT (
    "%WT%" -w katedra new-tab --title "Katedra Web" -d "%~dp0." cmd /k "npm run dev"
) else (
    start "Katedra Web" cmd /k "npm run dev"
)

echo [4/4] Czekam az Vite wstanie ^(:5176^)... moze potrwac na wolnym dysku.
powershell -NoProfile -Command "$i=0; while(-not (Test-NetConnection -ComputerName localhost -Port 5176 -InformationLevel Quiet) -and $i -lt 120){Start-Sleep 1; $i++}; if($i -ge 120){Write-Host '[UWAGA] Vite nie wstal w 120s - sprawdz okno Katedra Web.'}"

echo [BRAMA] Otwieram przegladarke...
start "" http://localhost:5176

echo.
echo ============================================
echo  Gotowe -^> http://localhost:5176
echo  Most, UI i studia: zakladki okna Terminala katedra.
echo  To okno mozesz zamknac.
echo ============================================
pause
