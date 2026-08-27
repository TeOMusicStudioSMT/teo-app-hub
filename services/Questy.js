/**
 * 🗺️ Program questowy — droga od Herolda wzwyż.
 *
 * Osiągnięcia (Rangi.js) są zero-jedynkowe: masz albo nie masz. Questy są
 * STOPNIOWANE — widać, ile brakuje, i płacą GRV z puli zarządcy.
 *
 * TA SAMA ZASADA CO PRZY RANGACH: postęp liczy się WYŁĄCZNIE z plików, które
 * most zapisuje sam. Kuszące było liczyć XP i ewolucje TeOgochi wprost — ale
 * one żyją w localStorage przeglądarki, więc quest „wyewoluuj trzy gatunki"
 * dałoby się zaliczyć wpisując liczbę w konsoli.
 *
 * TeOgochi są tu centralne, tylko mierzone od strony SKUTKÓW: rozmowa Klatki
 * z Joanną liczy się, bo zostawiła ślad na szynie. Agent, który nic nie zrobił,
 * nie popycha questu ani o krok — i to jest uczciwe.
 *
 * Nagroda idzie przelewem z węzła `TeO` (zarządca, saldo nieskończone) tą samą
 * drogą co każdy inny ruch GRV — z pieczęcią w łańcuchu. Żadnej drugiej ścieżki
 * emisji, bo księga z dwoma wejściami przestaje być księgą.
 */
import fs from 'fs/promises';
import path from 'path';

const wymiar = (...p) => path.join(process.cwd(), '_OtakOs_Wymiar', ...p);
const kopie = (...p) => path.join(process.cwd(), '_OtakOs_Kopie', ...p);
const PLIK_POSTEPU = () => wymiar('questy.json');

async function czytajLinie(sciezka) {
    try {
        return (await fs.readFile(sciezka, 'utf8')).trim().split('\n')
            .map(l => { try { return JSON.parse(l); } catch { return null; } })
            .filter(Boolean);
    } catch { return []; }
}
async function czytajJson(sciezka, domyslne) {
    try { return JSON.parse(await fs.readFile(sciezka, 'utf8')); } catch { return domyslne; }
}

/**
 * Questy pogrupowane po szczeblu, na którym się je podejmuje.
 * `cel` to liczba do osiągnięcia, `licz(f)` zwraca stan bieżący.
 */
export const QUESTY = [
    // ── Szczebel HEROLD → droga do Filara ────────────────────────────────────
    {
        id: 'stado-piatka', szczebel: 'herald', ikona: '🐣',
        nazwa: 'Stado Piątki',
        opis: 'Pięciu różnych TeOgochi wykonało pracę i zameldowało to na szynie.',
        nagroda: 5_000, cel: 5,
        licz: (f) => f.agenci.size,
    },
    {
        id: 'rozmowny-dom', szczebel: 'herald', ikona: '💬',
        nazwa: 'Rozmowny Dom',
        opis: 'Dziesięć wymian między agentami — pytanie i odpowiedź liczą się osobno.',
        nagroda: 7_500, cel: 10,
        licz: (f) => f.zdarzenia.filter(z => z.rodzaj === 'pytanie' || z.rodzaj === 'odpowiedz').length,
    },
    {
        id: 'reka-mechanika', szczebel: 'herald', ikona: '🔧',
        nazwa: 'Ręka Mechanika',
        opis: 'Trzy łatki wdrożone i potwierdzone weryfikacją.',
        nagroda: 10_000, cel: 3,
        licz: (f) => f.naprawy.filter(n => n.wynik === 'wdrozone').length,
    },
    {
        id: 'pierwsza-polka', szczebel: 'herald', ikona: '🎒',
        nazwa: 'Pierwsza Półka',
        opis: 'Trzy aktywa nabyte w Marketplace.',
        nagroda: 5_000, cel: 3,
        licz: (f, wezel) => f.aktywa.filter(a => a.wlasciciel === wezel).length,
    },

    // ── Szczebel FILAR → droga do Foundera ───────────────────────────────────
    {
        id: 'sto-meldunkow', szczebel: 'pillar', ikona: '📡',
        nazwa: 'Sto Meldunków',
        opis: 'Sto zdarzeń na szynie — Katedra realnie pracuje, nie stoi.',
        nagroda: 25_000, cel: 100,
        licz: (f) => f.zdarzenia.length,
    },
    {
        id: 'straz-jakosci', szczebel: 'pillar', ikona: '↩️',
        nazwa: 'Straż Jakości',
        opis: 'Pętla naprawcza rozpatrzyła dziesięć łatek — wdrożonych lub cofniętych. '
            + 'Cofka liczy się TAK SAMO: złapany błąd to sukces, nie porażka.',
        nagroda: 30_000, cel: 10,
        licz: (f) => f.naprawy.length,
    },
    {
        id: 'caly-kolektyw', szczebel: 'pillar', ikona: '🏛️',
        nazwa: 'Cały Kolektyw',
        opis: 'Ośmiu różnych TeOgochi zameldowało pracę — ponad połowa gatunków żyje.',
        nagroda: 50_000, cel: 8,
        licz: (f) => f.agenci.size,
    },

    // ── Szczebel FOUNDER → droga dalej ───────────────────────────────────────
    {
        id: 'tysiac-sladow', szczebel: 'founder', ikona: '🌌',
        nazwa: 'Tysiąc Śladów',
        opis: 'Tysiąc zdarzeń na szynie. To już nie eksperyment, tylko żywy ekosystem.',
        nagroda: 100_000, cel: 1000,
        licz: (f) => f.zdarzenia.length,
    },
    {
        id: 'pelne-stado', szczebel: 'founder', ikona: '👑',
        nazwa: 'Pełne Stado',
        opis: 'Wszystkie trzynaście gatunków TeOgochi wykonało realną pracę.',
        nagroda: 250_000, cel: 13,
        licz: (f) => f.agenci.size,
    },
];

