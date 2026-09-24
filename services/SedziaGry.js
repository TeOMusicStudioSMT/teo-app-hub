/**
 * ⚖️ SĘDZIA GRY — sprawdza, czy zlecenie NAPRAWDĘ coś zmieniło w działającej grze.
 *
 * PO CO. Kodeks raz po raz oddawał kod, który się kompiluje, przechodzi test w przeglądarce
 * i… nic nie robi (zmierzone 2026-09-22/24): moduł bez importu, mikstura nigdy nie dodana do
 * sceny, `inicjalizujDzwiek()` bez wywołania, warunek `ctx !== null` blokujący sam siebie.
 * Build i „canvas żyje" tego nie łapią. Ten sędzia patrzy na ZACHOWANIE, nie na kod.
 *
 * JAK. Z treści zlecenia wyciągamy oczekiwania po słowach kluczowych (dźwięk, minimapa, pasek,
 * klawisz X, ekran śmierci, poziomy…) i sprawdzamy je na żywej stronie: stan `window.__gra`,
 * elementy DOM, reakcja na klawisze. Każdy sprawdzian jest deterministyczny i ma jedno zdanie
 * wyjaśnienia dla modelu.
 *
 * ZASADA 0.00G: czego nie umiemy sprawdzić, tego nie oceniamy — brak sprawdzianu to „przepuszczam",
 * nigdy „padło". Sędzia ma łapać martwy kod, nie blokować pracy.
 */

/** Klawisz wymieniony w zleceniu: „klawisz I", „klawiszem M", „na klawisz F". */
export function klawiszeZeZlecenia(cel) {
    const out = new Set();
    for (const m of String(cel).matchAll(/klawisz(?:em|u)?\s+[„"']?([A-Za-z])\b/g)) out.add(m[1].toUpperCase());
    return [...out].slice(0, 3);
}

/**
 * Lista sprawdzianów dla danego zlecenia. Każdy: { id, opis, powod, sprawdz(m) → bool|null }
 * gdzie `m` to materiał zebrany w przeglądarce, a `null` znaczy „nie umiem ocenić".
 */
export function sprawdziany(cel) {
    const t = String(cel).toLowerCase();
    const lista = [];

    if (/dźwięk|dzwiek|audio|webaudio|sound/.test(t)) lista.push({
        id: 'dzwiek',
        opis: 'dźwięk startuje po akcji gracza',
        powod: 'zlecenie dotyczy dźwięku, ale po ataku i klawiszach kontekst audio nadal nie działa (window.__gra.dzwiek). Sprawdź, czy funkcja odtwarzająca jest w ogóle wołana i czy nie blokuje jej własny warunek (np. „ctx !== null" zanim ctx powstanie).',
        sprawdz: (m) => (m.po?.gra?.dzwiek ? m.po.gra.dzwiek.kontekst === 'running' : null),
    });

    if (/minimap/.test(t)) lista.push({
        id: 'minimapa',
        opis: 'minimapa jest w DOM i ma kropki',
        powod: 'zlecenie dotyczy minimapy, ale w DOM nie ma jej elementu albo jest pusta.',
        sprawdz: (m) => !!m.po?.dom?.minimapa && m.po.dom.minimapa > 0,
    });

    if (/pasek hp|paski hp|pasek zdrowia|nad głow|nad glow/.test(t)) lista.push({
        id: 'paski',
        opis: 'paski nad postaciami są w DOM',
        powod: 'zlecenie dotyczy pasków nad postaciami, ale w DOM nie ma ani jednego (nakładka #paski-hp jest pusta).',
        sprawdz: (m) => (m.po?.dom?.paskiHp === undefined ? null : m.po.dom.paskiHp > 0),
    });

    if (/hud|licznik|wyświetl|wyswietl/.test(t)) lista.push({
        id: 'hud',
        opis: 'HUD pokazuje treść',
        powod: 'zlecenie dotyczy HUD-u, a #hud jest pusty — nic się w nim nie pojawiło.',
        sprawdz: (m) => (m.po?.hud === undefined ? null : m.po.hud.trim().length > 0),
    });

    for (const k of klawiszeZeZlecenia(cel)) lista.push({
        id: `klawisz-${k}`,
        opis: `klawisz ${k} coś zmienia`,
        powod: `zlecenie mówi o klawiszu ${k}, ale jego wciśnięcie nie zmienia ani stanu gry (window.__gra), ani DOM-u — obsługa albo nie istnieje, albo nic nie robi.`,
        sprawdz: (m) => {
            const przed = m.klawisze?.[k]?.przed, po = m.klawisze?.[k]?.po;
            if (!przed || !po) return null;
            return przed.stan !== po.stan || przed.dom !== po.dom;
        },
    });

    if (/poziom|doświadczen|doswiadczen|\bpd\b|\bexp\b|\bxp\b/.test(t)) lista.push({
        id: 'poziomy',
        opis: 'stan gry zna poziom lub punkty doświadczenia',
        powod: 'zlecenie dotyczy poziomów/PD, ale window.__gra nie ma żadnego pola z poziomem ani punktami — nie da się tego ani pokazać, ani przetestować.',
        sprawdz: (m) => (m.po?.gra ? Object.keys(m.po.gra).some((k) => /poziom|^pd$|doswiad|exp|xp/i.test(k)) : null),
    });

    return lista;
}

/** Czy dla tego zlecenia w ogóle mamy co sprawdzać (żeby nie zbierać materiału bez potrzeby). */
export function czyWarto(cel) {
    return sprawdziany(cel).length > 0;
}

/**
 * Ocena. `material`: { przed, po, klawisze } zebrane przez AppStudio w przeglądarce.
 * Zwraca { ok, powod, zdane: [...], nieocenione: [...] }.
 */
export function ocen(cel, material) {
    const lista = sprawdziany(cel);
    const zdane = [], oblane = [], nieocenione = [];
    for (const s of lista) {
        let wynik = null;
        try { wynik = s.sprawdz(material); } catch { wynik = null; }
        if (wynik === null) nieocenione.push(s.opis);
        else if (wynik) zdane.push(s.opis);
        else oblane.push(s);
    }
    if (!oblane.length) return { ok: true, powod: null, zdane, nieocenione };
    return { ok: false, powod: oblane.map((s) => s.powod).join(' '), zdane, nieocenione, oblane: oblane.map((s) => s.id) };
}

export default { sprawdziany, czyWarto, ocen, klawiszeZeZlecenia };
