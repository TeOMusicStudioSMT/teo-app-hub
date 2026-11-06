# Cor-TeO & GRV (Graviton): Whitepaper

**Wersja 1 · 2026-11-06 · teo.center · otakos.wtf · teostory.studio**

> Dokument opisuje **stan kodu Katedry OtakOS** w dniu wydania. Rzeczy planowane są oznaczone 🗺️.
> Ocena prawna i podatkowa jest stanowiskiem projektu, nie poradą prawną. Potwierdza ją Steuerberater albo prawnik.

## 1. Streszczenie

**PL:** Cor-TeO to jednoosobowa firma (Einzelunternehmen, NRW, Kleinunternehmer wg § 19 UStG). Działa na lokalnej, wieloagentowej platformie **OtakOS** („Katedra”). Ma trzy filary handlowe:

1. **0.00G Style**: odzież print-on-demand z kolekcjami 360°. Na każdej metce jest jednorazowy kod QR do prywatnego występu tanecznego postaci 3D (`qr.teo.center`).
2. **teostory.studio**: wypożyczalnia Żywych Ksiąg, czyli interaktywnych opowieści 2.5D. Wypożyczenie na 48 h jest płatne w EUR przez Stripe.
3. **WORKPalace**: pięć skrzydeł firmy, czyli agenci i panele zarządcze. Do tego **Jajo Założyciela** jako szablon profilu biznesu dla każdej Katedry.

Wewnętrzną jednostką użytkową jest **GRV (Graviton)**: punkty bez wartości pieniężnej, zapisywane w księdze każdej Katedry osobno.

**EN:** Cor-TeO is a sole proprietorship in North Rhine-Westphalia, Germany, operating under the small-business rule (§ 19 UStG). It runs on OtakOS, a local multi-agent platform. Its three commercial pillars are:

- 0.00G Style: print-on-demand apparel whose tags carry single-use QR codes that unlock a private 3D dance video;
- teostory.studio: 48-hour rentals of interactive 2.5D storybooks, paid in EUR via Stripe;
- WORKPalace: a five-wing business workspace, plus the Founder's Egg business-profile template.

GRV (Graviton) is a closed-loop utility point with no monetary value. Each node keeps its own ledger.

**DE:** Cor-TeO ist ein Einzelunternehmen in NRW (Kreis Kleve, Kleinunternehmerregelung gem. § 19 UStG). Es verbindet drei Bereiche:

- Print-on-Demand-Mode (0.00G Style) mit QR-gesteuerten 3D-Tanzvideos;
- digitale Mitmach-Bücher zur 48-Stunden-Ausleihe (teostory.studio), bezahlt in EUR über Stripe;
- eine modulare Unternehmensoberfläche (WORKPalace).

GRV sind interne Nutzungspunkte ohne Geldwert und ohne Auszahlungsanspruch.

## 2. Struktura Cor-TeO: 5 skrzydeł WORKPalace

WORKPalace (Dom TeOgochi → WORKPalace) dzieli meldunki i panele na skrzydła. Wybór skrzydła zapamiętuje się w przeglądarce.

