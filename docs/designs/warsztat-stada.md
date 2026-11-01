# 🛠️ Warsztat Stada w Teterhii + 📥 Izba zgód — projekt v2 (po przeglądzie złotych rybek)

_Suweren 2026-11-01: „czy mogłyby ulepszać modele w grze: drzew, skał, wody, statków, chmury, oświetlenie… swoje avatary” + „te zatwierdzenia niech idą na StoL… bo się nam to rozrasta, powoli nie ogarniam tej Kuwety”._
_Metoda Elephant-Goldfish: v1 napisał słoń (Klaudiusz); przegląd zrobiły trzy złote rybki bez rozmowy (architektura, gotowość wdrożenia, zakres) — v2 przyjmuje ich uwagi. Decyzja: Suweren._

## 0. Co zmieniło się po przeglądzie (v1 → v2)

- **Nie ma nowej zakładki w telefonie.** StoL już ma jedną zakładkę „Izba Akceptacji” (karty Stołu, YouTube, rejestr Katedr). Izba w moście ZASTĘPUJE jej źródła danych — ekranów ubywa, nie przybywa.
- **Etap 1 trzy razy mniejszy:** jedna dziedzina (woda), jedno wejście (nocny robot), bez chmur, statków, gęstości, gości, recenzji przepisu modelem, pamięci gustu i zmian na żywo.
- **Gęstość roślin i skał wycięta z etapu 1** — dziś jedno losowanie ustawia wszystko na wyspie, więc zmiana gęstości przesunęłaby WSZYSTKIE drzewa i głazy, a zapisane „ścięte drzewa” (po pozycji) by wróciły. Wymaga osobnego losowania per rodzaj — etap 2, osobny przegląd.
- **Przepis = baza, mechanika dalej działa:** barwa świata (blednięcie od Zgrzytu) dalej mnoży nasycenie — przepis podmienia tylko bazowy odcień/jasność, wpięty w `ustawBarwe`, nie obok.
- **Izba nie omija Straży:** każda akcja źródła ma flagę `zdalnie` (domyślnie NIE) — z telefonu widać kartę, ale akcje kosztowne (GPU, kredyty) zostają przy komputerze, dopóki Suweren wprost tego nie zmieni.
- **Skutki decyzji w serwisie, nie w trasie:** wpis do JaJa przy ✓/✕ publikacji siedzi dziś w trasie — wyniesiony do wspólnej funkcji, żeby ✓ z Izby i z Huba robiły dokładnie to samo (test: jedno ✓ = jeden wpis).

## 1. Cel i granice etapu 1

**Cel.** (a) Wszystkie zgody z obsługiwanych źródeł w jednej liście w StoL. (b) Stado proponuje wygląd wody Teterhii, Suweren ✓ w telefonie, woda się zmienia.
**Poza etapem 1:** inne dziedziny, chmury, statki, gęstość, avatary, goście z innych Katedr (widzą wartości z kodu), propozycje z rozmowy w grze, Złota Rybka przepisu, pamięć gustu.

## 2. 📥 Izba zgód (most: `services/IzbaZgod.js`)

