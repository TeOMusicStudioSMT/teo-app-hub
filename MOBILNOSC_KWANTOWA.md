# 🚀 KWANTOWA MOBILNOŚĆ — Katedra w Locie (Kieszeń Suwerena)

> Katedra przestaje być przywiązana do biurka. SanDisk Extreme Fit + Pierścień =
> pełna potęga Królestwa w kieszeni. **Agnostyczna sprzętowo**: gdziekolwiek jest VRAM,
> tam budzi się Katedra. 0.00G — zero chmurowej telemetrii.

## Model operacyjny

```
 [ KIESZEŃ: SanDisk Fit ] ──► Smartfon (USB-C) ──► START_MOBILE.sh (Termux)
                                                          │
       ┌──────────────────────────────────────────────────┤
       ▼ (Autoryzacja NFC)                                 ▼ (VRAM telefonu)
 [ RingKey.tsx ]                                     [ GEMMA4 / Kronos / JusT ]
  - odczyt suwerennego tokenu                         - wnioskowanie offline
  - natychmiastowe otwarcie Śluzy                     - zero telemetrii Matrixa
```

## Dwie drogi mózgu na telefonie
1. **JusT (on-device, WebGPU)** — NAJPROSTSZA, bez Node/Ollamy. Chrome na Androidzie
   liczy model MediaPipe (`public/models/gemma-2b-it-gpu-int4.bin`) bezpośrednio na
   VRAM telefonu. Wystarczy otworzyć UI. Patrz `services/mediaPipeService.ts`. Gdy brak
   `.bin` — auto-fallback do Ollamy/Chmury (`CreativeZoneCard.tsx`).
2. **Most + Ollama (Termux)** — pełna moc: `pkg install nodejs`, opcjonalnie Ollama,
   potem `START_MOBILE.sh` (Most :3001 + UI :5176).

## Jak odpalić (gdy SanDisk dotrze — ~8 lipca 2026)
1. Wepnij SanDisk w telefon przez przejściówkę USB-C.
2. **Termux** → przejdź do dysku → `bash START_MOBILE.sh` (Most + UI), LUB
   tylko otwórz `http://localhost:5176` po `npx vite preview` — tryb JusT ruszy na VRAM.
3. **Dotknij Pierścieniem (NFC)** — `RingKey.tsx` odczyta token i otworzy Śluzę.
4. Pracuj offline. Tożsamość (`identity.json`) + zwinność post-kwantowa (Kyber/Dilithium)
   podróżują fizycznie z Tobą — odcięte od sieci.

## Bezpieczeństwo (mobilne)
- Tożsamość i klucze NIGDY nie idą do chmury — żyją na dysku w kieszeni.
- NFC pierścień = fizyczny drugi czynnik (token w tagu, nie w telefonie).
- Backup walleta szyfrowany (AES-256-GCM) zapisywany przy wejściu pierścieniem.

## GRV w locie (ISTed)
Wolne cykle telefonu (pociąg, plaża) → lokalne zadanie w Quantum Forge → węzeł świeci
na mapie → GRV na konto. Mobilna stacja energetyczna, nie konsument.

## Status
Launcher `START_MOBILE.sh` gotowy (jedzie z distro przez Miniaturyzator). Pierwszy
mobilny rozruch — gdy dotrze SanDisk (~8 lipca). Patrz pamięć: trzy-mozgi, nosnik-katedra.
