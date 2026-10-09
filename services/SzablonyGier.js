/**
 * 📜 Szablony gier — scenariusze Suwerena jako GOTOWE projekty Studia Gier (AppStudio + GDD + gałęzie świata).
 *
 * Suweren 2026-10-06: „Napisz mi ten scenariusz do gry mej wizji, wbuduj jako projekt… gra typu WoW forever, zbudowana
 * z Reżyserem, potem Dyrygent, potem tworzenie (obrazy, assety 3D, ruch, krajobrazy)… finalnie gra dla pojedynczego
 * gracza… a na otakos.wtf MRPG — budowa wspólnego świata Katedr w grze”.
 *
 * Teterhia rośnie z tego, co JUŻ jest w TGS (repo tgs, src/gra/*): Brama „To Get Sauce” (żywioł, droga, wkładki →
 * ziarno świata), nasycenie = barwa i widoczność sekretów, mGRV + EXP, umiejętności tylko z questów, Kustosz Teterhii
 * (lokalny model, /api/tgs/quest), Plecak = Katedra. Scenariusz tego nie wymyśla od nowa — nadaje temu sagę, krainy,
 * wrogów i drogę do MRPG. Pełna wersja do czytania: repo tgs, docs/TETERHIA_WIECZNA_SAGA.md.
 *
 * `zasiej` zakłada projekt gry RAZ (drugi raz zwraca istniejący, GDD Suwerena nie jest nadpisywane bez `nadpisz`).
 */
