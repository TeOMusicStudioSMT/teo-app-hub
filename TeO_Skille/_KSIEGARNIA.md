# 📚 Księgarnia Skili — Katedra OtakOS

Księgozbiór **powtarzalnych czynów** (skill = forma powtarzalnego działania, jak zalesianie wyspy).
Bibliotekarka **Jadziunia** dobiera skille do zadania (UI: Game Forge → „📚 Księgarnia Skili").

## Skąd
Zawendorowane z **awesome-gamedev-agent-skills**
(https://github.com/gamedev-skills/awesome-gamedev-agent-skills), licencja **Apache-2.0**
(LICENSE + NOTICE zachowane obok). **77 skili** w formacie `SKILL.md` — **zgodne z Claude Code** (Kurka).

**Odświeżone 2026-10-25** (upstream z 2026-10-24, „re-check every version baseline”): 66 starych zaktualizowanych
(nowe wersje silników, np. UE 5.8), 11 nowych: `router` (dobiera skill do zadania — jak Jadziunia, po angielsku),
`disciplines/create-game-assets`, `disciplines/ai-behavior-trees-utility-ai`, `ebitengine/ebitengine-game`,
`godot/godot-gdscript-headless-testing`, `other-engines/defold-core`, `other-engines/roblox-*` (5).
Uwaga: nowe nagłówki nie mają już `metadata` (silnik/trudność) — półka mówi, z jakiego silnika. Część skili
niesie skrypty (Python, Go) i pliki pomocnicze — to materiał dla agenta, Katedra ich nie uruchamia.

## Układ (półki)
`TeO_Skille/<półka>/<skill>/SKILL.md` — półki: `unreal`, `unity`, `godot`, `web-engines`, `ebitengine`,
`other-engines`, `disciplines`, `genres`, `workflows`; `router/SKILL.md` leży osobno (półka „router”).

## Jak to działa
- Most: `GET /api/skille/list` (parsuje frontmatter → katalog po półkach), `POST /api/skille/pick {task}`
  (Jadziunia/Ollama dobiera 1-4 trafne skille z katalogu).
- **Księgozbiór rośnie:** dorzucasz nowy `TeO_Skille/<półka>/<nazwa>/SKILL.md` (frontmatter: `name`,
  `description`, `metadata.engine/category/difficulty`) — Jadziunia od razu go widzi.
- Gdy skill ma realnie działać w Kurce (Claude Code), kopiujesz wybrany do `.claude/skills/<nazwa>/SKILL.md`.

## Mapa na nasze etapy 2 Wyspy
niagara+blueprints → choreografia bota; enhanced-input → pierścień/portale; behavior-trees → strażnicy;
survival-crafting+save-systems → Stocznia; procedural-gen → rozrzut bazy; unreal-packaging → granie .exe.

## 🎨 Półka `sztuka` (2026-10-29)
`sztuka/anidoodle` — skill **anidoodle** (https://github.com/alexgreensh/anidoodle, Apache-2.0, Alex Greenshpun;
LICENSE, NOTICE i `PROVENANCE-KATEDRA.md` w katalogu skilla): obrazy, filmy rysujące się same, animacje i lekcje
rysunku w 32 stylach, wszystko pisane kodem. Silnik (`engine/`, Node + three.js + Playwright/Chromium) to robota dla
agenta piszącego kod (Główny / Claude Code) — Katedra go sama nie uruchamia i nic nie doinstalowuje.
Stado bierze z niego wiedzę: `references/styles/INDEX.md` → Paleta w Żywej Księdze maluje w stylu wybranym przez
Kronikarza (`services/StylePalety.js`). Jadziunia gier tej półki nie widzi (tylko półki gier).

## 🎛️ Półka `muzyka` (2026-11-01)
`muzyka/jason-producent` — **Jason, AI Executive Producer** — Gem Suwerena „Json - Prof sound Stayl” (Matryca v3.0, Gemini) przeniesiony do Katedry: proces pomysł → werdykt → plan z wykonawcami Katedry → pakiety (lyrics, styl Suno), Suno konta Suwerena przez Suno MCP mostu (kredyty za zgodą). Ta sama osoba = TeOgochi `jason` (karta `services/persony/jason.md`, Delegat). Kopia dla Claude Code: `.claude/skills/jason-producent/`. Wzór dla kolejnych Gemów: Gem → karta persony + SKILL.md.

## 🏛️ Półka `katedra` (2026-11-01)
`katedra/rada-7` — **RA-DA 7** (Gem Suwerena): Bella, Flash BoB, Mistrz Adamus, ISTed, ODDI, Wiesio, Jadziunia — tryb narady jednego umysłu o siedmiu aspektach. W Hubie ta sama Rada siedzi przy Kwantowym Stole Narad (role i style z Gema). Gem „Video Maker — Specjalista ds. Spójności Historii” nie dostał osobnego skilla: jego zasady weszły do karty Reżysera (`services/persony/rezyser.md`), bo Reżyser + Stała Obsada robią to szerzej.
