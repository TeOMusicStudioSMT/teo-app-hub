/**
 * 🧱 Klocki gry — „najpierw klocki, potem budowanie" (Suweren 2026-10-07: „każą im budować z lego,
 * a klocków jeszcze nie ma… sam porobiłem w obrazach i assetach 3D ręcznie, a one nawet o tym nie wiedzą").
 *
 * Zmierzone tego dnia: plan GDD Teterhii nie wspominał żadnego z 30 obrazów Pracowni ani 10 brył gry,
 * a Kodeks dostawał „ASSETY 3D — UŻYWAJ ich" bez ról — gemma 12B przez dwie rundy pisała moduł
 * wczytujący WSZYSTKIE bryły zamiast questu Kustosza (którego ciała nikt jeszcze nie narysował).
 *
 * Klocek = rzecz z warsztatu Katedry, której zadanie potrzebuje, z ROLĄ w grze:
 *   w-grze  — bryła GLB jest w public/assety projektu (Kodeks może ją wczytać),
 *   bryla   — bryła jest w Assetach 3D, ale nie w grze (produkcja sama ją dołoży — doGry),
 *   obraz   — jest tylko obraz z Pracowni (brakuje bryły — zrób ją w Assetach 3D z obrazu),
 *   brak    — nie ma nic (narysuj w Pracowni obrazów z podanego opisu).
 * Zadanie z brakującym klockiem NIE idzie do Kodeksa (stan „klocki") — chyba że Suweren pozwoli
 * budować z bryłą zastępczą (`zastepcze: true`).
 *
 * Wszystko tu jest czyste poza katalogiem (czyta dysk przez wstrzyknięte Assety3D).
 */

/**
 * Katalog klocków projektu. `assety3d` = moduł Assety3D (listaObrazow, lista, assetyProjektu).
 * Zwraca listę { klucz, nazwa, opis, galaz, stan, plik?, bryla?, obraz? } — bez dubli:
 * obraz z bryłą, która jest w grze, = jeden klocek „w-grze".
 */
export async function katalog(projektId, { assety3d }) {
    const wGrze = await assety3d.assetyProjektu(projektId).catch(() => []);
    const obrazy = (await assety3d.listaObrazow().catch(() => [])).filter((o) => o.projekt === projektId);
    const bryly = await assety3d.lista().catch(() => []);
    const brylaPoId = new Map(bryly.map((b) => [b.id, b]));
    const plikPoZrodle = new Map(wGrze.filter((a) => a.zrodlo).map((a) => [a.zrodlo, a]));
    const out = [];
    const uzyte = new Set();

    for (const o of obrazy) {
        // Najlepsza bryła obrazu: ta w grze, potem dowolna istniejąca.
        const ids = Array.isArray(o.bryly) ? o.bryly : [];
        const wGrzeId = ids.find((id) => plikPoZrodle.has(id));
        const istniejaca = ids.find((id) => brylaPoId.has(id));
        const opis = String(o.opis || '').slice(0, 160);
        if (wGrzeId) {
            const a = plikPoZrodle.get(wGrzeId);
            uzyte.add(a.plik);
            out.push({ klucz: `b:${a.plik}`, nazwa: opis || a.nazwa, opis, galaz: o.galaz || null, stan: 'w-grze', plik: a.plik, bryla: wGrzeId, obraz: o.id });
        } else if (istniejaca) {
            out.push({ klucz: `a:${istniejaca}`, nazwa: opis, opis, galaz: o.galaz || null, stan: 'bryla', bryla: istniejaca, obraz: o.id });
        } else {
            // Krajobraz to KONCEPT krainy (paleta, nastrój) — z niego nie robi się bryły, więc nie blokuje zadania.
            out.push({ klucz: `o:${o.id}`, nazwa: opis, opis, galaz: o.galaz || null, stan: o.styl === 'krajobraz' ? 'koncept' : 'obraz', obraz: o.id, styl: o.styl || null });
        }
    }
    // Bryły w grze bez obrazu w Pracowni (ręcznie, ze zdjęcia, ze Składnicy).
    for (const a of wGrze) {
        if (uzyte.has(a.plik) || !/\.glb$/i.test(a.plik || '')) continue;
        out.push({ klucz: `b:${a.plik}`, nazwa: String(a.opis || a.nazwa || a.plik).slice(0, 160), opis: String(a.opis || '').slice(0, 160), galaz: null, stan: 'w-grze', plik: a.plik, bryla: a.zrodlo || null });
    }
    // Obraz w kilku wersjach (pojedynczy + karta postaci) daje kilka klocków o tym samym opisie —
    // zostawiamy najdalej posunięty (w-grze > bryla > obraz).
    const ranga = { 'w-grze': 3, bryla: 2, obraz: 1, koncept: 1 };
    // Zwycięzca pamięta obrazy i bryły przegranych wersji — stary klucz zadania dalej go znajdzie.
    const poOpisie = new Map();
    for (const k of out) {
        const klucz = k.opis ? k.opis.toLowerCase() : k.klucz;
        const stary = poOpisie.get(klucz);
        const aliasy = { obrazy: [...(stary?.obrazy ?? []), ...(k.obraz ? [k.obraz] : [])], bryly: [...(stary?.bryly ?? []), ...(k.bryla ? [k.bryla] : [])] };
        poOpisie.set(klucz, { ...(!stary || ranga[k.stan] > ranga[stary.stan] ? k : stary), ...aliasy });
    }
    return [...poOpisie.values()];
}

