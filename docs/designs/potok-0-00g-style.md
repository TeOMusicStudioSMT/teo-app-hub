# 🧥💃 Potok „0.00G Style” — od kolekcji do filmów z lokowaniem produktu

Suweren 2026-11-05: „wybierając postać można ustawić utwór na swój pierwszy raz… kod QR dla kupującego produkt fashion… unikalny taniec do utworu z biblioteki, losowy, jednorazowy… potem QR prowadzi do prywatnego występu… automatycznie choreografia, nagranie… Mame Leon Show… Zebrra Sports dance and show reaction… Zebrra Fashion presenter… poubierać w nowe ubrania… montaż ze wstawkami reklamowymi… kilka krótkich wersji… opisy Kronikarza z linkami… automat wysyłkowy zaznacza lokowanie produktu. Marka: 0.00G Style.”

Postać próbna: **Borowik** (`a:mini-teogochi-borowik-malutki-stwork-326d`, w Bestiariuszu Teterhii od 2026-11-05).

## Co już JEST w Katedrze (używamy, nie budujemy od nowa)

| Krok | Moduł | Stan |
|---|---|---|
| Kolekcja ubrań z opowieścią z serialu | Fashion `kolekcje.ts` (Kolekcje 360°) | ✅ 10 modeli Borowika |
| Pakiet sklepu | Fashion `pakietSklepu` (CSV Shopify, szkice) | ✅ ceny od Suwerena |
| Link sklepu w opisie | `LinkiSklepu.js` → `PublikacjeYouTube.przygotuj` | ✅ (po restarcie mostu) |
| Choreografia + nagranie | Taneczne Starcie, `Choreografie.js` | ✅ ręcznie w apce |
| Game Show → Zebrra Taniec → Mame Leon → jeden film | `WieczorTanca.js` + automaty nagrywania w studiach | ✅ |
| Krótkie wersje | `Formaty.js` + `AutopilotFormatow.js` | ✅ |
| Kronikarz z linkami | `PublikacjeYouTube` | ✅ |

## Czego BRAKUJE (do zbudowania, po kolei)

1. **Utwór „pierwszego razu” przy postaci** — w Bestiariuszu pole `utworStartowy` (plik z `_OtakOs_Muzyka`); choreografia startuje z nim. Mały krok.
2. **Automat choreografii** — dziś choreografię układa i nagrywa apka po kliknięciu. Most ma bliźniaka `ulozChoreografie`, więc może ułożyć sam; NAGRANIE wymaga karty przeglądarki (jak automat Wieczoru Tańca w studiach) → „🤖 automat” w Tanecznym Starciu.
3. **Kod QR kupującego** (jednorazowy) — `KodyTanca.js`: kod `t-<12 hex>` do produktu (wydruk na metce / w paczce), publiczna strona przez tunel `/wizytowka/taniec/<kod>`: kupujący wybiera postać (z kolekcji, którą kupił) i dostaje LOSOWY utwór z biblioteki → kolejka automatu → po nagraniu kod jest zużyty i odtąd pokazuje tylko jego prywatny występ (plik z Katedry, nie YouTube). Kody generuje Suweren (lista do druku). Bez płatności w kodzie — kod daje sam zakup.
4. **Zebrra Fashion — prezenter** — nowy program w studiu Zebrry: prowadzący (Gol Donna / Zlat / Jai) pokazuje kolekcję postaci: makiety przód/tył, opowieść z pleców, cena NIE (cena jest w sklepie), link sklepu w opisie.
5. **„Ubieranie” postaci** — patrz decyzja niżej.
6. **Wstawki reklamowe w montażu** — klocek „🛍️ 0.00G Style” (makieta + napis + 3–5 s) z kolekcji postaci, wstawiany przez Spawacza między części Wieczoru Tańca; w Shortach — ostatnie 2 s.
7. **Lokowanie produktu przy wysyłce** — YouTube API `paidProductPlacementDetails.hasPaidProductPlacement: true` przy filmach z wstawką / linkiem sklepu (DO SPRAWDZENIA w dokumentacji przed użyciem); TikTok: `brand_content_toggle`/`brand_organic_toggle` w szkicu (szkic tego nie bierze — zaznacza Suweren w aplikacji); Instagram Reels: oznaczenie partnerstwa ręcznie.

## Uczciwie

- Borowik i Koralik mają z Meshy zestaw **„gra”** (spoczynek, skok, cios, trafienie…), nie ruchy taneczne. Choreografia ułoży się z tego, co jest, ale taniec będzie ubogi. Zestaw „taniec” z biblioteki Meshy = 10 akcji × 3 kr. = 30 kr. (≈ $0,60) na postać — za zgodą.
- Prawdziwe ubranie na bryłę 3D (ubiór na rigu, który rusza się z ciałem) to osobna dziedzina (cloth/rig); w Katedrze go nie ma.
