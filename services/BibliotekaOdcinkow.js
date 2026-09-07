/**
 * 📚 BibliotekaOdcinkow — wszystkie odcinki wszystkich projektów w jednym
 * miejscu, razem z tym, co można z nimi dalej zrobić.
 *
 * PO CO. Suweren: „dodajmy na samym końcu bibliotekę odcinków, a tam parę
 * możliwości co z tym dalej zrobić — oddać TeOgochi od marketingu, YouTube'ów
 * i biznesów, tworzą nowy kanał dla danego produktu i według swego planu
 * publikują gotowe odcinki".
 *
 * ⚠️ GDZIE KOŃCZY SIĘ PRAWDA, A ZACZYNA OBIETNICA — CZYTAJ, ZANIM DOPISZESZ
 * TU „AUTOMATYCZNĄ PUBLIKACJĘ".
 *
 * To, co ten moduł robi NAPRAWDĘ:
 *   · zbiera odcinki ze wszystkich projektów wraz z plikami, które istnieją,
 *   · trzyma PLAN PUBLIKACJI (kanał, data, tytuł, opis, tagi),
 *   · zapisuje PRZEKAZANIE odcinka konkretnemu TeOgochi i nadaje to na szynę,
 *     dzięki czemu agent widzi zadanie u siebie.
 *
 * Czego NIE robi i nie będzie udawał, że robi:
 *   · nie zakłada kanału na YouTube — do tego trzeba konta Google, projektu
 *     w Cloud Console, zgody OAuth i tokenu odświeżania. Nic z tego nie mieszka
 *     w Katedrze i nie da się tego „wygenerować lokalnie".
 *   · nie wysyła pliku na YouTube — YouTube Data API v3 wymaga tych samych
 *     poświadczeń plus limitu dobowego (upload kosztuje 1600 jednostek z 10 000).
 *   · nie liczy pieniędzy za wyświetlenia — dane o przychodach oddaje wyłącznie
 *     YouTube Analytics API zalogowanemu właścicielowi kanału. Wyliczanie ich
 *     lokalnie byłoby zmyślaniem liczb, na których Suweren mógłby oprzeć decyzje.
 *
 * Dlatego `stanKanalu()` mówi WPROST, czego brakuje, a plan publikacji jest
 * PLANEM: kolejką gotową do wykonania w dniu, w którym poświadczenia będą.
 */

import fs from 'fs/promises';
import path from 'path';
import { slug, utworzProjekt } from './Produkcje.js';

const PLIK = 'publikacja.json';

/**
 * Agenci, którym można oddać odcinek. Lista wzięta z REALNYCH gatunków
 * TeOgochi (lib/teogochiGatunki.ts) — wymyślenie tu „agenta od YouTube'a",
 * którego w stadzie nie ma, dałoby zadanie przypisane do nikogo.
 */
export const ODBIORCY = [
    { id: 'kupiec', imie: 'Kupiec', dziedzina: 'Marketplace', robi: 'Dystrybucja: gdzie i komu odcinek trafia.' },
    { id: 'bilans', imie: 'Bilans', dziedzina: 'Biznes', robi: 'Rozliczenia i przepływy GRV wokół produktu.' },
    { id: 'kronikarz', imie: 'Kronikarz', dziedzina: 'Pisanie', robi: 'Tytuł, opis, tagi — to, co czyta widz.' },
    { id: 'klatka', imie: 'Klatka', dziedzina: 'Film i wideo', robi: 'Montaż, poprawki, wersje do publikacji.' },
];

export const KANALY = [
    { id: 'youtube', nazwa: 'YouTube', wymaga: ['konto Google', 'projekt w Cloud Console', 'zgoda OAuth', 'token odświeżania'] },
    { id: 'otakos', nazwa: 'Marketplace otakos.wtf', wymaga: ['deploy strony', 'wpis produktu'] },
    { id: 'lokalny', nazwa: 'Tylko lokalnie', wymaga: [] },
];

const katalogProjektu = (katalog, projekt) => {
    const s = slug(projekt);
    if (!s) throw new Error('Projekt bez nazwy.');
    return path.join(katalog, 'produkcje', s);
};

async function wczytajPlan(katalog, projekt) {
    try {
        const t = await fs.readFile(path.join(katalogProjektu(katalog, projekt), PLIK), 'utf8');
        const d = JSON.parse(t);
        return d && typeof d === 'object' ? d : {};
    } catch { return {}; }
}

async function zapiszPlan(katalog, projekt, dane) {
    // Przez `utworzProjekt`, nie przez gole `mkdir` — patrz ta sama uwaga
    // w MuzykaFilmowa.js: katalog bez `projekt.json` rozdwaja projekt na liscie.
    const { sciezka } = await utworzProjekt(katalog, projekt);
    await fs.writeFile(path.join(sciezka, PLIK), JSON.stringify(dane, null, 2), 'utf8');
}

