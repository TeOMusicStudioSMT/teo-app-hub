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

echo [2/4] Otwieranie Mostu ^(Wiesio-Bridge :3001^)...
start "Wiesio-Bridge" cmd /k "node wiesio-bridge.js"

echo [3/4] Rozpalanie UI ^(Vite :5176^)...
start "Katedra Web" cmd /k "npm run dev"

echo [4/4] Czekam az Vite wstanie ^(:5176^)... moze potrwac na wolnym dysku.
powershell -NoProfile -Command "$i=0; while(-not (Test-NetConnection -ComputerName localhost -Port 5176 -InformationLevel Quiet) -and $i -lt 120){Start-Sleep 1; $i++}; if($i -ge 120){Write-Host '[UWAGA] Vite nie wstal w 120s - sprawdz okno Katedra Web.'}"

echo [BRAMA] Otwieram przegladarke...
start "" http://localhost:5176

echo.
echo ============================================
echo  Gotowe -^> http://localhost:5176
echo  Most i UI dzialaja w osobnych oknach.
echo  To okno mozesz zamknac.
echo ============================================
pause
