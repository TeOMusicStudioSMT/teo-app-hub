@echo off
title Katedra OtakOS - Edycja V_ZERO
cd /d "%~dp0"

REM ── ANSI Cybernetic Art (wektory Flash BoBa) ─────────────────────────
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "PURPLE=%ESC%[95m"
set "CYAN=%ESC%[96m"
set "RESET=%ESC%[0m"

echo %PURPLE%
echo    %CYAN%    /\        __    __    ____  ____   __    %PURPLE%
echo    %CYAN%   /  \      /  \  /  \  ^|  __^|^|  _ \ /  \   %PURPLE%
echo    %CYAN%  / /\ \    / /\ \/ /\ \ ^| ^|_  ^| ^|_) ^| /\ \  %PURPLE%
echo    %CYAN% / ____ \  / ____  ____ \^|  _^| ^|  _ ^< ____ \ %PURPLE%
echo    %CYAN%/_/    \_\/_/    \____  \^|_^|   ^|_^| \_\    \_\%PURPLE%
echo        %PURPLE%[ klasyfikacja: %CYAN%AAA Far A%PURPLE% - impuls Zlotej Pauzy 0.00G ]%RESET%
echo.
echo %PURPLE%=====[ %CYAN%KATEDRA OtakOS %PURPLE%]==============[ %CYAN%Wymiar 0.00G  (V_ZERO) %PURPLE%]=====%RESET%
echo.

where docker >nul 2>nul
if "%errorlevel%"=="0" goto docker
where node >nul 2>nul
if "%errorlevel%"=="0" goto node

echo %PURPLE%[!] Brak Docker i Node.js.%RESET%
echo     Zainstaluj Docker Desktop LUB Node.js 20+ i uruchom ponownie.
pause
goto :eof

:docker
echo %CYAN%[DOCKER]%RESET% %PURPLE%Buduje i startuje stack (pierwszy raz potrwa kilka minut)...%RESET%
docker compose up -d --build
timeout /t 6 >nul
start "" http://localhost:8080
echo %CYAN%Gotowe -^> %RESET%http://localhost:8080
pause
goto :eof

:node
echo %CYAN%[NODE]%RESET% %PURPLE%Instaluje zaleznosci (od 1 min... do wciul - Czekaj, Przyzwalaj)...%RESET%
call npm install --legacy-peer-deps --no-audit
echo %CYAN%[NODE]%RESET% Wiesio-Bridge (:3001)...
start "Wiesio-Bridge" cmd /k node wiesio-bridge.js
echo %CYAN%[NODE]%RESET% Frontend (:5176)...
start "Katedra Web" cmd /k npm run dev
timeout /t 10 >nul
start "" http://localhost:5176
echo %CYAN%Gotowe -^> %RESET%http://localhost:5176
pause
goto :eof
