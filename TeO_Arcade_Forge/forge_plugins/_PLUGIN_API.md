# 🔌 Kontrakt wtyczek Reżysera (forge_plugins/)

> Wtyczka = mod do generatora świata. Kompilator `story_compiler.py` ładuje wtyczki
> wskazane w manifeście filmu (`scene.plugins[]`) i woła je dla każdej sceny.
> **Etos 0.00G:** wtyczki są jawne, idempotentne i lokalne. Mody można robić, wystawiać
> i brać z Marketplace za GRV (Etap II) — ale kod zawsze widać.

## Plik wtyczki
Jeden plik `.py` w `forge_plugins/`. Nazwa pliku (bez `.py`) = **id wtyczki** w manifeście.
Nagłówkowy docstring = opis pokazywany w UI (pierwsza linia).

## Kontrakt — JEDNA funkcja
```python
def apply(ctx, params):
    """Krótki opis moda (pokazywany w UI Reżysera)."""
    ...
```
- `params` — dict z manifestu (`scene.plugins[].params`), może być pusty. ZAWSZE czytaj z domyślnymi
  (`params.get('count', 6)`), nigdy nie zakładaj obecności klucza.
- Zwracana wartość ignorowana. Błędy łapie kompilator (`try/except` per wtyczka) i raportuje —
  ale rób też własne zabezpieczenia.

## `ctx` — co dostajesz od kompilatora
| pole | typ | znaczenie |
|------|-----|-----------|
| `ctx.unreal` | moduł | `import unreal` (nie importuj sam — bierz stąd) |
| `ctx.fos(cls, label, loc)` | fn | find-or-spawn aktora po etykiecie (idempotentne) |
| `ctx.find(label)` | fn | znajdź aktora po etykiecie lub `None` |
| `ctx.origin` | Vector | punkt zaczepienia sceny (offset) — dodawaj do swoich pozycji |
| `ctx.scene_id` | str | id sceny (do unikalnych etykiet przy wielu scenach) |
| `ctx.log(msg)` | fn | log do konsoli UE z prefiksem wtyczki |

## Zasady (KRYTYCZNE — by nic się nie psuło)
1. **Idempotencja:** każdy aktor ma STAŁĄ, unikalną etykietę. Konwencja: `Plugin_<id>_<scene_id>_<co>`.
   Dzięki temu ponowne uruchomienie nie dubluje (kompilator może odpalać wielokrotnie).
2. **Kolory 0-255:** `unreal.Color(r,g,b,a)` przyjmuje 0-255, NIE 0-1 (fiolet = `Color(140,0,255,255)`).
3. **NIE zeruj DirectionalLight** (czarny ekran). Mesh musi mieć przypisaną siatkę, inaczej niewidoczny.
4. **Nie zapisuj poziomu** (`save_current_level`) — robi to kompilator na końcu.
5. Trzymaj się swojego prefiksu etykiet — nie ruszaj cudzych aktorów (`Sun_`, `Gate_`, `Aether_`…).

## Minimalny przykład
```python
def apply(ctx, params):
    """Jedna świecąca kula nad sceną."""
    u = ctx.unreal
    n = int(params.get('count', 1))
    for i in range(n):
        loc = ctx.origin + u.Vector(0, i * 120, 400)
        orb = ctx.fos(u.PointLight, "Plugin_orb_%s_%d" % (ctx.scene_id, i), loc)
        orb.get_component_by_class(u.PointLightComponent).set_light_color(u.Color(0, 255, 180, 255))
    ctx.log("orb: postawiono %d kul." % n)
```

Gotowe przykłady obok: `rain_neon.py`, `floating_props.py`.