/**
 * Stan kanału publikacji — uczciwa odpowiedź na „czy to działa automatycznie".
 *
 * ⚠️ POPRAWKA 2026-09-07 — MYLIŁEM SIĘ CO DO MECHANIZMU. Pierwsza wersja
 * szukała poświadczeń w zmiennych środowiskowych (`YT_CLIENT_ID` itd.) i pisała,
 * że „Katedra tego nie zrobi". Nieprawda: Katedra MA gotowy tor — Impresariat
 * (`services/ImpresarioService.js`) trzyma klucze w `_OtakOs_Wymiar/media/
 * media_secrets.json` i wysyła plik prawdziwym OAuth2 + resumable upload na
 * `googleapis.com/upload/youtube/v3/videos`. Suweren miał rację, że „to można
 * bardzo łatwo zrealizować, łącząc z impresariatem".
 *
 * Dlatego stan YouTube'a czytamy TERAZ Z IMPRESARIATU, a nie ze środowiska.
 * `stanYouTube` wstrzykuje most (getYouTubeSecretsStatus).
 */
export function stanKanalu(id, stanYouTube = null) {
    const kanal = KANALY.find((k) => k.id === id) ?? KANALY[2];
    if (kanal.id === 'lokalny') return { kanal: kanal.id, nazwa: kanal.nazwa, gotowy: true, braki: [] };

    if (kanal.id === 'youtube') {
        // Bez odpowiedzi Impresariatu nie zgadujemy — mówimy, że nie wiemy.
        if (!stanYouTube) {
            return {
                kanal: kanal.id, nazwa: kanal.nazwa, gotowy: false,
                braki: ['Impresariat nie odpowiedział — nie wiem, czy klucze są.'],
                uwaga: 'Sprawdź GET /api/impresario/status.',
            };
        }
        const braki = (stanYouTube.missing ?? []).map((f) => ({
            CLIENT_ID: 'CLIENT_ID — identyfikator klienta OAuth z Google Cloud Console',
            CLIENT_SECRET: 'CLIENT_SECRET — sekret tego klienta',
            REFRESH_TOKEN: 'REFRESH_TOKEN — token po jednorazowej zgodzie właściciela kanału',
        }[f] ?? f));

        return {
            kanal: kanal.id, nazwa: kanal.nazwa,
            gotowy: !!stanYouTube.allPresent,
            braki,
            przezImpresariat: true,
            uwaga: stanYouTube.allPresent
                ? 'Klucze są w Impresariacie. Wysyłka zużywa limit dobowy API (upload ≈ 1600 z 10 000 jednostek).'
                : 'Klucze wpisuje się RAZ: POST /api/impresario/secrets/youtube. Potem wysyłka idzie sama przez Impresariat.',
        };
    }

    return { kanal: kanal.id, nazwa: kanal.nazwa, gotowy: false, braki: kanal.wymaga, uwaga: 'Kanał wymaga wdrożonej strony.' };
}

/**
 * Biblioteka: odcinki wszystkich projektów + materiały, muzyka i plan.
 * Zależności wstrzykiwane, żeby ten plik nie znał ani ComfyUI, ani ffmpega.
 */
export async function biblioteka(katalog, { projekty, pamiec, materialy, muzyka, kadry }) {
    const wynik = [];
    for (const p of await projekty()) {
        const [pam, plany, muz, karty] = await Promise.all([
            pamiec(p.nazwa).catch(() => ({ odcinki: [] })),
            wczytajPlan(katalog, p.nazwa).catch(() => ({})),
            muzyka(p.nazwa).catch(() => ({ utwory: [] })),
            kadry(p.nazwa).catch(() => []),
        ]);

        const odcinki = [];
        for (const o of pam.odcinki ?? []) {
            const m = await materialy(p.nazwa, o).catch(() => ({ pliki: [], sciezka: null }));
            // ⚠️ „Gotowy do publikacji" znaczy: JEST PLIK WIDEO na dysku.
            // Status „zrealizowany" w pamięci to deklaracja, nie materiał.
            const wideo = (m.pliki ?? []).filter((f) => /\.(mp4|webm|mov|mkv)$/i.test(f.nazwa));
            odcinki.push({
                ...o,
                projekt: p.nazwa,
                projektSlug: p.slug,
                katalog: m.sciezka,
                pliki: m.pliki ?? [],
                wideo,
                gotowyDoPublikacji: wideo.length > 0,
                kadrow: karty.filter((k) => k.sesjaRady === o.id).length,
                muzyka: (muz.utwory ?? []).filter((u) => !u.odcinekId || u.odcinekId === o.id).length,
                plan: plany[o.id] ?? null,
            });
        }

        wynik.push({
            projekt: p.nazwa, slug: p.slug, katalog: p.katalog, sciezka: p.sciezka,
            odcinki: odcinki.sort((a, b) => a.numer - b.numer),
        });
    }
    return wynik;
}