const ETYKIETA_STANU = { 'w-grze': 'bryła w grze', bryla: 'bryła w Assetach, nie w grze', obraz: 'tylko obraz, BRAK bryły', koncept: 'koncept krajobrazu (obraz, nie bryła)' };

/** Katalog dla planisty: krótkie numery K1…Kn (model nie przepisze długich kluczy bez błędu). */
export function katalogJakoTekst(kat) {
    if (!kat.length) return 'KATALOG KLOCKÓW: pusty — w warsztacie Katedry nie ma jeszcze żadnych obrazów ani brył tej gry.';
    return 'KATALOG KLOCKÓW (to, co Suweren już zrobił w Pracowni obrazów i Assetach 3D):\n'
        + kat.map((k, i) => `K${i + 1} [${ETYKIETA_STANU[k.stan]}${k.galaz ? ', ' + k.galaz : ''}] ${k.nazwa}`).join('\n');
}

/**
 * Klocki zadania z odpowiedzi planisty → postać zapisywana w GDD.
 * Wpis: {"rola":"wróg Szumak","klocek":"K7"} albo {"rola":"Kustosz — NPC","brak":"opis do Pracowni"}.
 * Numer spoza katalogu = brak (z opisem roli) — nie zgadujemy.
 */
export function klockiZOdpowiedzi(lista, kat) {
    if (!Array.isArray(lista)) return [];
    const out = [];
    for (const w of lista.slice(0, 6)) {
        if (!w || typeof w !== 'object') continue;
        const rola = String(w.rola || '').trim().slice(0, 120);
        if (!rola) continue;
        const m = String(w.klocek || w.klucz || '').match(/^K?(\d+)$/i);
        const k = m ? kat[Number(m[1]) - 1] : null;
        if (k) out.push({ rola, klucz: k.klucz, opis: k.opis || k.nazwa });
        else out.push({ rola, klucz: null, opis: String(w.brak || w.opis || rola).trim().slice(0, 300) });
    }
    return out;
}

/** Czysty zapis klocków (z frontu albo ręcznie) — tylko znane pola. */
export function oczyscKlocki(lista) {
    if (!Array.isArray(lista)) return undefined;
    return lista.slice(0, 6).map((k) => ({
        rola: String(k?.rola || '').trim().slice(0, 120),
        klucz: typeof k?.klucz === 'string' && /^[abo]:[\w.\-]{1,120}$/.test(k.klucz) ? k.klucz : null,
        opis: String(k?.opis || '').trim().slice(0, 300),
    })).filter((k) => k.rola);
}

/**
 * Stan klocków zadania względem ŚWIEŻEGO katalogu. Klucz bywa nieaktualny (obraz dostał bryłę,
 * bryła trafiła do gry) — szukamy klocka po obrazie/bryle, nie tylko po kluczu.
 * Zwraca { gotowe: [{rola, plik, opis}], doGry: [{rola, bryla, opis}], braki: [{rola, co, opis, obraz?}], koncepty: [{rola, opis}] }.
 */
