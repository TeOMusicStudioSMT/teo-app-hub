/**
 * 💬 Historia czatu Katedry — jeden plik jest bazą danych.
 *
 * Czat operacyjny nie miał pamięci: zamknięcie okna kasowało rozmowę. Teraz
 * sesje leżą w `_OtakOs_Wymiar/czaty.json` i to ON jest bazą — nie kopią,
 * nie cache'em. Front go czyta i do niego pisze, a nic nie istnieje „tylko
 * w przeglądarce".
 *
 * DLACZEGO PLIK, A NIE localStorage:
 * localStorage ginie przy czyszczeniu przeglądarki, nie da się go zgrać na USB
 * ani przejrzeć bez otwierania Katedry. Plik JSON jest suwerenny: da się go
 * skopiować, wersjonować i przeczytać w notatniku.
 *
 * DLACZEGO JEDEN PLIK, A NIE KATALOG SESJI:
 * Suweren poprosił o „plik, który jest bazą". Przy rozmiarach czatu (kilkaset
 * wiadomości) jeden dokument czyta się w milisekundy, a ma tę przewagę, że widać
 * całość na raz. Gdyby urósł — dzielimy, ale nie zawczasu.
 *
 * ⚠️ ZAPIS JEST ATOMOWY (plik tymczasowy + rename). Bez tego przerwany zapis
 * zostawiłby obcięty JSON, czyli utratę CAŁEJ historii, a nie jednej rozmowy.
 */
import fs from 'fs/promises';
import path from 'path';

const PLIK = () => path.join(process.cwd(), '_OtakOs_Wymiar', 'czaty.json');

/** Ile sesji trzymamy. Starsze wypadają — baza ma być żywa, nie archiwum wszystkiego. */
const MAX_SESJI = 50;
/** Ile wiadomości w jednej sesji. Ucinamy od początku, bo liczy się ogon rozmowy. */
const MAX_WIADOMOSCI = 400;

async function czytaj() {
    try {
        const t = await fs.readFile(PLIK(), 'utf8');
        const d = JSON.parse(t);
        return { wersja: 1, sesje: [], ...d };
    } catch {
        return { wersja: 1, sesje: [] };
    }
}

async function zapisz(d) {
    const cel = PLIK();
    await fs.mkdir(path.dirname(cel), { recursive: true });
    const tymczasowy = `${cel}.tmp`;
    await fs.writeFile(tymczasowy, JSON.stringify(d, null, 2), 'utf8');
    await fs.rename(tymczasowy, cel);   // atomowa podmiana
}

/** Tytuł z pierwszej wypowiedzi Suwerena — bez wymyślania „Rozmowa 1". */
function tytulZWiadomosci(wiadomosci) {
    const pierwsza = (wiadomosci || []).find(m => m.sender === 'human' && String(m.content || '').trim());
    if (!pierwsza) return 'Rozmowa bez pytania';
    const t = String(pierwsza.content).replace(/\s+/g, ' ').trim();
    return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

/** Lista sesji — bez treści wiadomości, żeby pasek historii ładował się od razu. */
export async function listaSesji(ile = 3) {
    const d = await czytaj();
    const n = Math.max(1, Math.min(50, Number(ile) || 3));
    return {
        plik: PLIK(),
        wszystkich: d.sesje.length,
        sesje: d.sesje
            .slice()
            .sort((a, b) => (b.zmieniona || 0) - (a.zmieniona || 0))
            .slice(0, n)
            .map(s => ({
                id: s.id,
                tytul: s.tytul,
                utworzona: s.utworzona,
                zmieniona: s.zmieniona,
                ile: (s.wiadomosci || []).length,
                uczestnicy: [...new Set((s.wiadomosci || []).map(m => m.sender))],
            })),
    };
}

export async function wczytajSesje(id) {
    const d = await czytaj();
    return d.sesje.find(s => s.id === id) ?? null;
}

/**
 * Zapisz sesję (wstaw albo nadpisz). Zwraca zapisany wpis.
 *
 * ⚠️ Pusta sesja NIE trafia do bazy. Inaczej samo otwarcie Katedry produkowałoby
 * puste rozmowy i pasek historii zapełniłby się niczym.
 */
export async function zapiszSesje({ id, wiadomosci, tytul }) {
    const lista = Array.isArray(wiadomosci) ? wiadomosci : [];
    if (!lista.length) return { ok: false, powod: 'Pusta rozmowa — nie ma czego zapisywać.' };

    const d = await czytaj();
    const teraz = Date.now();
    const identyfikator = String(id || `czat_${teraz.toString(36)}`);

    const wpis = {
        id: identyfikator,
        tytul: (tytul && String(tytul).trim()) || tytulZWiadomosci(lista),
        utworzona: d.sesje.find(s => s.id === identyfikator)?.utworzona ?? teraz,
        zmieniona: teraz,
        wiadomosci: lista.slice(-MAX_WIADOMOSCI).map(m => ({
            id: String(m.id ?? ''),
            sender: String(m.sender ?? 'system'),
            content: String(m.content ?? ''),
            timestamp: m.timestamp ?? teraz,
        })),
    };

    d.sesje = [wpis, ...d.sesje.filter(s => s.id !== identyfikator)]
        .sort((a, b) => (b.zmieniona || 0) - (a.zmieniona || 0))
        .slice(0, MAX_SESJI);

    await zapisz(d);
    return { ok: true, sesja: { id: wpis.id, tytul: wpis.tytul, ile: wpis.wiadomosci.length, zmieniona: wpis.zmieniona } };
}

export async function usunSesje(id) {
    const d = await czytaj();
    const przed = d.sesje.length;
    d.sesje = d.sesje.filter(s => s.id !== id);
    if (d.sesje.length === przed) return { ok: false, powod: 'Nie ma takiej rozmowy.' };
    await zapisz(d);
    return { ok: true };
}

export default { listaSesji, wczytajSesje, zapiszSesje, usunSesje };