/** Zapisz plan publikacji odcinka. Plan to nie wysyłka i tak się nazywa. */
export async function ustawPlan(katalog, projekt, odcinekId, dane = {}) {
    if (!odcinekId) throw new Error('Brak odcinka.');
    const kanal = KANALY.some((k) => k.id === dane.kanal) ? dane.kanal : 'lokalny';
    const plany = await wczytajPlan(katalog, projekt);

    plany[odcinekId] = {
        kanal,
        // Data bez godziny wystarczy: to plan wydawniczy, nie sekundnik.
        kiedy: String(dane.kiedy || '').slice(0, 10) || null,
        tytul: String(dane.tytul || '').trim().slice(0, 120),
        opis: String(dane.opis || '').trim().slice(0, 2000),
        tagi: Array.isArray(dane.tagi)
            ? dane.tagi.map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 20)
            : String(dane.tagi || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20),
        agent: ODBIORCY.some((o) => o.id === dane.agent) ? dane.agent : null,
        stan: 'zaplanowany',
        zmieniono: new Date().toISOString(),
    };
    await zapiszPlan(katalog, projekt, plany);
    return { plan: plany[odcinekId], stanKanalu: stanKanalu(kanal) };
}

/**
 * Oddaj odcinek TeOgochi. Zapisuje przekazanie w planie i zwraca zdarzenie
 * do nadania na szynę — dzięki temu agent widzi zadanie u siebie, a nie
 * „gdzieś w systemie".
 */
export async function przekaz(katalog, projekt, odcinekId, agentId, notatka = '') {
    const agent = ODBIORCY.find((o) => o.id === agentId);
    if (!agent) throw new Error(`Nie znam agenta „${agentId}". Dostępni: ${ODBIORCY.map((o) => o.id).join(', ')}.`);

    const plany = await wczytajPlan(katalog, projekt);
    const plan = plany[odcinekId] ?? { kanal: 'lokalny', stan: 'zaplanowany' };
    plan.agent = agent.id;
    plan.przekazano = new Date().toISOString();
    plan.notatka = String(notatka || '').trim().slice(0, 500);
    plan.stan = 'przekazany';
    plany[odcinekId] = plan;
    await zapiszPlan(katalog, projekt, plany);

    return {
        plan,
        agent,
        zdarzenie: {
            agent: agent.imie,
            rodzaj: 'zadanie',
            tresc: `dostał odcinek do ${agent.dziedzina.toLowerCase()}: ${projekt} / ${odcinekId}${plan.notatka ? ` — ${plan.notatka}` : ''}`,
        },
    };
}

/**
 * Przygotuj zlecenie dla Impresariatu z planu publikacji odcinka.
 *
 * ⚠️ TA FUNKCJA NIC NIE WYSYŁA. Składa dane i sprawdza warunki; wysyłką
 * zajmuje się Impresariat, który ma do tego OAuth2 i resumable upload.
 * Rozdzielenie jest celowe: gdyby biblioteka wysyłała sama, mielibyśmy
 * drugą implementację uploadu i dwa miejsca do naprawiania.
 */
export async function zlecenieDlaImpresariatu(katalog, projekt, odcinek, materialy) {
    const plany = await wczytajPlan(katalog, projekt);
    const plan = plany[odcinek.id];
    if (!plan) throw new Error('Ten odcinek nie ma planu publikacji — najpierw zapisz plan.');

    const wideo = (materialy.pliki ?? []).filter((f) => /\.(mp4|webm|mov|mkv)$/i.test(f.nazwa));
    if (!wideo.length) {
        throw new Error(`W katalogu odcinka nie ma pliku wideo. Nie ma czego wysłać — najpierw zmontuj odcinek.`);
    }
    // Największy plik = zmontowana całość, a nie pojedyncze ujęcie próbne.
    const najwiekszy = wideo.reduce((a, b) => ((b.bajtow ?? 0) > (a.bajtow ?? 0) ? b : a));

    return {
        plan,
        plik: path.join(materialy.sciezka, najwiekszy.nazwa),
        tytul: plan.tytul || `${projekt} — #${odcinek.numer} ${odcinek.tytul}`,
        album: projekt,
        platformy: [plan.kanal === 'youtube' ? 'youtube' : 'lokalny'],
        opis: plan.opis || odcinek.streszczenie,
        tagi: plan.tagi ?? [],
    };
}

/** Odnotuj, że odcinek poszedł do Impresariatu — razem z numerem zlecenia. */
export async function oznaczWyslany(katalog, projekt, odcinekId, jobId) {
    const plany = await wczytajPlan(katalog, projekt);
    const plan = plany[odcinekId] ?? {};
    plan.stan = 'w impresariacie';
    plan.zlecenie = jobId;
    plan.wyslano = new Date().toISOString();
    plany[odcinekId] = plan;
    await zapiszPlan(katalog, projekt, plany);
    return plan;
}

export default {
    ODBIORCY, KANALY, stanKanalu, biblioteka, ustawPlan, przekaz,
    zlecenieDlaImpresariatu, oznaczWyslany,
};
