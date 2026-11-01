# Drift report — CLAUDE.md (wycinek) · 2026-11-01
_Złota rybka: recenzent bez kontekstu rozmowy (EGM drift report)._

## 📖 Żywa Księga
- Dok: STADO = `slowo` (Kronikarz) → `ilustracja` (Paleta). Kod ma TRZECI krok stada: 🌍 `przeklad` (Kronikarz przekłada wpis na angielski dla gości otakos.wtf, `SYSTEM_PRZEKLADU`, `odczytajPrzeklad`, `wciazPoPolsku`, jedna poprawka); `ponowStado` dokłada brakujący przekład starym wpisom — w dokumencie brak. Dowód: `services/ZywaKsiega.js:59-84`, `:286-300`, `:322-328`.
- Dok: „`services/StylePalety.js` czyta 32 style … → `systemSlowa(lista)`”. `systemSlowa` jest w `services/ZywaKsiega.js:47`, nie w StylePalety (ten eksportuje `styleZIndeksu`, `wczytajStyle`, `listaDlaKronikarza`, `znajdzStyl`, `sufiksStylu` — `services/StylePalety.js:17-52`). Drobne: liczba 32 stylów się zgadza (`wczytajStyle()` → 32).

## 🎭 Stała Obsada Katedry
- No drift detected.

## 📱 Formaty i sieci
- Dok: „film ≤ 60 s = „cały””. Kod proponuje „🎬 Cały film”, gdy film mieści się w limicie Shorts — `opis.sekundy <= CELE.shorts.max` (178 s), nie 60 s. Dowód: `services/Formaty.js:236` (komentarz `:215-216`: „chyba że cały film mieści się w Shorts”), `CELE.shorts.max = 178` w `:43`.
- AUTOPILOT: no drift detected (MAX_PROB 3, MAX_LIMITU 20/25/5, TYLKO_TANIEC, PAUZA_SIECI 3 h / 10 min, odstęp 15 s, pętla 2 min / 10 min, `OTAKOS_AUTOPILOT_FORMATOW`, trasy — zgodne).

## 🦎 Mame Leon Show
- No drift detected.

## 🎵🔌 Suno MCP
- Dok: „Główny i Claude Code: `scripts/mcp/suno.mjs` (stdio, serwer `katedra-suno` w `.mcp.json` i `Glowny.serweryMcp`)”. W `.mcp.json` wpis jest, ale `Glowny.serweryMcp()` NIE dodaje serwera Suno — rejestruje tylko studio, unityMCP i Wix; `cfg.mcpSuno` jest zdefiniowane i nigdzie nieużyte. Skutek: Główny nie dostaje narzędzi `mcp__katedra-suno__*`, a blok „SUNO (MCP…)” w prompcie (warunek `serweryMcp()[SERWER_SUNO]`) nigdy się nie pokazuje. Dowód: `services/Glowny.js:53` (mcpSuno), `:82-90` (serweryMcp bez Suno), `:238` (warunek w prompcie).
- Dok: `/rozlacz` = „revoke + usunięcie z Skarbca”. Kod usuwa ze Skarbca tylko `refresh_token`; `client_id` (usługa `suno` ma pola `client_id`, `refresh_token`) zostaje. Dowód: `services/SunoMcp.js:333-343`, `services/VaultService.js:50`.

## 🎛️ Jason — producent wykonawczy
- Dok: „Dawny `JasonFlowBridge.tsx` (TeO Lab) to atrapa z cookie Suno — nieużywana”. Komponent jest nadal montowany: `TeoLab.tsx` renderuje `<JasonFlowBridge demoMode={true} …/>`, a TeoLab jest osiągalny z `App.tsx` i `TeonautLounge.tsx`. Dowód: `components/special/TeoLab.tsx:16`, `:53`; `App.tsx:58`, `:1034`; `components/TeonautLounge.tsx:20`.

## ☀️ Poranny brief Katedry
- No drift detected.