| Skrzydło | Moduły Katedry (w kodzie) | Zakres |
|---|---|---|
| 🎨 Kreacja | Reżyser, Paleta (FLUX), Joanna, JaJo Kompozytor, Jason, Dyrygent, Assety 3D | Żywe Księgi, muzyka, bryły i tańce 3D, projekty kolekcji 360° (TeO Fashion Studio) |
| 📣 Marketing | Kronikarz, Formaty i sieci, Zebrra Fashion, Wieczór Tańca, Impresariat | Odcinki i spoty kolekcji, opisy PL/EN, oznaczenie lokowania produktu na YouTube (`paidProductPlacementDetails`) |
| 💰 Sprzedaż | Panel kodów QR tańca, pakiet eksportowy Shopify | Arkusz A4: 21 metek (3 × 7, ok. 70 × 42 mm) z kodem QR i opcjonalnym bonusem GRV. Paczki produktów S–XXL. Ceny kolekcji: od 29 EUR (torba) do 119 EUR (varsity, ramoneska) |
| ⚖️ Zarząd | 🥚 Jajo Założyciela, 💰 Skarbnik, ⚖️ Mecenas | Profil biznesu. Przychody z Stripe i wpisy ręczne. Progi § 19 UStG (25 000 EUR za poprzedni rok, 100 000 EUR za bieżący). Szkice Impressum, Datenschutz i AGB po niemiecku i angielsku |
| 🛠️ Serwis & QC | QC szwalni (Krawcowa), Straż Mostu, Tunel | Maska materiału: nadruk nie wychodzi poza tkaninę. Pliki druku 300 DPI z wymiarami w cm (przybliżenie z rozmiaru M). Nadzór tunelu |

**Jajo Założyciela** (`_OtakOs_Wymiar/firma/profil-biznesu.json`) to szablon, nie dane Cor-TeO. Każda Katedra wpisuje własną firmę, kraj, formę i progi, a Skarbnik i Mecenas liczą pod nią. Dane osobowe zostają w Katedrze i wychodzą tylko w szkicach dokumentów.

## 3. GRV (Graviton): mechanika

### 3.1 Czym GRV jest

- **Punkty użytkowe w zamkniętym obiegu.** GRV nie mają wartości pieniężnej, nie wymienia się ich na pieniądze i nie da się ich kupić za EUR.
- **Każda Katedra ma własną księgę** (`KsiegaTozsamosc`) z unikalnym skarbcem i właścicielem. Między księgami GRV nie przepływają same. Ruch między Katedrami to dwa wpisy (po jednym w każdej księdze), spięte podpisami ed25519 kluczy z publicznego rejestru Katedr.
- **Każdy ruch w księdze ma pieczęć** z rodzajem operacji (np. `register`, `rozliczenie-katedr`).

### 3.2 Start nowego węzła

| Sytuacja | GRV |
|---|---|
| Nowa Katedra, właściciel zakłada węzeł imieniem | **1 000 GRV** |
| Z kodem zaproszenia (jedno słowo, raz na księgę) | **12 345 GRV** zamiast 1 000 |
| Z bonusem z metki 0.00G Style | **+ kwota bonusu** (rozdział 3.3) |

### 3.3 Bonus GRV z metki QR (0.00G Style)

1. **Kod tańca.** Kupujący skanuje kod z metki: `https://qr.teo.center/wizytowka/taniec/<kod>`. Wybiera tancerza, a automat Katedry losuje utwór i nagrywa prywatny taniec. Film widać tylko pod tym kodem, a kod jest jednorazowy.
2. **Odsłonięcie bonusu.** Kod bonusu `b-<16 hex>@qr.teo.center` pojawia się dopiero po wyborze tancerza.
3. **Odbiór przy zakładaniu własnej Katedry.** Katedra kupującego wysyła zapytanie `POST https://qr.teo.center/wizytowka/grv-bonus/<kod>`. Katedra wystawcy:
   - oddaje kwotę podpisaną kluczem ed25519 swojej wizytówki;
   - przyjmuje odbiór raz;
   - ogranicza zapytania do 5 na minutę.

   Katedra kupującego sprawdza podpis kluczem z wizytówki wystawcy i dopisuje kwotę **we własnej księdze**. Zły podpis albo kod już odebrany oznacza odmowę: nic nie zostaje założone.

**Wysokość bonusu** wybiera wystawca przy drukowaniu partii kodów (panel: 0 / 1 000 / 2 500 / 5 000 GRV, technicznie najwyżej 100 000). Rekomendowane przypisanie dla 0.00G Style:

| Produkt | Bonus |
|---|---|
| Torba, koszulka | +1 000 GRV |
| Bluza, longsleeve | +2 500 GRV |
| Kurtki (varsity, ramoneska, jeansowa, bomber), płaszcz, parka | +5 000 GRV |