export const TETERHIA = {
    id: 'teterhia',
    nazwa: 'Teterhia — Wieczna Saga',
    opis: 'RPG otwartego świata w duchu wiecznych sag MMO: najpierw dla jednego gracza w jego Katedrze, potem MRPG — każda Katedra to kraina wspólnej Teterhii na otakos.wtf.',
    gdd: {
        tytul: 'Teterhia — Wieczna Saga (TGS: To Get Sauce → TeO Great Show)',
        gatunek: 'action RPG otwartego świata, saga bez końca (single player → MRPG Katedr)',
        silnik: 'three',
        perspektywa: 'trzecia osoba, kamera podążająca zza pleców (izometria jako tryb mapy)',
        platformy: ['przeglądarka', 'Katedra (most :3001)'],
        sekcje: {
            wizja: `Świat, który nie istnieje, dopóki go nie wyśpiewasz. Gracz przechodzi przez Bramę „To Get Sauce” i Teterhia rodzi się z jego żywiołu, drogi i słów — ta sama postać zawsze daje ten sam świat, inna postać inny.
Saga w duchu „wiecznych” MMO (stałe krainy, frakcje, Strażnicy, sezony, kronika), ale serce jest inne: autentyczność. Wybory autentyczne, empatyczne i holistyczne nasycają świat barwą i odsłaniają sekrety; sztuczność i brutalność go wybielają — wiele questów znika we mgle.
Trzy etapy: (1) gra dla jednego gracza w jego Katedrze — drużyną są TeOgochi ze stada; (2) Teterhia rośnie z pracy Katedry — obrazy, bryły, ruch, krainy i muzyka powstają w modułach i wchodzą do gry; (3) MRPG na otakos.wtf — każda zatwierdzona Katedra jest krainą wspólnej mapy, a Katedry łączą Mosty.
Cel gracza: odnaleźć Sos — zaginiony smak świata, rozbity na Siedem Nut.`,
            mechanika: `PĘTLA: postać (żywioł + droga + wkładki) → ziarno → Teterhia → ruch po krainie → węzeł questu (ziarnowy albo od Kustosza) → wybór o tonie → nasycenie ± (barwa świata, widoczność sekretów) → mGRV × kurs, EXP → poziom → umiejętność (TYLKO z questów).
ŻYWIOŁY (Ogień, Woda, Ziemia, Powietrze, Eter) przechylają biomy i paletę. DROGI to klasy: Twórca (mGRV za autentyczność ×1.25), Opiekun (empatia ×1.3), Wędrowiec (dalszy wzrok), Badacz (niższy próg sekretów).
RYTM WALKI: walka w czasie rzeczywistym w takt utworu z TeO Music Studio — cios w rytm = cios mocny, poza rytmem = słaby; Zgrzytowce rozbijają rytm, a nasycenie spada przy brutalnych zakończeniach (można też rozbroić wroga wyborem).
DRUŻYNA: do 3 TeOgochi ze stada jako towarzysze (każdy ze swoją rolą i modelem); ich zachowanie opisuje karta gatunku.
EKWIPUNEK: z Kuźni (Assety 3D) i Składnicy — tech-wear, instrumenty-broń, artefakty; craft = przetopienie znalezisk w Kuźni.
EKONOMIA: mGRV w grze, kurs z realnych składników; wymiana na GRV dopiero, gdy most ją wystawi (dziś zablokowana i mówi dlaczego).
SEZONY: Nocna Zmiana — Kustosz każdej nocy dokłada questy i zdarzenia do krainy; Kronika zapisuje sagę gracza.`,
            fabula: `MIT: Pieśń Źródła brzmiała w każdym kamieniu Teterhii. Przyszedł Zgrzyt — szum, który żywi się sztucznością i brutalnością — i świat wyblakł, a Sos, receptura smaku świata, rozpadł się na Siedem Nut.
PROLOG — Brama: tworzenie postaci = narodziny krainy. Kustosz Teterhii wita Wędrowca; pierwszy towarzysz z TeOgochi.
AKT I — Pierwszy Strumień: questy ziarnowe (Pierwszy Strumień, Gaj, który pamięta, Wyrwa); gracz uczy się, że ton wyboru zmienia barwę świata; pierwsza Nuta w jego żywiole.
AKT II — Siedem Nut: krainy żywiołów i Eteru, każdą strzeże Strażnik Nuty (nie zawsze do pokonania — czasem do wysłuchania). Frakcje: Kuźnia Dźwięku (DJ-e w tech-wear, rytm i ogień), Opiekunowie Gaju, Badacze Wyrwy, Wędrowcy Równin, Cisi z Pustki.
AKT III — Wyrwa i Wyblakła Stolica: źródło Zgrzytu; rajd z drużyną TeOgochi; finał zależy od nasycenia — barwny świat słyszy Pieśń, wyblakły dostaje gorzkie zakończenie.
EPILOG — Sos odnaleziony: gracz może zaszczepić swoją krainę we wspólnej Teterhii (MRPG) — saga trwa sezonami.
KUSTOSZ pisze questy na żywo z FAKTÓW krainy (lokalny model, bez chmury) — w tonie sagi, z wkładkami gracza w treści.`,
            postacie: `WĘDROWIEC (gracz) — imię, żywioł, droga i wkładki; wygląd z Karty postaci (Pracownia obrazów → Assety 3D).
KUSTOSZ TETERHII — głos świata, pisze questy i pamięta wybory.
TOWARZYSZE — TeOgochi stada (Kodeks, Paleta, Pionek, Joanna…), każdy z umiejętnością drużynową.
STRAŻNICY NUT (7) — Strażnik Żaru, Strażniczka Zatoki, Korzeń, Wichrowy Chór, Cień Eteru, Kowal Ciszy, Echo Wyrwy.
FRAKCJE — Kuźnia Dźwięku (DRIFT.01: DJ w tech-wear z maską i słuchawkami), Opiekunowie Gaju, Badacze Wyrwy, Wędrowcy Równin, Cisi z Pustki.
ZGRZYTOWCE — wrogowie z wyblakłej materii: Szumak, Bielak, Pękacz, Wyblakły Rycerz; Zgrzyt jako ostatni przeciwnik.`,
            wizual: `Barwa jako mechanika: nasycenie gracza steruje paletą świata (kanał S), Zgrzyt = wyblakłe, szaro-białe plamy.
Styl: malowana fantastyka zmieszana z tech-wear i kulturą klubową (neony w słuchawkach, kable jak liany). Bryły z Assetów 3D (TRELLIS.2) — jeden obiekt na spokojnym tle; koncepty jako zestawy modelarskie i karty postaci (Pracownia obrazów), do bryły idzie wycinek.
Ruch brył: obrót (znajdźki), lewitacja (Nuty, artefakty), oddech (postacie w spoczynku), kołysanie (drzewa, sztandary), podskok (stworki). Pełny chód postaci — po etapie 2 ruchu (szkielet).
Krainy: koncepty krajobrazów dla każdego biomu (Strumień, Gaj, Równina, Grzbiet, Pustka, Wyrwa).`,
            audio: `Muzyka z TeO Music Studio: każdy biom ma motyw, walka bierze BPM utworu (Rytm walki). Joanna śpiewa Pieśń Źródła w finale. Głosy NPC z Głosów Stada / klonów Katedry. Zgrzyt brzmi jak przesterowany szum, który cichnie z nasyceniem.`,
            technika: `three.js w przeglądarce (Kodeks buduje i testuje). Teren z ziarna Teterhii (biomy z src/gra/teterhia.ts → siatka wysokości). Bryły GLB z public/assety (GLTFLoader), animacje ruchu przez AnimationMixer. Questy: POST /api/tgs/quest (Kustosz). Plecak: GET /api/grv/:wezel. Zapis drogi gracza (świat liczy się z ziarna, nie zapisujemy go). Bez chmury — 0.00G. MRPG później: krainy Katedr z rejestru otakos.wtf, Mosty przez TOST między Katedrami.`,
        },
        kamienie: [
            { tytul: 'Brama i kraina 3D', opis: 'Teterhia z ziarna postaci jako teren three.js — biomy, barwa z nasycenia.', zadania: ['Teren 3D z ziarna: siatka wysokości z biomów Teterhii (Strumień, Gaj, Równina, Grzbiet, Pustka) z kolorami biomów.', 'Ekran Bramy: imię, żywioł, droga i wkładki → ziarno świata; ta sama postać = ta sama kraina.', 'Nasycenie (0–100) steruje nasyceniem kolorów terenu; HUD pokazuje barwę świata.'] },
            { tytul: 'Wędrowiec w ruchu', opis: 'Bohater z Assetów 3D chodzi po krainie, kamera podąża.', zadania: ['Postać gracza: GLB z public/assety (gdy jest), inaczej kapsuła; WSAD + mysz, kamera zza pleców.', 'Animacja spoczynku „oddech” z AnimationMixer, gdy plik ma animację.', 'Kolizje z Grzbietami (nieprzechodnie) i krawędzią świata.'] },
            { tytul: 'Questy Kustosza', opis: 'Węzły questów w świecie, wybory o tonie, nagrody.', zadania: ['Węzły questów jako świecące znaczniki; sekretne widać tylko powyżej progu nasycenia.', 'Okno questu: treść, 3–4 wybory o tonie; wybór zmienia nasycenie, mGRV i EXP.', 'Quest od Kustosza przez POST /api/tgs/quest, przy braku mostu quest ziarnowy — z komunikatem wprost.'] },
            { tytul: 'Rytm walki i Zgrzytowce', opis: 'Pierwsi wrogowie i walka w takt muzyki.', zadania: ['Zgrzytowce (Szumak, Bielak) z prostym AI pościgu; wyblakła aura wokół nich.', 'Rytm: BPM (domyślnie 120) — cios w oknie rytmu ×2 obrażeń, HUD z pulsem.', 'Rozbrojenie wyborem: przy niskim HP wroga okno „wysłuchaj / dobij” zmienia nasycenie.'] },
            { tytul: 'Pierwsza Nuta', opis: 'Kraina żywiołu gracza i jej Strażnik.', zadania: ['Kraina żywiołu: paleta i rozkład biomów przechylone żywiołem postaci.', 'Strażnik Nuty: walka albo rozmowa, zależnie od nasycenia; nagroda — Nuta Sosu (lewitujący artefakt).', 'Umiejętność z questu Strażnika (jedyna droga do umiejętności).'] },
            { tytul: 'Plecak Katedry i zapis', opis: 'Ekwipunek, drużyna TeOgochi i zapis drogi gracza.', zadania: ['Plecak: ekwipunek i Nuty; saldo GRV węzła z GET /api/grv/:wezel (tylko odczyt).', 'Zapis drogi gracza w localStorage (postać, nasycenie, questy, Nuty) — świat liczony z ziarna.', 'Towarzysz TeOgochi podąża za graczem i podpowiada przy questach.'] },
        ],
        galezie: [
            { id: 'postacie', nazwa: 'Postacie i frakcje', opis: 'Wędrowiec, NPC, członkowie frakcji — karta postaci albo zestaw modelarski; do bryły wycinek złożonej postaci.', propozycje: [
                { opis: 'DJ z Kuźni Dźwięku w tech-wear: czarna bluza z kapturem, maska z filtrami, słuchawki z niebieskim neonem, rękawice, spodnie cargo', styl: 'zestaw' },
                { opis: 'Opiekunka Gaju w płaszczu z mchu i kory, z latarnią pełną świetlików', styl: 'postac3d' },
                { opis: 'Badacz Wyrwy w goglach i płaszczu z mapami, z mosiężnym sekstantem', styl: 'postac3d' },
                { opis: 'Wędrowiec Równin z lekkim plecakiem, szal na wietrze, laska z dzwoneczkami', styl: 'postac3d' },
            ] },
            { id: 'stwory', nazwa: 'Stwory i Strażnicy Nut', opis: 'Zgrzytowce i Strażnicy — jeden stwór na spokojnym tle.', propozycje: [
                { opis: 'Szumak — przygarbiony stwór z wyblakłej, szarobiałej materii, z pękającą skorupą i szumem zamiast twarzy', styl: 'pojedynczy' },
                { opis: 'Strażnik Żaru — kamienny golem z lawą w szczelinach i rogami z obsydianu', styl: 'pojedynczy' },
                { opis: 'Strażniczka Zatoki — postać z wody i muszli, z harfą z koralowca', styl: 'pojedynczy' },
                { opis: 'Wyblakły Rycerz — zbroja bez koloru, z której sypie się biały pył', styl: 'pojedynczy' },
            ] },
            { id: 'ekwipunek', nazwa: 'Ekwipunek i broń', opis: 'Instrumenty-broń, tech-wear, tarcze — jeden przedmiot.', propozycje: [
                { opis: 'miecz-gitara z gryfem jako ostrzem i strunami świecącymi na złoto', styl: 'pojedynczy' },
                { opis: 'słuchawki-hełm z neonowym pierścieniem i filtrami powietrza', styl: 'pojedynczy' },
                { opis: 'tarcza z membraną bębna i runami żywiołów na obręczy', styl: 'pojedynczy' },
            ] },
            { id: 'rekwizyty', nazwa: 'Rekwizyty i artefakty', opis: 'Znajdźki, Nuty Sosu, skrzynie — idealne do ruchu „obrót” i „lewitacja”.', propozycje: [
                { opis: 'Nuta Sosu — kryształowa nuta muzyczna z płynnym złotem w środku', styl: 'pojedynczy' },
                { opis: 'skrzynia Kustosza z drewna i mosiądzu, zamek w kształcie oka', styl: 'pojedynczy' },
                { opis: 'butelka z eliksirem barwy — tęczowy płyn w szkle z korkiem z kory', styl: 'pojedynczy' },
            ] },
            { id: 'budowle', nazwa: 'Budowle i Katedry', opis: 'Katedry krain, kuźnie, świątynie Nut — jeden budynek.', propozycje: [
                { opis: 'Katedra krainy — smukła wieża z witrażami w kolorach żywiołów, z mostem świetlnym na szczycie', styl: 'pojedynczy' },
                { opis: 'Kuźnia Dźwięku — warsztat z kowadłem i głośnikami, kable jak liany', styl: 'pojedynczy' },
                { opis: 'świątynia Nuty w gaju — okrągła altana z korzeni i kamienia', styl: 'pojedynczy' },
            ] },
            { id: 'krainy', nazwa: 'Krainy i krajobrazy', opis: 'Biomy Teterhii — koncepty krajobrazów (Krajobrazy w Game Studio).', propozycje: [
                { opis: 'Strumień — dolina z rozlewiskami i zatokami w błękicie, mgła o świcie', styl: 'krajobraz' },
                { opis: 'Gaj, który pamięta — gęsty las z drzewami, w których korze świecą wspomnienia', styl: 'krajobraz' },
                { opis: 'Grzbiet — ostre skały z żarem w szczelinach pod pomarańczowym niebem', styl: 'krajobraz' },
                { opis: 'Wyrwa — pęknięcie świata, z którego wylewa się biały szum Zgrzytu', styl: 'krajobraz' },
                { opis: 'Wyblakła Stolica — miasto bez kolorów, gdzie tylko witraże jeszcze się bronią', styl: 'krajobraz' },
            ] },
            { id: 'wierzchowce', nazwa: 'Wierzchowce i pojazdy', opis: 'Na czym podróżuje Wędrowiec — jeden obiekt.', propozycje: [
                { opis: 'wierzchowiec z kory i mchu, podobny do łosia, z latarniami na porożu', styl: 'pojedynczy' },
                { opis: 'lewitująca deska dźwiękowa z głośnikiem w napędzie', styl: 'pojedynczy' },
            ] },
        ],
    },
};