async function zbierzFakty() {
    const zdarzenia = await czytajLinie(wymiar('szyna.jsonl'));
    const naprawy = await czytajLinie(kopie('naprawy', 'dziennik.jsonl'));
    const posiadane = await czytajJson(wymiar('posiadane.json'), { aktywa: [] });
    return {
        zdarzenia, naprawy, aktywa: posiadane.aktywa || [],
        // Agenci systemowi też meldują, ale to WŁAŚNIE są TeOgochi — kupiec,
        // bilans i kodeks to gatunki, nie infrastruktura.
        agenci: new Set(zdarzenia.map(z => z.agent)),
    };
}

/** Które questy węzeł już odebrał (nagroda wypłacona). */
async function odebrane(wezel) {
    const d = await czytajJson(PLIK_POSTEPU(), { odebrane: {} });
    return new Set(d.odebrane?.[wezel] ?? []);
}

async function zapiszOdebrany(wezel, questId) {
    const d = await czytajJson(PLIK_POSTEPU(), { wersja: 1, odebrane: {} });
    d.odebrane = d.odebrane || {};
    d.odebrane[wezel] = [...new Set([...(d.odebrane[wezel] ?? []), questId])];
    await fs.mkdir(path.dirname(PLIK_POSTEPU()), { recursive: true });
    await fs.writeFile(PLIK_POSTEPU(), JSON.stringify(d, null, 2), 'utf8');
}

/** Pełny stan questów dla węzła: postęp, gotowość, co już odebrane. */
export async function stanQuestow(wezel) {
    const f = await zbierzFakty();
    const juz = await odebrane(wezel);
    const lista = QUESTY.map(q => {
        let teraz = 0;
        try { teraz = Number(q.licz(f, wezel)) || 0; } catch { teraz = 0; }
        const ukonczony = teraz >= q.cel;
        return {
            id: q.id, szczebel: q.szczebel, ikona: q.ikona, nazwa: q.nazwa, opis: q.opis,
            nagroda: q.nagroda, cel: q.cel, teraz: Math.min(teraz, q.cel),
            procent: Math.min(100, Math.round((teraz / q.cel) * 100)),
            ukonczony, odebrany: juz.has(q.id),
            doOdbioru: ukonczony && !juz.has(q.id),
        };
    });
    return {
        questy: lista,
        ukonczonych: lista.filter(q => q.ukonczony).length,
        doOdbioru: lista.filter(q => q.doOdbioru).length,
        czekaGrv: lista.filter(q => q.doOdbioru).reduce((s, q) => s + q.nagroda, 0),
    };
}

/** Czy quest da się odebrać. Zwraca definicję albo powód odmowy. */
export async function sprawdzOdbior(wezel, questId) {
    const q = QUESTY.find(x => x.id === questId);
    if (!q) return { ok: false, powod: `Nie ma questu „${questId}".` };
    const s = await stanQuestow(wezel);
    const stan = s.questy.find(x => x.id === questId);
    if (stan.odebrany) return { ok: false, powod: `Nagroda za „${q.nazwa}" została już wypłacona.` };
    if (!stan.ukonczony) {
        return { ok: false, powod: `„${q.nazwa}": ${stan.teraz} z ${q.cel}. Questu nie da się odebrać na zapas.` };
    }
    return { ok: true, quest: q };
}

export { zapiszOdebrany };
export default { QUESTY, stanQuestow, sprawdzOdbior, zapiszOdebrany };
