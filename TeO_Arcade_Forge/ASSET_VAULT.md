# 🗄️ SKŁADNICA ASSETÓW — workflow katalogowy dla Agentów (drive-agnostyczny)

Jedna konwencja katalogowa → Agenci **wiedzą co gdzie leży** i **budują wiele projektów z tych samych
bibliotek naraz**. Niezależne od dysku (C/D/E/F…): zmienia się TYLKO korzeń, reszta jest względna.

## Korzeń (jedyna rzecz per maszyna)
`OTAKOS_ASSET_VAULT` = ścieżka do Składnicy na DOWOLNYM dysku (np. `E:\OtakVault` albo `F:\Assets`).
Most domyślnie szuka `TeO_Vault/` w projekcie, gdy env nie ustawiony.

## Taksonomia (3 poziomy + paczki)
```
<OTAKOS_ASSET_VAULT>/
  <rodzaj_gry>/        fpp · arpg · 2d · 3d · racing · survival · puzzle · shared
    <silnik>/          unreal · unity · godot · web
      <typ_assetu>/    environments · characters · animations · vfx · audio · props · materials · ui · blueprints · templates · scans (fotogrametria: RealityScan/Meshroom → modele ze zdjęć)
        <paczka>/      (pobrana paczka/projekt, np. ElectricDreams, StackOBot, NiagaraExamples)
```
Przykłady:
- `…/3d/unreal/environments/ElectricDreams/`
- `…/arpg/unreal/characters/MetaHumans/`
- `…/shared/unreal/vfx/NiagaraExamples/`  ← `shared` = używalne w każdym typie gry
- `…/2d/godot/tilesets/CozyVillage/`

## Jak Agent tego używa
1. **Katalog:** `GET /api/vault/catalog` → drzewo (gra→silnik→typ→paczki). Agent widzi cały zasób.
2. **Plan wdruku:** `POST /api/vault/plan {gameType, engine}` → które paczki pasują (źródłowe ścieżki),
   + `shared`. Agent wie, co wnieść do projektu.
3. **Wdruk do Overdrive (projektu docelowego):** paczki UE → **Migrate** (Content Browser → Migrate →
   `<projekt>/Content`) zachowuje zależności; po wdruku Forge → „🧱 Co agent widzi" daje ścieżki `/Game/...`.
   (Pełny projekt FAB jak Electric Dreams = osobny projekt → Migrate; patrz RUNBOOK.)

## Po co tak
- **Drive-agnostyczne:** każdy ma inne dyski; liczy się tylko `OTAKOS_ASSET_VAULT`.
- **Wielokrotne użycie:** jedna paczka `shared/unreal/vfx/Niagara` zasila 10 projektów — nie duplikujesz.
- **Równoległość:** Agenci tworzą wiele Overdrive'ów z tej samej Składnicy naraz.
- **Skill = powtarzalny czyn:** „wdrukuj środowisko 3D/unreal" to powtarzalny przepis (jak zalesianie).
