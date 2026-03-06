@echo off
color 0B
echo ========================================================
echo Inicjalizacja Przestrzeni 0.00G: Katedra OtakOS
echo ========================================================

echo [1/3] Wybudzanie lokalnego Ducha (Ollama)...
start /MIN ollama serve

echo [2/3] Rozpalanie silnikow UI (Vite)...
start cmd /k "npm run dev"

echo [3/3] Czekam na stabilizacje wektorow (3 sekundy)...
timeout /t 3 /nobreak > nul

echo Otwieranie Bramy (Przegladarka)...
start http://localhost:5176

exit