export function rozwiaz(klocki, kat) {
    const wynik = { gotowe: [], doGry: [], braki: [], koncepty: [] };
    for (const z of Array.isArray(klocki) ? klocki : []) {
        const [typ, id] = String(z.klucz || '').split(/:(.*)/s);
        // Klocek „brak” (albo zaginiony klucz): Suweren mógł go już zrobić gdzie indziej — np. bryłę prosto
        // w Assetach 3D (2026-10-07: Kustosz zrobiony, a zadanie dalej „narysuj →”). Szukamy po NAZWIE.
        const k = !z.klucz ? poNazwie(z, kat)
            : kat.find((x) => x.klucz === z.klucz)
            ?? (typ === 'o' ? kat.find((x) => x.obraz === id || x.obrazy?.includes(id)) : null)
            ?? (typ === 'a' ? kat.find((x) => x.bryla === id || x.bryly?.includes(id)) : null)
            ?? (typ === 'b' ? kat.find((x) => x.plik === id) : null)
            ?? poNazwie(z, kat);
        if (k?.stan === 'w-grze') wynik.gotowe.push({ rola: z.rola, plik: k.plik, opis: k.opis || z.opis });
        else if (k?.stan === 'bryla') wynik.doGry.push({ rola: z.rola, bryla: k.bryla, opis: k.opis || z.opis });
        else if (k?.stan === 'koncept') wynik.koncepty.push({ rola: z.rola, opis: k.opis || z.opis });
        else if (k?.stan === 'obraz') wynik.braki.push({ rola: z.rola, co: 'bryla', opis: k.opis || z.opis, obraz: k.obraz });
        else wynik.braki.push({ rola: z.rola, co: 'obraz', opis: z.opis || z.rola });
    }
    return wynik;
}

const normuj = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
/** Imię klocka: tekst przed „—” / „,” / „(” — „Kustosz Teterhii — stary strażnik…” → „kustosz teterhii”. */
const imie = (s) => normuj(String(s || '').split(/\s[—–-]\s|,|\(/)[0]).split(' ').slice(0, 3).join(' ');

/** Klocek katalogu o tej samej nazwie co opis brakującego klocka (najdalej posunięty: w grze > bryła > obraz). */
function poNazwie(z, kat) {
    const nazwy = [imie(z.opis), imie(z.rola.replace(/^(npc|wróg|wrog|nagroda|towarzysz|strażnik|straznik|klimat)\s+/i, ''))].filter((n) => n.length >= 4);
    if (!nazwy.length) return null;
    const ranga = { 'w-grze': 3, bryla: 2, obraz: 1, koncept: 0 };
    return kat.filter((k) => { const n = normuj(k.opis || k.nazwa); return nazwy.some((x) => n.startsWith(x)); })
        .sort((a, b) => ranga[b.stan] - ranga[a.stan])[0] ?? null;
}

/** Jedna linia o brakach — do uwagi zadania i kroku produkcji. */
export function opisBrakow(braki) {
    return braki.map((b) => b.co === 'bryla' ? `${b.rola}: zrób bryłę z obrazu „${b.opis.slice(0, 60)}” (Assety 3D)` : `${b.rola}: narysuj w Pracowni obrazów — „${b.opis.slice(0, 80)}”`).join('; ');
}

/**
 * Blok do promptu Kodeksa: TYLKO klocki tego zadania, z rolą. Pusta lista = zadanie bez brył.
 * `zastepcze` — braki, z którymi Suweren pozwolił budować: zastępcza bryła z kodu, do podmiany.
 * `koncepty` — krajobrazy z Pracowni: Kodeks nie widzi obrazów, dostaje ich opis jako klimat.
 */
export function blokKodeksa(gotowe, zastepcze = [], koncepty = []) {
    const klimat = koncepty.length ? `KLIMAT Z KONCEPTÓW SUWERENA (paleta i nastrój, nie pliki): ${koncepty.map((k) => `${k.rola} — ${k.opis}`).join('; ')}\n` : '';
    if (!gotowe.length && !zastepcze.length) return '\nKLOCKI: to zadanie nie potrzebuje brył z public/assety — NIE wczytuj żadnych assetów i nie pisz modułu ładującego modele.\n' + klimat;
    const l = ['\nKLOCKI TEGO ZADANIA (użyj DOKŁADNIE tych, w tej roli; innych assetów nie wczytuj, nie pisz ładowarki wszystkich modeli):'];
    for (const k of gotowe) l.push(`- ${k.rola}: './assety/${k.plik}' — ${k.opis}`);
    for (const k of zastepcze) l.push(`- ${k.rola}: BRYŁY JESZCZE NIE MA — zrób zastępczą z kodu (np. kapsuła/Box w charakterystycznym kolorze) w jednej funkcji, żeby dało się ją później podmienić na GLB`);
    l.push("Ładowanie: `new GLTFLoader().load('./assety/PLIK.glb', (g) => { … g.scene … })` — do czasu wczytania placeholder; pole typuj THREE.Object3D; dopasuj skalę do ~1,8 wysokości postaci.");
    return l.join('\n') + '\n' + klimat;
}

export default { katalog, katalogJakoTekst, klockiZOdpowiedzi, oczyscKlocki, rozwiaz, opisBrakow, blokKodeksa };
