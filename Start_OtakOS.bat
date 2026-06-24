@echo off
cd /d "%~dp0"

:: Konfiguracja kolorów ANSI w cmd
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "PURPLE=%ESC%[38;2;168;85;247m"
set "CYAN=%ESC%[38;2;0;255;255m"
set "RESET=%ESC%[0m"

echo %PURPLE%
echo          ▲          %CYAN% _  __     _     _____  _____ ____   ____     _    %PURPLE%
echo         / \         %CYAN%| |/ /    / \   |_   _|| ____|  _ \ |  _ \   / \   %PURPLE%
echo        /   \        %CYAN%| ' /    / _ \    | |  |  _| | |_) || |_) | / _ \  %PURPLE%
echo       /|   |\       %CYAN%| . \   / ___ \   | |  | |___|  _ < |  __/ / ___ \ %PURPLE%
echo      / |   | \      %CYAN%|_|\_\ /_/   \_\  |_|  |_____|_| \_\|_|   /_/   \_\%RESET%
echo     /  |   |  \
echo    |   |___|   |  %PURPLE%=====[ %CYAN%KATEDRA OtakOS %PURPLE%]=================[ %CYAN%Wymiar 0.00G  (V_ZERO) %PURPLE%]=====%RESET%
echo.

echo %CYAN%[1/3]%RESET% %PURPLE%Wybudzanie lokalnego Ducha (Ollama)...%RESET%
start /MIN ollama serve

echo %CYAN%[2/4]%RESET% %PURPLE%Sprawdzam zaleznosci (pierwszy raz potrwa)...%RESET%
if not exist "node_modules" call npm install --legacy-peer-deps --no-audit

echo %CYAN%[3/4]%RESET% %PURPLE%Otwieranie Mostu (Wiesio-Bridge :3001)...%RESET%
start "Wiesio-Bridge" cmd /k "node wiesio-bridge.js"

echo %CYAN%[4/4]%RESET% %PURPLE%Rozpalanie silnikow UI (Vite :5176)...%RESET%
start "Katedra Web" cmd /k "npm run dev"

echo %CYAN%[GATEWAY]%RESET% %PURPLE%Czekam az Vite wstanie (:5176)... moze potrwac na wolnym dysku%RESET%
powershell -NoProfile -Command "$i=0; while(-not (Test-NetConnection -ComputerName localhost -Port 5176 -InformationLevel Quiet) -and $i -lt 90){Start-Sleep 1; $i++}; if($i -ge 90){Write-Host 'Timeout 90s — Vite chyba nie wstal, sprawdz okno Katedra Web.'}"
start http://localhost:5176

echo.
echo %CYAN%Gotowe -^> %RESET%http://localhost:5176  %PURPLE%(Most: :3001, Ollama w tle)%RESET%
echo %PURPLE%Mozesz zamknac to okno. Most i UI dzialaja w osobnych oknach.%RESET%
pause > nul