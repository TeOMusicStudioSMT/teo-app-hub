#!/data/data/com.termux/files/usr/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  🚀 KATEDRA OtakOS — KIESZEŃ SUWERENA (mobilny rozruch 0.00G)
#  SanDisk Extreme Fit wpięty w telefon (USB-C) → Katedra liczy na VRAM telefonu.
#
#  Wymaga: Termux (Android) + `pkg install nodejs`. Ten skrypt leży w ROOT distro.
#  Dwie drogi mózgu:
#    • Most + Ollama (jeśli zainstalowana w Termux) — pełna moc.
#    • Tryb JusT (on-device, WebGPU w Chrome) — BEZ Node/Ollamy, sam telefon.
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"

echo "🦀  KATEDRA — Kieszeń Suwerena (mobilny 0.00G)"
echo "────────────────────────────────────────────"

if ! command -v node >/dev/null 2>&1; then
  echo "⚠  Brak Node.js. W Termux uruchom:  pkg install nodejs"
  echo "   (Albo otwórz tylko UI w Chrome — tryb JusT użyje VRAM telefonu bez Node.)"
  exit 1
fi

# Zależności (pierwszy raz)
if [ ! -d node_modules ]; then
  echo "📦  Instaluję zależności (pierwszy raz)…"
  npm install --legacy-peer-deps --no-audit
fi

# Most (Wiesio-Bridge :3001) w tle
echo "🌉  Wybudzam Most (wiesio-bridge :3001)…"
node wiesio-bridge.js &
BRIDGE_PID=$!

# UI :5176 — preview zbudowanego dist (lekko) lub dev
if [ -d dist ]; then
  echo "🖥️   Serwuję zbudowane UI (vite preview :5176)…"
  npx vite preview --host --port 5176 &
else
  echo "🖥️   Rozpalam UI (vite dev :5176)…"
  npm run dev -- --host --port 5176 &
fi
UI_PID=$!

sleep 3
echo ""
echo "✅  Gotowe. Otwórz w Chrome (Android):  http://localhost:5176"
echo "📱  Tryb JusT (on-device) użyje VRAM telefonu — wnioskowanie offline, zero telemetrii."
echo "💍  Dotknij Pierścieniem (NFC), by otworzyć Śluzę (RingKey)."
echo "🛑  Zatrzymanie: naciśnij Ctrl+C."

trap 'echo; echo "🌙  Domykam Katedrę…"; kill $BRIDGE_PID $UI_PID 2>/dev/null || true' INT TERM
wait
