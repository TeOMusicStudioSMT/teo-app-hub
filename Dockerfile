# --- ETAP 1: KUCHARZ (Node Slim) ---
FROM node:18-slim AS builder

WORKDIR /app

# Kopiujemy definicje
COPY package.json ./

# Instalujemy zależności
RUN npm install --legacy-peer-deps --no-audit

# Kopiujemy resztę kodu
COPY . .

# --- KLUCZOWY MOMENT: Przekazujemy zmienne do budowania ---
ARG VITE_GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

# Budujemy aplikację (teraz widzi klucze!)
RUN npm run build

# --- ETAP 2: KELNER (Nginx) ---
FROM nginx:alpine

# Usuwamy domyślny config
RUN rm /etc/nginx/conf.d/default.conf

# Kopiujemy nasz config
COPY nginx.conf /etc/nginx/nginx.conf

# Kopiujemy zbudowaną aplikację
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]