**Kontrakt źródła** `{ id, nazwa, emoji, czekajace(): Promise<Pozycja[]>, decyduj(id, akcja, {powod}) }`:
- `czekajace()` = CZYSTY ODCZYT z dysku — bez sieci, bez zapisu, bez kolejkowania (np. NIE `PublikacjeYT.sprawdz()`, które wznawia wysyłki).
- `Pozycja` = `{ zrodlo, id (złożone id kodowane `encodeURIComponent`), tytul, opis ≤ 600, kiedy, pilne?, obrazy?: [{etykieta, sciezka}], akcje: [{id, etykieta, zdalnie=false, potwierdz?}] }`. Etap 1 używa akcji `przyjmij` / `odrzuc` (z powodem).
- `GET /api/izba` → pozycje ze wszystkich źródeł (`Promise.allSettled`, limit 3 s na źródło; padło/przekroczyło = wpis „🔇 nie odczytałem: <źródło> — <powód>”), sortowanie: pilne, potem najstarsze; liczba per źródło; lista zarejestrowanych źródeł.
- `POST /api/izba/:zrodlo/:id/:akcja {powod?}` → `decyduj`; akcja `zdalnie: false` z tunelu = 403 „ta decyzja tylko przy Katedrze”.
- `GET /api/izba/obraz/:zrodlo/:id/:nr` → podgląd (tylko ścieżki zgłoszone przez źródło).
- Dostęp: maszyna albo sparowany telefon — `dostepStada(req,res)` w trasach (jak `/api/stol`).
- Źródła etapu 1: **publikacje YouTube** (`etap === 'do_akceptacji'`; ✓/✕ przez wspólną funkcję z JaJem i powodem — `PublikacjeYT.odrzuc` dostaje `powod`), **Katedry z rejestru** (`ZarzadcaRejestru.przeglad().oczekujace`, id = `nick|klucz`; tylko w Katedrze zarządcy), **Warsztat Stada**. Później, źródło po źródle: karty Stołu, Sklep Mini, Stała Obsada. Złota Rybka GDD zostaje w Game Studio (wymaga edycji treści przy biurku).
- **StoL:** istniejąca zakładka „Izba Akceptacji” przechodzi na `/api/izba` (model `PozycjaIzby`, `MostKlient.izba/izbaDecyzja`, obrazy przez `X-Stado-Token` jak `plikWpisu`); stare sekcje YouTube/rejestr znikają w tym samym kroku. Karty Stołu na razie dalej po staremu.
- **Powiadomienia:** Izba przy nowej pozycji nadaje wieść kanałem Mistrza (`Jajo.wiesc`, rodzaj `izba`) — istniejący robotnik StoL (co 15 min) ją pokaże. Zbiorczo, bez nowego mechanizmu.
- **Poranny brief:** dodatkowe źródło `wez('izba','/api/izba')` dla zarejestrowanych; niezmigrowane (Stół, Sklep, odcinki) liczy dalej po staremu — bez podwójnych.

## 3. 🛠️ Warsztat Stada — etap 1: woda

**Przepis.** `{ wersja_schematu: 1, warstwy: { woda: { autor, wersja, barwa: [odcień 160–240, nasycenie 0.2–1, jasność 0.2–0.55], przezroczystosc 0.55–0.95, polysk 0–1 } } }`; `polysk` → `roughness = 1 − polysk × 0.9`. Tylko liczby w zakresach (przycinane — lista przyciętych pól idzie na kartę zgody); brak pola = wartość z kodu.
**Jedna tabela zakresów:** `teterhia-wieczna-saga/src/zakresyStylu.json` — gra importuje, most czyta w czasie działania z `_OtakOs_Apki/…`; test mostu pada, gdy pliku brak. Gra przycina i ignoruje nieznane pola (stare paczki gości się nie wywrócą).

**Propozycja** (`services/WarsztatStada.js`):
1. Wejście etapu 1: nocny przebieg w samym serwisie (raz na noc, `OTAKOS_WARSZTAT_STADA=0` wyłącza) + `POST /api/warsztat-stada/zaproponuj {dziedzina}` do ręcznego testu i MCP. Najwyżej 1 propozycja na noc; dziedzina z propozycją czekającą = pomijana; propozycja wygasa po 7 dniach (stan `wygasla`).
2. Autor: TeOgochi **Paleta**, tylko gdy wyklute (inaczej przebieg pomija z powodem w dzienniku). Model: przydział Palety, tylko lokalny w nocy (chmura tylko ręcznie). Prompt: karta persony + OSOBNY blok dziedziny „wygląd wody w grze” (persona nie ciągnie w bok), obecna warstwa z wartościami, zakresy z tabeli. Odpowiedź JSON (`wylowJson` — działa dla każdego dostawcy) `{zmiany, uzasadnienie}` → `oczyscPrzepis` → zła = jedna poprawka z błędem, potem błąd wprost (wzór `FiguryTanca`).
3. Podgląd: NOWA funkcja `zrzutPrzepisu(gra, {przepis, kadr: 'woda'})` w AppStudio — bez klawiszy, stały kadr i `pora=dzien`, `nasycenie=100`, przepis podany WPROST w URL (`?przepisJson=` — pod puppeteerem gra nie dostaje `/api/*`, `trybTestu.ts`), gotowość przez `window.__gra`, dwa pliki `zrzuty/<id>-{teraz,po}.png`, nic nie kasuje; wspólny Chrome z testami gry; brak kadru = karta bez obrazów z powodem.
4. Stan: `czeka` → `do_zgody` → `przyjeta` | `odrzucona` | `wygasla` | `blad`; duch po restarcie = błąd (wzór `ZlotaRybka`). `_OtakOs_Wymiar/warsztat-stada/{przepis.json, przepis.poprzedni.json, propozycje/<id>.json, zrzuty/}`.
5. ✓: propozycja niesie `bazaWersji` warstwy — inna wersja = „nieaktualna, poproś ponownie”; zapis po kolei + atomowo (plik tymczasowy → rename); poprzednia warstwa do `przepis.poprzedni.json` (↩ cofnij warstwę); XP przez `nagrodaZaPrace` (20 XP, klucz `warsztat:<id>` — drugie ✓ nic nie dodaje); `Jajo.decyzja` (zrodlo `warsztat`, dopisane do `ZRODLA`) i wieść. ✕: decyzja z powodem w pliku propozycji (przyszła pamięć gustu).
6. Trasy (`/api/warsztat-stada` — maszyna; Izba = jedyna droga z telefonu): `GET /przepis`, `GET /propozycje`, `POST /zaproponuj`, `POST /cofnij {warstwa}`, `PUT /wlaczony {tak|nie}`.