**Uczciwie:** cały przepływ sprawdzono testami (podpis, jednorazowość, podszyty podpis odrzucony). Między dwiema prawdziwymi Katedrami bonus jeszcze nie został odebrany, bo w rejestrze jest dziś jedna.

### 3.4 Użyteczność GRV

| Operacja | GRV | Stan |
|---|---|---|
| Start węzła | +1 000 | ✅ działa |
| Bonus z metki | +1 000 … +5 000 | ✅ działa (testy) |
| Nagrody stada (XP za pracę) | XP, nie GRV | ✅ osobny licznik |
| Zakup w Marketplace Katedry | cena produktu | ✅ działa lokalnie |
| Zakup gry od innej Katedry (przelew między księgami) | cena gry, np. 333 | ✅ działa (testy; między dwiema żywymi Katedrami jeszcze nie) |
| Wypożyczenie Żywej Księgi 48 h | — | 💶 tylko EUR przez Stripe. 🗺️ Wariant za GRV niezrobiony |
| Dodatkowy taniec 3D na życzenie | 🗺️ ok. 200 | niezrobione (dziś: jeden taniec na kod) |
| Personalizacja opowieści przez Kronikarza | 🗺️ ok. 300 | niezrobione |
| Eksport szablonu biznesu (Jajo Założyciela) | 🗺️ ok. 500 | niezrobione (dziś szablon jest darmowy w każdej Katedrze) |

## 4. Zgodność i mapa drogowa

### Faza 1: dziś

- **GRV** to punkty w grze i w ekosystemie. AGB generowane przez Mecenasa (§ 6) mówią: bez wartości pieniężnej i bez prawa do wypłaty.
- **Zamierzenie projektu:** GRV nie są pieniądzem elektronicznym, instrumentem finansowym ani kryptoaktywem (MiCA, BaFin), bo nie da się ich kupić, sprzedać ani wymienić. Tę ocenę potwierdza doradca przed każdą zmianą zasad.
- **Przychody w EUR:** sprzedaż odzieży (Shopify, wpisy ręczne) i wypożyczenia przez Stripe. Skarbnik prowadzi je w reżimie Kleinunternehmerregelung i pilnuje progów 25 000 / 100 000 EUR.
- **Bez wpływu na rozliczenia:** bonus GRV jest darmowym dodatkiem do towaru. Nie zmienia ceny i nie jest osobną sprzedażą.

### 🗺️ Faza 2: wizja, nie zobowiązanie

- **Rynek twórców:** Katedry wymieniają się zasobami (ruchy 3D, opowieści, szablony) za GRV. Obecne podpisy ed25519 i rejestr Katedr są pod to fundamentem.
- **Przy zmianie formy prawnej** (np. UG/GmbH) projekt rozważy ewentualne połączenie GRV z zewnętrznym tokenem użytkowym. To wymagałoby nowej oceny prawnej (MiCA) i zmiany AGB. Dziś nic takiego nie istnieje.

## 5. Gdzie to jest w kodzie

| Element | Plik |
|---|---|
| Profil, Skarbnik, Mecenas | `services/Firma.js`, `components/special/FirmaPanel.tsx` |
| Księga GRV, właściciel, start 1 000 | `services/KsiegaTozsamosc.js`, `wiesio-bridge.js` (`/api/grv/register`) |
| Kody tańca i bonus po stronie wystawcy | `services/KodyTanca.js` |
| Odbiór bonusu po stronie kupującego | `services/BonusGrv.js` |
| Przelewy GRV między Katedrami | `services/RozliczeniaKatedr.js` |
| QC szwalni | `TeO_Fashion_Studio/kontrolaSzwalni.ts` |

Testy: `tests/firma.test.mjs`, `tests/bonus-grv.test.mjs`, `tests/kody-tanca.test.mjs`, `tests/rozliczenia-katedr.test.mjs`.
