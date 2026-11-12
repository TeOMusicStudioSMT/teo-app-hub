# Drift report — CLAUDE.md (wycinek) · 2026-11-08

_Złota rybka: recenzent bez kontekstu rozmowy (EGM drift report)._

Wybór: 8 pierwszych punktów „Mapy modułów” z emoji, których nie było w żadnym wcześniejszym raporcie (poprzedni: 2026-11-01). Przegląd był tylko do odczytu kodu.

## 🏢 Firma Katedry / Cor-TeO
- No drift detected.
- Obok (to nie rozbieżność): skrzydło 💰 Sprzedaż pokazuje oprócz panelu kodów QR także Stół Produktowy (`components/…/WorkPalace.tsx:92`). Punkt mówi tylko „💰 Sprzedaż = panel kodów QR”.

## 🎼 Dyrygent
- [OPIS] Punkt mówi „`silnik: jev|model`”. Kod daje trzy wartości: `'jev'` (tryb `szybko` albo gdy rozstrzygnięcie padło), `'jev+model'` (Jev zawęża listę, rozstrzyga większy model lokalny) i `'model'` (`services/Dyrygent.js:209`, `:212`, `:214`, `:224`). Bez klucza TypeSafe zamiast Jev z chmury może zagrać Jev lokalny na embeddingach (`services/Dyrygent.js:201`). Kroki 2–3 opisuje dopiero osobny punkt „🎼 Dyrygent w trzech krokach”.
- [OPIS] Punkt mówi „`regulaScalajacych` podmienia ≤ 4B”. Dziś `regulaScalajacych` to tylko alias `regulyRol` (`services/Dyrygent.js:295`). Ta funkcja stosuje ogólne `WYMAGANIA_ROL`: scalający > 4,5 mld, Kodeks = model do kodu albo ≥ 7 mld, Wektor i Strażnik ≥ 8 mld (`services/Dyrygent.js:248–268`). Próg dla scalających się zgadza (`:249–250`, `:257`).

## 🎼 Dyrygent jako TeOgochi + baza silników
- No drift detected.

## 🗿 Bryła 3D na Stół + Studio Gier na modelu z przydziału
- No drift detected.

## 🎮 Droga gry w Game Studio
- [OPIS] Punkt mówi „7 gałęzi świata + Mini-TeOgochi”. Szablon `TETERHIA` ma dziś 9 gałęzi: postacie, stwory, ekwipunek, rekwizyty, budowle, krainy, wierzchowce, `otoczenie`, `mini-teogochi` (`services/SzablonyGier.js:106`, `:115`). Gałąź `otoczenie` doszła później (opisuje ją punkt „🌲 Otoczenie i roślinność wyspy”).
- [OPIS] Lista `STYLE_OBRAZU` w punkcie (pojedynczy, zestaw, postac, krajobraz) jest niepełna. W kodzie jest też styl `postac3d` (`services/Assety3D.js:263`).
- Drobiazg: parametr trasy nazywa się `:szablon`, nie `:id` — `POST /api/gdd/szablon/:szablon` (`wiesio-bridge.js:8485`).

## ⚒️ Kuźnia Soup
- No drift detected.

## 🧪 Kuźnia w Colabie
- No drift detected.

## 🔭 Zwiadowca HF
- No drift detected.
- Nie dało się sprawdzić bez uruchomienia: wymóg Ollamy ≥ 0.40.9 dla `flint` i rozmiar 23 GB w bibliotece Ollamy.

### Liczba rozbieżności
- 🏢 Firma Katedry / Cor-TeO: 0
- 🎼 Dyrygent: 2 (opis)
- 🎼 Dyrygent jako TeOgochi + baza silników: 0
- 🗿 Bryła 3D na Stół + Studio Gier: 0
- 🎮 Droga gry w Game Studio: 2 (opis) + 1 drobiazg
- ⚒️ Kuźnia Soup: 0
- 🧪 Kuźnia w Colabie: 0
- 🔭 Zwiadowca HF: 0

Brak rozbieżności typu „błąd w kodzie”. Każda trasa, którą punkty opisują jako „tylko maszyna”, ma wpis w `services/StrazMostu.js`.
