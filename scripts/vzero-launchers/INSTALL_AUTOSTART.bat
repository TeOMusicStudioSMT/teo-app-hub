@echo off
title Instalacja Autostartu Katedry OtakOS
net session >nul 2>nul
if not "%errorlevel%"=="0" (
  echo [!] Uruchom TEN plik jako ADMINISTRATOR (prawy klik -> Uruchom jako administrator).
  pause & exit /b 1
)
echo [1/2] Wlaczam log zdarzen podlaczania urzadzen...
wevtutil sl Microsoft-Windows-DriverFrameworks-UserMode/Operational /e:true
echo [2/2] Rejestruje zadanie "Katedra OtakOS Autostart"...
schtasks /create /tn "Katedra OtakOS Autostart" /xml "%~dp0Autostart_Katedra.xml" /f
echo.
echo Gotowe. Od teraz po wlozeniu pendrive'a Katedra wystartuje sama (~5s opoznienia).
echo Aby usunac:  schtasks /delete /tn "Katedra OtakOS Autostart" /f
pause
