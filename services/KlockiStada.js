/**
 * 🧱 Klocki Stada — co każdy TeOgochi NAPRAWDĘ zrobił, jako klocki do świata StoL-a.
 *
 * Suweren (2026-09-24): „świat klocków lego, a w nim teogochi — klikniesz, i wyświetlają się
 * wszystkie jego sprawy; każdy wnosi coś ze swojej profesji, swój mały świat."
 *
 * Klocek = jedno realne dzieło z dysku Katedry, zebrane przez moduły, które już to umieją:
 *   · Wystawa  — utwory, filmy, odcinki, kreacje Mody, chipy i printy Labu,
 *   · AppStudio — apki i gry Kodeksa,
 *   · Assety3D — modele 3D (TRELLIS.2).
 * Plus ślady agenta na szynie zdarzeń. Nic tu nie jest wymyślone: TeOgochi bez dzieł ma
 * pustą płytkę i to jest prawda o nim, nie usterka.
 *
 * ⚠️ PRZYPISANIE „czyj to klocek" jest decyzją, nie faktem z dysku (moduły nie zapisują autora).
 * Dlatego jest w JEDNEJ tabeli (WLASCICIELE) — zmiana to jedna linia.
 */

/** rodzaj klocka → id gatunku TeOgochi (lib/teogochiGatunki.ts). */
export const WLASCICIELE = {
    utwor: 'joanna',
    film: 'klatka',
    odcinek: 'rezyser',
    kreacja: 'krawcowa',
    apka: 'kodeks',
    gra: 'kodeks',
    model3d: 'paleta',
    chip: 'wektor',
    print: 'wektor',
    // wklad — wkład do Projektu Stada: właścicielem jest agent, który go oddał (pole `wlasciciel`).
};

const NA_AGENTA = 24;   // tyle klocków na płytkę — więcej nie zmieści się czytelnie na telefonie
const SLADOW = 15;

/**
 * Zbierz klocki. Każde źródło jest opcjonalne i niezależne: gdy jedno padnie
 * (np. brak katalogu apek), reszta świata i tak się pokaże.
 * @param {{ wystawa?:()=>Promise<any>, projekty?:()=>Promise<any[]>, assety3d?:()=>Promise<any[]>, zdarzenia?:any[], gatunki?:{id:string,imie:string}[] }} zrodla
 */
export async function zbierzKlocki({ wystawa, projekty, assety3d, projektyStada, zdarzenia = [], gatunki = [] } = {}) {
    const [w, p, a, ps] = await Promise.all([
        wystawa ? wystawa().catch(() => null) : null,
        projekty ? projekty().catch(() => []) : [],
        assety3d ? assety3d().catch(() => []) : [],
        projektyStada ? projektyStada().catch(() => []) : [],
    ]);
    const klocki = [];

    for (const u of w?.utwory ?? []) {
        if (u.ukryty) continue;
        klocki.push({ id: u.id, rodzaj: 'utwor', tytul: u.tytul, opis: u.zrodlo || '', kiedy: u.kiedy, media: { typ: 'audio', url: `/wystawa/plik/${u.id}` } });
    }
    for (const f of w?.filmy ?? []) {
        if (f.ukryty) continue;
        klocki.push({ id: f.id, rodzaj: f.rodzaj === 'odcinek' ? 'odcinek' : 'film', tytul: f.tytul, opis: f.opis || '', kiedy: f.kiedy, media: { typ: 'wideo', url: `/wystawa/plik/${f.id}` } });
    }
    for (const x of w?.produkty ?? []) {
        if (x.ukryty) continue;
        const rodzaj = x.rodzaj === 'kreacja' ? 'kreacja' : x.rodzaj === 'chip' ? 'chip' : 'print';
        klocki.push({ id: x.id, rodzaj, tytul: x.tytul, opis: x.opis || '', kiedy: x.kiedy, media: x.obraz ? { typ: 'obraz', url: `/wystawa/plik/${x.id}` } : null });
    }
    for (const x of p ?? []) {
        klocki.push({
            id: `apka-${x.id}`, rodzaj: x.typ === 'gra' ? 'gra' : 'apka', tytul: x.nazwa, opis: x.opis || '', kiedy: x.ostatnia,
            media: x.zrzut ? { typ: 'obraz', url: `/api/appstudio/projekty/${encodeURIComponent(x.id)}/zrzut` } : null,
            otworz: x.zbudowana ? `/apki/${encodeURIComponent(x.id)}/` : null,
            iteracji: x.iteracji ?? 0,
        });
    }
    for (const m of a ?? []) {
        if (m.stan && m.stan !== 'gotowe' && m.stan !== 'gotowy') continue;   // model w trakcie liczenia to jeszcze nie klocek
        klocki.push({
            id: `model-${m.id}`, rodzaj: 'model3d', tytul: m.nazwa || m.id, opis: m.opis || '', kiedy: m.utworzono,
            media: { typ: 'obraz', url: `/api/assety3d/${encodeURIComponent(m.id)}/plik/obraz.png` },
            model: `/api/assety3d/${encodeURIComponent(m.id)}/plik/model.glb`,
        });
    }

    for (const pr of ps ?? []) {
        for (const k of pr.kroki ?? []) {
            if (k.stan !== 'gotowe' || !k.wklad) continue;
            klocki.push({
                id: `wklad-${pr.id}-${k.agent}${k.synteza ? '-biblia' : ''}`, rodzaj: 'wklad', wlasciciel: k.agent,
                tytul: `${pr.nazwa}: ${k.synteza ? 'Biblia projektu' : k.zadanie.split(':')[0]}`,
                opis: k.wklad, kiedy: k.do, projekt: pr.id, model: null, silnik: k.model,
            });
        }
    }

    const agenci = {};
    for (const k of klocki.sort((x, y) => String(y.kiedy ?? '').localeCompare(String(x.kiedy ?? '')))) {
        const kto = k.wlasciciel ?? WLASCICIELE[k.rodzaj];
        if (!kto) continue;
        const a2 = (agenci[kto] ||= { klocki: [], razem: 0 });
        a2.razem++;
        if (a2.klocki.length < NA_AGENTA) a2.klocki.push(k);
    }

    // Ślady na szynie: agent po imieniu albo id gatunku (jak stanDlaApki), najnowsze pierwsze.
    const poNazwie = new Map();
    for (const g of gatunki) { poNazwie.set(String(g.imie || '').toLowerCase(), g.id); poNazwie.set(String(g.id || '').toLowerCase(), g.id); }
    for (const z of [...zdarzenia].reverse()) {
        const id = poNazwie.get(String(z.agent || '').toLowerCase());
        if (!id) continue;
        const a2 = (agenci[id] ||= { klocki: [], razem: 0 });
        (a2.slady ||= []);
        if (a2.slady.length < SLADOW) a2.slady.push({ kiedy: z.kiedy, rodzaj: z.rodzaj, tresc: String(z.tresc ?? '').slice(0, 300) });
    }
    for (const a2 of Object.values(agenci)) a2.slady ||= [];

    return { wlasciciele: WLASCICIELE, agenci };
}

export default { zbierzKlocki, WLASCICIELE };
