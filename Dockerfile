# syntax=docker/dockerfile:1
# ══════════════════════════════════════════════════════════════════════════════
#  🏛️ KATEDRA OtakOS — obraz przenośny (Live-USB) · multi-stage
#  Stage 1 builder  → buduje frontend (Vite → dist)
#  Stage 2 bridge   → Wiesio-Bridge (Node + ffmpeg + esbuild) na :3001
#  Stage 3 web      → nginx serwujący zbudowany frontend na :8080
#  Ollama = osobny serwis (oficjalny obraz) — patrz docker-compose.yml.
# ══════════════════════════════════════════════════════════════════════════════

# ── ETAP 1: KUCHARZ (builder Vite) ────────────────────────────────────────────
FROM node:20-bookworm AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps --no-audit || npm install --legacy-peer-deps --no-audit
COPY . .
# Klucz Gemini wstrzykiwany w czasie buildu (jak w pierwotnym Dockerfile).
ARG VITE_GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
RUN npm run build      # → /app/dist

# ── ETAP 2: MECHANIK (Wiesio-Bridge runtime) ──────────────────────────────────
FROM node:20-bookworm-slim AS bridge
ENV NODE_ENV=production
WORKDIR /app
# ffmpeg (Impresario/Karaoke) · tini (init/sygnały) · esbuild (pętla weryfikacji Mechanika)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN (npm ci --omit=dev --legacy-peer-deps --no-audit || npm install --omit=dev --legacy-peer-deps --no-audit) \
 && npm install --no-save esbuild \
 && npm cache clean --force
# Backend (frontend tu niepotrzebny): most + serwisy + konfiguracja modeli
COPY wiesio-bridge.js ./
COPY services ./services
COPY models_config.json ./
# Katalogi runtime — montowane jako wolumeny persystencji w compose
RUN mkdir -p _OtakOs_Wymiar _OtakOs_Muzyka _OtakOs_Move _OtakOs_Sonic _OtakOs_Build .vault-0.00g
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3001/wiesio/action',{method:'POST',headers:{'Content-Type':'application/json'},body:'{\"action\":\"PING\"}'}).then(r=>r.json()).then(d=>process.exit(d.status==='AHOJ'?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["tini","--"]
CMD ["node","wiesio-bridge.js"]

# ── ETAP 3: KELNER (nginx + statyczny frontend) ───────────────────────────────
FROM nginx:alpine AS web
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