export const SZABLONY = { teterhia: TETERHIA };

/**
 * Zasiej projekt z szablonu: AppStudio (typ gra) + GDD. Projekt istnieje → zwraca go; GDD podmieniane tylko z `nadpisz`.
 * @param {{ appStudio: { projekty: () => Promise<any[]>, nowyProjekt: (o: object) => Promise<any> }, gdd: { wczytaj: Function, zapisz: Function } }} z
 */
export async function zasiej(idSzablonu, { appStudio, gdd }, { nadpisz = false } = {}) {
    const sz = SZABLONY[idSzablonu];
    if (!sz) throw new Error(`Nie znam szablonu „${idSzablonu}” — są: ${Object.keys(SZABLONY).join(', ')}.`);
    const istniejacy = (await appStudio.projekty()).find((p) => p.id === sz.id || p.nazwa === sz.nazwa);
    const projekt = istniejacy ?? await appStudio.nowyProjekt({ nazwa: sz.nazwa, opis: sz.opis, typ: 'gra' });
    const obecne = await gdd.wczytaj(projekt.id);
    const maTresc = !!(obecne && (Object.values(obecne.sekcje ?? {}).some(Boolean) || obecne.kamienie?.length));
    if (maTresc && !nadpisz) return { projekt: projekt.id, nowy: false, gdd: obecne, nadpisano: false };
    const zapisane = await gdd.zapisz(projekt.id, { ...sz.gdd, zrodlo: `szablon:${idSzablonu}` });
    return { projekt: projekt.id, nowy: !istniejacy, gdd: zapisane, nadpisano: maTresc };
}

export default { TETERHIA, SZABLONY, zasiej };