**Gra** (`teterhia-wieczna-saga`): `src/stylSwiata.ts` — przepis przy STARCIE (`GET /api/warsztat-stada/przepis`, cisza = kod; `?przepisJson=` dla podglądu; `?przepis=0` = wyłącznik), `oczyscPrzepis` na `zakresyStylu.json`, `barwaWody(nasycenie)` wołane w `ustawBarwe` (`swiat3d.ts`), `opacity`/`roughness` w `zbudujWyspe`. Podgląd z `?przepisJson` wyłącza autozapis. Gość: wartości z kodu.

## 4. Później (każde z własnym przeglądem)

1. Niebo i światło (`doba.ts` — przepis jako MNOŻNIK w `krokDoby`, bo moc słońca liczona co klatkę; barwa dnia w `ustawBarwe`).
2. Barwy roślinności i skał (bez gęstości) — przeliczenie odcieni w `ubarwRoslinnosc`.
3. Gęstość — po przebudowie losowania per rodzaj × kafel; tylko trawa/trzcina/krzew (nie surowce); budżet instancji na telefon.
4. Statek (wzory żagli = nowy generator canvas), chmury (`chmury.ts`), latarnia jako światło, cienie — nowe elementy gry.
5. Goście z innych Katedr: `/wizytowka/przepis-swiata` + `czyWizytowka` + `trybGoscia`; wyspa gospodarza z tunelu gospodarza.
6. Pamięć gustu, Złota Rybka przepisu, propozycje z rozmowy z TeOsimem, więcej źródeł Izby, avatary TeOsimów (GPU — akcje `zdalnie` tylko za wyraźną zgodą Suwerena na zmianę polityki Straży).

## 5. Plan wdrożenia etapu 1

1. `IzbaZgod.js` + trasy + źródło YouTube (JaJo wydzielone do wspólnej funkcji, `odrzuc` z powodem) + źródło rejestru + `tests/izba-zgod.test.mjs` (atrapy: źródło pada → „nie odczytałem”, limit czasu, sortowanie, `zdalnie`, jedno ✓ = jeden wpis JaJo).
2. StoL: `Izba.kt` + `MostKlient` + przepięcie istniejącej Izby Akceptacji (test parsowania w `MostTest.kt`).
3. Gra: `zakresyStylu.json`, `stylSwiata.ts`, woda w `ustawBarwe`; test bliźniaka.
4. `WarsztatStada.js` + `zrzutPrzepisu` + źródło Izby + testy (atrapa modelu, wersje, cofanie, XP raz).
5. Wieść do StoL, wpis w Porannym briefie, CLAUDE.md.

**Miary etapu 1:** odsetek propozycji przechodzących `oczyscPrzepis` za pierwszym razem, odsetek ✓, czas od propozycji do decyzji; Suweren ma JEDNO miejsce na zgody YouTube + rejestr + Warsztat.

## 6. Domyślne odpowiedzi (zamiast pytań)

1 propozycja na noc łącznie · jeden przepis na archipelag · goście widzą kod (etap 1) · powiadomienia zbiorczo (kanał Mistrza, ~15 min) · propozycje wygasają po 7 dniach.
**Jedyna decyzja Suwerena:** etap 1 = sama woda (zalecane — najmniej ryzyka) czy woda + niebo/światło.
