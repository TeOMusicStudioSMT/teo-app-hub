# 💶 PAKIETY KATEDRY — zestawy „jedno kliknięcie" (model przychodu)

> Pomysł Suwerena (2026-06-30): sprzedajemy ZŁOŻENIE, nie cudze licencje. Pakiet pokazuje **realne koszty**
> (licencje/assety z linkami), a płacisz za **naszą pracę montażu** + instalator-przewodnik. To finansuje rozwój.
> Podstawy darmowe dla wszystkich; optymalizacja dla słabszych kompów wbudowana.

## Zasada (transparentność)
- Każdy składnik ma **realną cenę u źródła** (€0 jeśli darmowy) + link.
- **Nasza praca złożenia** = osobna, jawna pozycja (to za to płacisz).
- Instalator: jedno kliknięcie → pobiera darmowe, **prowadzi krok-po-kroku** do wykupienia płatnych licencji,
  migruje do Składnicy/projektu, odpala `build_island.py`/`build_all_genesis.py`.
- **Tier optymalizacji:** `basic` (placeholdery/lekko — słabe kompy) / `full` (Megascans Nanite — mocne kompy).

## Format pakietu (przykład — „Wyspa Starter")
```json
{
  "id": "wyspa-starter",
  "name": "Pakiet Wyspa Starter 0.00G",
  "tier": "full | basic",
  "components": [
    { "name": "Electric Dreams Env", "source": "FAB/Epic", "costEUR": 0, "url": "fab.com/...", "vault": "3d/unreal/environments/ElectricDreams" },
    { "name": "Niagara Examples Pack", "source": "FAB/Epic", "costEUR": 0, "url": "fab.com/...", "vault": "shared/unreal/vfx/NiagaraExamples" },
    { "name": "Game Animation Sample", "source": "FAB/Epic", "costEUR": 0, "url": "fab.com/...", "vault": "shared/unreal/animations/GameAnimation" },
    { "name": "NeoStack AI (opcja)", "source": "FAB/Betide", "costEUR": 114.60, "optional": true, "url": "fab.com/...", "note": "chmura — nie wymagany; rura lokalna wystarcza" }
  ],
  "assembly": { "ourWorkEUR": 0, "what": "skrypty build_island, Składnica, Reżyser-manifest, atmosfera, PlayerStart, instalator-przewodnik" },
  "install": [
    "1. Pobierz darmowe składniki (auto).",
    "2. (Opcja) Wykup płatne — instalator prowadzi do FAB.",
    "3. Migrate paczki → Składnica/Overdrive (wg ASSET_VAULT.md).",
    "4. Reżyser → Wklej film → Eksportuj → build_island.py → Play."
  ]
}
```
**Cena pakietu = suma realnych kosztów (jawna) + nasza praca złożenia.** Kupujący widzi, za co płaci.

## Etapy (na potem — gdy „większa faza budowy")
- Format `pakiet.json` + walidator (jak `storyManifest`).
- Most: `GET /api/pakiety` (katalog), `POST /api/pakiety/install` (pobierz darmowe + plan kroków płatnych).
- UI „Pakiety Katedry" + płatność za złożenie (Stripe/GRV-bridge). Wpięcie w Marketplace.
- Instalator-przewodnik: checklisty licencji (jak Kancelaria/Strażnik Licencji Epic), tier basic/full.

## Etos
Suwerennie i uczciwie: nie sprzedajemy cudzego, nie ukrywamy kosztów. Płacisz za czas i wiedzę złożenia —
i za to, że „działa jednym kliknięciem". Podstawa wolna dla wszystkich; HAJS finansuje rozwój dla wszystkich.
