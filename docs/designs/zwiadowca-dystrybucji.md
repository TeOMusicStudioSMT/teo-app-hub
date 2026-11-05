# 👕🔭 Zwiadowca kanałów dystrybucji — projekt etapu 1

_Suweren 2026-11-01: „dodać do Zwiadowcy możliwość wyszukiwania kanałów dystrybucyjnych… nasze uniwersum Teterhii i nasze Mini to już gotowe motywy na ubrania… potem Fashion… budować kreatywne bogactwo”._

## 1. Cel i rodzaje szukanych kanałów

Dotąd Katedra sprzedaje cyfrowe pakiety Mini przez Stripe (`services/SklepMini.js`, `services/Stripe.js`) oraz modele do druku 3D za GRV (`services/Merch.js`). Zwiadowca dystrybucji (`services/ZwiadowcaDystrybucji.js`, na wzór `services/ZwiadowcaPromocji.js`) szuka w sieci realnych kanałów sprzedaży fizycznych ubrań i gadżetów z motywami Teterhii, Mini-TeOgochi oraz (w kolejnych krokach) kreacji TeO Fashion Studio.

**Trzy kategorie zwiadu (`kategoria`):**
1. **`pod` (Print-on-Demand z integracją):** drukarnie na żądanie spinane ze sklepem Suwerena (szczególnie integracje z **Shopify**, który Suweren ma na żywo na `teo.center`, oraz API/WooCommerce) — np. Printful, Printify, Gelato, Shirtee, TPOP.
2. **`marketplace` (Marketplace'y dla twórców):** platformy z własnym ruchem, gdzie wgrywa się wzory, a platforma obsługuje druk, wysyłkę i płatność — np. Redbubble, Spreadshirt, Displate, TeePublic, Etsy (w połączeniu z POD).
3. **`sklep-tworcow` (Sklepy мерchowe dla twórców / gaming / VTuber):** platformy dedykowane społecznościom graczy i twórców wideo (integracja z YouTube Merch Shelf, Twitch, Discord) — np. Fourthwall, Spring, StreamElements Merch, UwU Market.

**Schemat pojedynczego znaleziska (`Kanał`):**
- `nazwa`: nazwa platformy/dostawcy (≤ 80 znaków),
- `link`: bezpośredni adres URL oferty/cennika/integracji (musi wystąpić w wynikach wyszukiwania),
- `kategoria`: `pod` | `marketplace` | `sklep-tworcow`,
- `model`: `POD` | `hurt` | `komis` (tylko z zamkniętej listy),
- `prowizjaKoszty`: tekst ze źródła o opłatach bazowych, abonamencie lub marży (albo `null`, gdy strona nie podaje — zero zgadywania liczb),
- `krajeWysylki`: informacja o wysyłce i centrach druku ze szczególnym uwzględnieniem **UE / Polski** (`wysylkaUE`: `true` | `false` | `null`),
- `integracje`: lista wspieranych połączeń wyczytana ze źródła (np. `["Shopify", "REST API", "YouTube"]`),
- `licencjaWzory`: zasady praw autorskich ze źródła (czy twórca zachowuje 100% praw do IP Teterhii/Mini, zakaz trenowania AI na wzorach, brak wyłączności; albo `null`),
- `wymagania`: progi wejścia (minimum zamówień, wymagana działalność/VAT UE, progi subskrybentów; albo `null`).

## 2. Sprawdzanie wyników (zero zmyśleń)

Silnik korzysta ze wzorca `ZwiadowcaPromocji.js` — trzy tryby dostawców (`auto`, `anthropic` przez `web_search_20250305`, `gemini` przez `google_search` grounding, `lokalny` przez DuckDuckGo/Reddit + Ollama):
- **Twarda weryfikacja źródła (`sprawdzKanaly`):** używa `zrodlaZOdpowiedzi` (Claude/lokalny) oraz `zrodlaZGroundingu` (Gemini). Wpis trafia do `przyjete` **tylko wtedy**, gdy jego `link` (dokładny adres `potwierdzone: 'adres'` lub domena z groundingu `potwierdzone: 'domena'`) faktycznie padł w wynikach wyszukiwania tego zapytania.
- Wpisy ze zmyślonym adresem lub spoza wyników wyszukiwania lądują w `odrzucone` z powodem: `„źródła nie było w wynikach wyszukiwania — możliwe zmyślenie”`.
- Każde znalezisko niesie metadane weryfikacji: `data` (data ze strony lub `wiekStrony`), `pewnosc`: `oficjalne` (strona/dokumentacja platformy — sortowane jako pierwsze) | `agregator` (porównywarki POD) | `forum` (Reddit/opinie twórców) oraz `koszt` zapytania (`wyszukan`, `tokenyWe`, `tokenyWy`, `usdWyszukiwania`).

## 3. Zapis na dysku, trasy mostu i panel UI

- **Plik stanu:** `_OtakOs_Wymiar/zwiadowca/dystrybucja.json` (`{ zwiady: [...] }` — historia do 30 ostatnich zwiadów, oraz `propozycje: [...]` — kanały wybrane do podłączenia). Przy błędzie parsowania JSON surowa odpowiedź trafia do `dystrybucja-ostatnia-odpowiedz.txt`.
- **Trasy mostu (Straż: tylko maszyna):**
  - `GET /api/zwiadowca/dystrybucja` — zwraca listę zwiadów, statusy propozycji kanałów oraz dostępnych dostawców (`anthropic`, `gemini`, `lokalny`),
  - `POST /api/zwiadowca/dystrybucja` `{ kategoria?, zapytanie?, kontekst?, dostawca? }` — uruchamia zwiad w sieci (domyślny kontekst dopisuje: *„ubrania i gadżety z motywami gry Teterhia i stworków Mini, wysyłka do UE, integracja z Shopify”*),
  - `POST /api/zwiadowca/dystrybucja/zaproponuj` `{ link, nazwa, notatka? }` — tworzy ze sprawdzonego znaleziska propozycję `do_zgody` („podłącz ten kanał”) dla Suwerena.
- **Panel UI:**
  - Kuźnia Modeli (`components/special/DyrygentIKuznia.tsx`, obok `🏷️ Zwiadowca promocji`) oraz zakładka w Marketplace obok `🖨️ Merch` (`components/special/PracowniaMerchu.tsx`): wybór kategorii (`POD + Shopify`, `Marketplace`, `Sklepy twórców`), wybór dostawcy (`☁️ auto / Claude / Gemini / 🏠 Lokalny`), tabela przyjętych kanałów z filtrem `🇪🇺 Wysyłka UE` i `🛍️ Shopify`, zwinięta sekcja odrzuconych oraz przycisk **„📥 Zaproponuj podłączenie (Izba zgód)”**.

## 4. Przepływ „Podłącz ten kanał” przez Izbę zgód

**Żelazna zasada bezpieczeństwa:** Zwiadowca **NIGDY** sam nie zakłada kont, nie podaje danych firmy/karty, nie płaci abonamentów, nie łączy się z API sklepu na żywo i nie wysyła żadnych wzorów Teterhii ani Mini.

1. Zgłoszenie kanału (z panelu lub po zleceniu stada) zapisuje wpis w `dystrybucja.json → propozycje` ze stanem `do_zgody` (id `kd-<8 hex>`).
2. `ZwiadowcaDystrybucji` rejestruje w `services/IzbaZgod.js` źródło:
   - `id: 'dystrybucja'`, `emoji: '👕'`, `nazwa: 'Kanały dystrybucji'`,
   - `czekajace()` — **czysty odczyt z dysku** (`dystrybucja.json`, bez zapytań sieciowych i bez skutków ubocznych, < 3 s): zwraca pozycje `do_zgody` z opisem (model, prowizja/koszty, wysyłka UE, integracje, licencja, zweryfikowany link) oraz akcjami:
     - `{ id: 'przyjmij', etykieta: '✓ Przyjmij do wdrożenia', zdalnie: true }`,
     - `{ id: 'odrzuc', etykieta: '✕ Odrzuć kanał', zdalnie: true }`.
     *(Flaga `zdalnie: true` jest bezpieczna, bo samo ✓ w Izbie nie wydaje pieniędzy ani kredytów — zatwierdza jedynie kierunek biznesowy i odkłada kanał na listę zaakceptowanych do ręcznego spięcia przez Suwerena).*
   - `decyduj(id, akcja, { powod })` — zmienia stan propozycji na `przyjeta` lub `odrzucona` (z powodem), zapisuje atomowo na dysku i notuje decyzję w `Jajo.decyzja` (`zrodlo: 'dystrybucja'`).
3. Zaakceptowany kanał (`przyjeta`) pojawia się w panelu jako **„✅ Zatwierdzony przez Suwerena — instrukcja podłączenia krok po kroku”** (checklista: założenie konta przez człowieka → pobranie klucza do Skarbca 0.00G / wpięcie aplikacji w Shopify na `teo.center`).

## 5. Testy na atrapie (`tests/zwiadowca-dystrybucji.test.mjs`)

1. **`sprawdzKanaly` (zero zmyśleń):** przyjmuje kanał z adresem obecnym w `web_search_tool_result` (Claude) oraz domeną w `groundingChunks` (Gemini); odrzuca kanał ze zmyślonym URL-em z jawnym powodem; sortuje `oficjalne` przed `agregator` i `forum`.
2. **Brak zgadywania pól:** nieznana wartość `model` wraca do domyślnego `POD`, brak prowizji/licencji daje `null` zamiast zmyślonego tekstu.
3. **Przełączanie dostawców (`auto`):** gdy atrapa `fetch` dla Anthropic zwróci błąd HTTP, zwiad automatycznie przełącza się na klucz Gemini, a wynik zapisuje koszt i listę w tymczasowym `dystrybucja.json`.
4. **Integracja z `IzbaZgod.js`:** `zaproponuj` tworzy pozycję tylko dla uprzednio potwierdzonego znaleziska; `czekajace()` w Izbie zwraca ją bez wywołań sieciowych; `decyduj('dystrybucja', id, 'przyjmij')` oraz `'odrzuc'` z powodem zmieniają stan i zdejmują pozycję z listy oczekujących.

## 6. Czego NIE robimy w etapie 1

- **Brak automatycznych integracji API z drukarniami POD** (żadnego automatycznego wypychania produktów do Printful/Printify/Shopify — to osobny etap po wyborze dostawcy przez Suwerena).
- **Brak generatora mockupów ubrań i przygotowania plików produkcyjnych CMYK / 300 DPI** (etap Fashion Studio).
- **Brak zakładania kont, płatności i obsługi zamówień klientów** (Zwiadowca tylko bada rynek i podaje zweryfikowane fakty).
