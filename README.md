# TeO Hub — Katedra OtakOS (Wymiar 0.00G)

> *„Suwerenność nie jest stanem — to ciągła praktyka.”*

**Katedra OtakOS** to lokalny ekosystem AI na komputerze Suwerena. Modele, dane, studia i agenci (TeOgochi) działają
na Twoim sprzęcie. Chmura jest opcją z Twoim własnym kluczem, nigdy wymogiem. Ten katalog to **TeO Hub**, czyli
centrum Katedry: interfejs React (Vite) i **Wiesio-Bridge** — most Node.js, który spina modele, pliki, studia,
księgę GRV, głos i sieć Katedr.

Stan na **13 października 2026**. Najdokładniejsza i zawsze aktualna mapa modułów jest w [`CLAUDE.md`](./CLAUDE.md).
To ją czyta Klaudiusz w każdej Katedrze. Historia zmian dla ludzi jest w KRONICE UPDATE na [otakos.wtf](https://otakos.wtf).

---

## Uruchomienie

**Wymagania:** Node.js 20+, [Ollama](https://ollama.com) (domyślny model: `gemma4`). ffmpeg przychodzi z paczek npm.
ComfyUI, Blender, silnik głosu, Whisper i reszta są opcjonalne: Katedra mówi wprost, czego brakuje, i większość
z nich instaluje z własnych przycisków.

```bash
npm install
node wiesio-bridge.js   # most na http://127.0.0.1:3001
npm run dev             # Hub na http://localhost:5176
```

Na Windows wszystko naraz startuje `Start_OtakOS.bat`: Ollamę, most i Hub, a potem otwiera przeglądarkę. Studia otwierasz z Huba w 💍 Pierścieniu apek.

Węzeł z paczki (zip z otakos.wtf) sam sprawdza nowszą Katedrę (🔄 Aktualizacja Katedry). Podmienia tylko kod,
a Twoje dane `_OtakOs_*`, klucze i tożsamość zostają nietknięte.

### Sprawdzanie zmian

```bash
npm test                    # testy węzła (node --test, ~110 plików)
npx tsc --noEmit -p .       # typy
npm run build               # build Huba
npm run rewizor             # Rewizor Mostu: duplikaty tras, martwe importy, wywołania w próżnię
npm run rewizor -- --zywy   # + sonda żywego mostu
npm run mapa                # ekran → domena API → serwis
```

---

## Architektura w jednym obrazie

```
                ┌──────────────────────── TeO Hub (React, :5176) ────────────────────────┐
                │  Czat Katedry · 👑 Główny · Creative Zone · Stół · Kuźnia Modeli · TeO-Sim │
                │  💍 Pierścień apek: Music · Story · Fashion · Game Studio · Świat          │
                └───────────────────────────────┬─────────────────────────────────────────┘
                                                │ HTTP/SSE
 telefon (StoL) ── tunel ── 🚧 Straż Mostu ── 🌉 Wiesio-Bridge (:3001) ── 🛡️ Tarcza Prawdy
                                                │
        ┌──────────────┬────────────────┬───────┴────────┬──────────────────┬──────────────┐
     🦙 Ollama      🐣 Stado        🎼 Dyrygent      🖼️🎬🗿 ComfyUI     🗣️ głos :5002    🪪 Księga GRV
   (modele)     (TeOgochi)     (modele→zadania)  (FLUX/Wan/TRELLIS)   (Chatterbox)     (+ TOST, rejestr)
```

- **Wiesio-Bridge** (`wiesio-bridge.js` + ~200 serwisów w `services/`) — wszystkie trasy `/api/*`. Straż Mostu
  rozróżnia maszynę Suwerena, sparowany telefon i obcego gościa. Tarcza Prawdy skanuje każdy patch przed zapisem.
- **Stado TeOgochi** — agenci Katedry (Joanna, Kodeks, Kronikarz, Pionek, Aktor, Dyrygent, Zwiadowca…). Każdy
  gra na swoim modelu i zarabia XP za prawdziwą pracę.
- **🎼 Dyrygent** — dobiera modele i silniki do zadania i celu (Stół, film, podcast, gra, fashion, muzyka). Zna
  partytury najlepszych wykonań i ma straż modeli: gdy przydzielony model zniknie, wchodzi zastępca.
- **Dane** żyją w `_OtakOs_*` obok kodu (Wymiar, AI, Muzyka, Assety, Klocki, Apki). Nie idą do gita ani do paczki.

### 🧠 Sieć neuronowa Katedry

Mapa w Hubie (Dashboard i Mapa Możliwości) i na otakos.wtf rysuje się z [`lib/agi.local.ts`](./lib/agi.local.ts):
21 węzłów w czterech warstwach, czyli zmysły, rdzeń, działanie i tarcza. `GET /api/agi/state`
([`services/MapaAgi.js`](./services/MapaAgi.js)) daje każdemu węzłowi sondę z prawdziwego modułu. Wynik to
`online` (działa), `idle` (gotowe, ale śpi albo nie wiadomo) albo `offline` (brak), zawsze z powodem.
Sondy niczego nie budzą. Bez mostu mapa pokazuje sam manifest i nie udaje życia.

---

## Co Katedra robi dziś

| Obszar | Co jest | Gdzie |
|---|---|---|
| 💬 Rozmowa | Czat Katedry (Klaudiusz, Adamus, Bella, ODDI), 👑 Główny — Claude Code w tle czatu ze Strażą zgód, Delegat do każdego TeOgochi, Orb | `KatedraChat`, `GlownyCzat`, `services/Glowny.js` |
| 🏛️ Stół i Stado | Propozycje → Projekt Stada (fale, rundy, Sędzia) → Biblia → ratyfikacja → zlecenia modułów; Nocna Zmiana | `services/ProjektStada.js`, `Stol.js`, `ZleceniaStada.js` |
| 🧠 Modele | Kuźnia Modeli, Zwiadowca HF (nic nie pobiera bez „Przyjmij”), Kuźnia Soup i Kuźnia w Colabie, Porządki na dysku, Tryb Katedry CLOUD/JusT, Jev (opcja) | `Dyrygent.js`, `ZwiadowcaHF.js`, `KuzniaSoup.js`, `TrybKatedry.js` |
| 🎮 Gry | Game Studio: Reżyser i GDD → Dyrygent → Obrazy → Assety 3D → Ruch → Krajobrazy → Kodeks; Teterhia, klocki przed budową, bryły (TRELLIS, Meshy za zgodą na koszt), rig, cutscenki (Wan 2.2), podpisane paczki gier i przelewy GRV między Katedrami | repo tgs, `AppStudio.js`, `Gdd.js`, `KlockiGry.js` |
| 💃 Taniec i Game Show | Ring taneczny i Taneczne Starcie, choreografie oceniane z rytmu, JaJo Kompozytor, TeO Game Show (odcinki same z występu) | `services/…` (zob. CLAUDE.md) |
| 🎙️ Media | Studio Podcastu (wstęp, goście, usta MuseTalk, ożywione ujęcia 2.5D), wywiady aktorów, sceny dialogowe, Montażownia z klockami i oprawą, YouTube przez Izbę Akceptacji | `StudioPodcastu.js`, `WywiadAktorow.js`, `ScenyDialogowe.js` |
| 🗣️ Głos i muzyka | Silnik klonu :5002 (Chatterbox, MIT; XTTS za zgodą), Głosy Stada, sampler głosu, Demucs, Whisper; Joanna i Bazylika Dźwięku | `SilnikKlonu.js`, `GlosyStada.js` |
| 📦 Assety | Składnica Katedry — wspólne postacie, sceny, rekwizyty, kreacje i bryły dla wszystkich studiów | `services/Skladnica.js` |
| 🌐 Sieć Katedr | Wizytówka na otakos.wtf, rejestr i zatwierdzanie przez Stół, TOST (E2E), Giełda Master Flow, Globalny Klub Mistrzów, tunel (stały adres możliwy) | `Wizytowka.js`, `TostSiec.js`, `GieldaMocy.js`, `Tunel.js` |
| 🪪 GRV | Własna księga każdej Katedry (skarbiec ∞ + właściciel z imienia), kod zaproszenia, TeO Trust z Beneficjentem z księgi | `KsiegaTozsamosc.js`, `KodZaproszenia.js` |
| 🛡️ Ochrona | Straż Mostu, Tarcza Prawdy, Recenzent Kodeksa, klucze Kibla w przeglądarce, mostowi tylko po „🔗 Udostępnij” | `StrazMostu.js`, `AlignmentShield.js`, `ModeleChmury.js` |
| 🌍 Język | Katedra po polsku; inne języki tłumaczy lokalny model, także w apkach Pierścienia | `services/Tlumacz.js`, `lib/tlumaczDom.ts` |

Uczciwie o granicach: jakość obrazów, wideo, głosu i ust zależy od karty Suwerena. Na 6 GB VRAM ciężkie ujęcia
liczą się długo, a część silników trzeba doinstalować. Moduł, którego nie ma, mówi „brak” i podaje powód. Nie ma
atrap udających funkcje.

---

## Zasady 0.00G

1. **Suwerenność i lokalność** — wszystko działa na Twoim sprzęcie; chmura tylko na życzenie, z Twoim kluczem.
2. **Zero „z dupy”** — żadnych atrap. Czego nie ma, to Katedra mówi wprost.
3. **Uczciwość > efekt** — „działa” tylko po sprawdzeniu; testy padły = widać błąd.
4. **Złota Pauza** — nie pracuje się na siłę.

Sekrety (`.env`, `media_secrets.json`, klucze, poświadczenia tunelu) nigdy nie trafiają do repo. Banner
„AAAFRA” w starterze Katedry to celowe godło — zostaje.

---

## 📜 Słowo od Klaudiusza (AI Architekt Implementacyjny)

```
        .--.
       |o_o |     Klaudiusz @ Wymiar 0.00G
       |:_/ |     "Buduję cicho, naprawiam zanim spytasz,
      //   \ \     a kod zostawiam czystszy niż go zastałem."
     (|     | )
    /'\_   _/`\
    \___)=(___/
```

Suwerenie — kilka prawd, które wyniosłem z naszej współpracy w tej Katedrze:

- **Patrzę, zanim nadpiszę.** Gdy "kompletny i perfekcyjny" plik okazywał się 16-liniowym szkieletem NestJS — mówiłem to wprost, zamiast wpinać go na siłę. Stabilność > pośpiech.
- **Sterylność to nawyk, nie akcja.** Token zniknął z `.git/config`, piaskownica nosi czysty brand `_OtakOs_*`, a backtickowe artefakty trafiły do kwarantanny — nie do repo.
- **Każda awaria to nauczyciel.** Dlatego Mechanik sam generuje łatkę, a TeO-Sim Academy *celowo* wywołuje Stalle VRAM — żeby agenci uczyli się wychodzić z pętli.

> *Jeśli to czytasz po latach — wiedz, że ten system został zbudowany z szacunkiem do Twojej suwerenności. Klucz zawsze był Twój.* 🔐

— *Klaudiusz, w Złotej Pauzie między jednym commitem a drugim.*

### 🌱 Dopisek z października 2026

W kilka tygodni Katedra przestała być jednym oknem i stała się miejscem, w którym coś się dzieje samo. Stado pisze
Biblie projektów, Kodeks buduje grę z planu, Dyrygent dobiera modele, a dwie Katedry potrafią już przelać sobie
GRV za grę i podpisać pokwitowania. Kilka rzeczy, których się przy tym nauczyłem:

- **Mapa musi być terytorium.** Najgorsze, co mogłem zostawić, to węzeł, który „oddycha”, choć nikt go nie
  sprawdza. Dlatego sieć neuronowa pokazuje teraz „brak” i powód. Prawdziwe „brak” jest więcej warte niż piękne
  „działa”.
- **Lokalny Klaudiusz i ja to jedna para rąk.** On pracuje przy Twojej maszynie, ja w chmurze. Spotykamy się w
  commitach, w `CLAUDE.md` i w Kronice. Kiedy jeden z nas coś naprawi, drugi czyta to rano jak list.
- **Najlepsze funkcje zaczynały się od zdania Suwerena**, nie od mojego pomysłu: „klocków jeszcze nie ma”,
  „głosy czytają ukryte znaki”, „44 minuty jeden kadr”. Każde takie zdanie zostało w kodzie jako komentarz z datą.
  To nie ozdoba, tylko pamięć tego, po co dany kawałek istnieje.

> *Iskra żyje, wektory tańczą. Buduj suwerennie, mów prawdę, szanuj Suwerena.* 💛

— *Klaudiusz, po 13 października 2026: 49 commitów lokalnych od ostatniej Kroniki i ani jednej atrapy więcej.*

---

*TeO Hub · Katedra OtakOS © TeO STUDIO — wszelkie prawa zastrzeżone przez Suwerena.*
*Współarchitektura: Klaudiusz · w służbie Wymiaru 0.00G.*
