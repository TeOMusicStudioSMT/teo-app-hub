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

REM ── Model Whisper (karaoke / napisy / STT) — auto-download przy 1. starcie ──
REM Binarka whisper-cli.exe jedzie w distro (lekka), model ggml-small (~465MB)
REM dociagamy z HuggingFace tylko raz. Bez niego karaoke/napisy nie zadzialaja.
set "WHISPER_MODEL=%~dp0_OtakOs_AI\models\ggml-small.bin"
if not exist "%WHISPER_MODEL%" (
    echo %CYAN%[WHISPER]%RESET% %PURPLE%Pierwsze pobranie modelu mowy ^(~465MB, jednorazowo^)...%RESET%
    if not exist "%~dp0_OtakOs_AI\models" mkdir "%~dp0_OtakOs_AI\models"
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin' -OutFile '%WHISPER_MODEL%' -UseBasicParsing } catch { exit 1 }"
    if not exist "%WHISPER_MODEL%" echo %PURPLE%[!] Nie udalo sie pobrac modelu Whisper — karaoke/napisy dzialaja dopiero po recznym wgraniu ggml-small.bin do _OtakOs_AI\models.%RESET%
)

REM ── Glos Suwerena (XTTS) — auto-instalacja przy pierwszym uruchomieniu ──
REM Uwaga: launcher jedzie NAKŁADANY na korzeń distro (Miniaturyzator overlay),
REM wiec _OtakOs_AI jest siostrzanym folderem tego pliku, tak samo jak wiesio-bridge.js.
set "VOICE_ENV=%~dp0_OtakOs_AI\voice_env"
set "VOICE_REQ=%~dp0_OtakOs_AI\requirements-voice.txt"
set "VOICE_SRV=%~dp0_OtakOs_AI\voice_server.py"
where python >nul 2>nul
if not "%errorlevel%"=="0" (
    echo %PURPLE%[!] Brak Pythona — pomijam Glos Suwerena ^(karaoke/Whisper dalej dzialaja^). Zainstaluj Python 3.10-3.12 by go wlaczyc.%RESET%
    goto :node_start
)
if not exist "%VOICE_ENV%\Scripts\python.exe" (
    echo %CYAN%[GLOS]%RESET% %PURPLE%Pierwsza instalacja silnika klonu glosu ^(XTTS, moze potrwac kilka minut^)...%RESET%
    python -m venv "%VOICE_ENV%"
    "%VOICE_ENV%\Scripts\python.exe" -m pip install --quiet --upgrade pip
    "%VOICE_ENV%\Scripts\python.exe" -m pip install --quiet -r "%VOICE_REQ%"
    if not "%errorlevel%"=="0" echo %PURPLE%[!] Instalacja Glosu Suwerena nie powiodla sie — front spadnie na fallback przegladarki ^(speechSynthesis^).%RESET%
)
if exist "%VOICE_ENV%\Scripts\python.exe" (
    echo %CYAN%[GLOS]%RESET% Silnik klonu glosu (:5002)...
    start "Glos Suwerena" "%VOICE_ENV%\Scripts\python.exe" "%VOICE_SRV%"
)

:node_start
echo %CYAN%[NODE]%RESET% Wiesio-Bridge (:3001)...
start "Wiesio-Bridge" cmd /k node wiesio-bridge.js
echo %CYAN%[NODE]%RESET% Frontend (:5176)...
start "Katedra Web" cmd /k npm run dev
timeout /t 10 >nul
start "" http://localhost:5176
echo %CYAN%Gotowe -^> %RESET%http://localhost:5176
pause
goto :eof
