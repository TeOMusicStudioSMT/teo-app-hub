# 📚 Księgarnia Skili — Katedra OtakOS

Księgozbiór **powtarzalnych czynów** (skill = forma powtarzalnego działania, jak zalesianie wyspy).
Bibliotekarka **Jadziunia** dobiera skille do zadania (UI: Game Forge → „📚 Księgarnia Skili").

## Skąd
Zawendorowane z **awesome-gamedev-agent-skills**
(https://github.com/gamedev-skills/awesome-gamedev-agent-skills), licencja **Apache-2.0**
(LICENSE + NOTICE zachowane obok). 66 skili w formacie `SKILL.md` — **zgodne z Claude Code** (Kurka).

## Układ (półki)
`TeO_Skille/<półka>/<skill>/SKILL.md` — półki: `unreal`, `unity`, `godot`, `web-engines`,
`other-engines`, `disciplines`, `genres`, `workflows`.

## Jak to działa
- Most: `GET /api/skille/list` (parsuje frontmatter → katalog po półkach), `POST /api/skille/pick {task}`
  (Jadziunia/Ollama dobiera 1-4 trafne skille z katalogu).
- **Księgozbiór rośnie:** dorzucasz nowy `TeO_Skille/<półka>/<nazwa>/SKILL.md` (frontmatter: `name`,
  `description`, `metadata.engine/category/difficulty`) — Jadziunia od razu go widzi.
- Gdy skill ma realnie działać w Kurce (Claude Code), kopiujesz wybrany do `.claude/skills/<nazwa>/SKILL.md`.

## Mapa na nasze etapy 2 Wyspy
niagara+blueprints → choreografia bota; enhanced-input → pierścień/portale; behavior-trees → strażnicy;
survival-crafting+save-systems → Stocznia; procedural-gen → rozrzut bazy; unreal-packaging → granie .exe.
