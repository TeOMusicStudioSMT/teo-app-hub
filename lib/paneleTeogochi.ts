/**
 * 🥚🛠️ Klient kreatora paneli TeOgochi.
 *
 * Wszystko, co tu widać, pochodzi z MOSTU: lista domen to odczyt z jego żywego
 * routera, a nie tablica wpisana w przeglądarce. Dzięki temu panel nie może
 * obiecać narzędzia, którego nie ma — a gdy trasa zniknie po aktualizacji,
 * zniknie też z wyboru, zamiast zostawić guzik prowadzący donikąd.
 */
const MOST = 'http://127.0.0.1:3001';

export interface Narzedzie {
    metoda: string;
    sciezka: string;
    parametry?: string[];
}

export interface Domena {
    id: string;
    prefiks: string;
    narzedzia: Narzedzie[];
    ile: number;
}

export interface Jajo {
    ziarno: string;
    formy: Record<string, string>;
    kolor: string;
}

export interface PanelDef {
    gatunek: string;
    nazwa: string;
    opis: string;
    domena: string | null;
    narzedzia: Narzedzie[];
    jajo: Jajo;
    utworzony: string;
    ofertaId: string | null;
}

async function json<T>(r: Response): Promise<T> {
    const d = await r.json();
    if (!r.ok || d?.success === false) throw new Error(d?.message || `Most odmówił (HTTP ${r.status}).`);
    return d as T;
}

export async function pobierzDomeny(): Promise<Domena[]> {
    const d = await json<{ domeny: Domena[] }>(await fetch(`${MOST}/api/teogochi/domeny`));
    return d.domeny;
}

export async function pobierzPanele(): Promise<PanelDef[]> {
    const d = await json<{ panele: PanelDef[] }>(await fetch(`${MOST}/api/teogochi/panele`));
    return d.panele;
}

export async function losujJajo(ziarno?: string): Promise<Jajo> {
    const d = await json<{ jajo: Jajo }>(await fetch(`${MOST}/api/teogochi/panel/jajo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ziarno }),
    }));
    return d.jajo;
}

export async function zapiszPanel(wejscie: {
    gatunek: string; domena: string | null; narzedzia: Narzedzie[];
    jajo: Jajo; nazwa: string; opis: string; wlasneJajo?: boolean;
}): Promise<PanelDef> {
    const d = await json<{ panel: PanelDef }>(await fetch(`${MOST}/api/teogochi/panel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wejscie),
    }));
    return d.panel;
}

export async function wystawPanel(gatunek: string, priceGrv: number, creator: string) {
    return json<{ oferta: { id: string; name: string } }>(await fetch(`${MOST}/api/teogochi/panel/wystaw`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatunek, priceGrv, creator }),
    }));
}

export async function usunPanel(gatunek: string) {
    return json(await fetch(`${MOST}/api/teogochi/panel/usun`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatunek }),
    }));
}

/**
 * Wywołanie narzędzia panelu.
 *
 * ⚠️ Zwracamy SUROWĄ odpowiedź razem ze statusem — także błędną. Panel ma
 * pokazać, co most naprawdę powiedział; ładne „gotowe!" po nieudanym wywołaniu
 * byłoby atrapą na ostatnim metrze.
 */
export async function wywolajNarzedzie(
    n: Narzedzie,
    parametry: Record<string, string>,
    cialo?: string,
): Promise<{ status: number; tekst: string }> {
    let sciezka = n.sciezka;
    for (const p of n.parametry ?? []) {
        sciezka = sciezka.replace(`:${p}`, encodeURIComponent(parametry[p] ?? ''));
    }
    const opcje: RequestInit = { method: n.metoda };
    if (n.metoda !== 'GET' && n.metoda !== 'HEAD') {
        opcje.headers = { 'Content-Type': 'application/json' };
        opcje.body = cialo?.trim() ? cialo : '{}';
    }
    try {
        const r = await fetch(`${MOST}${sciezka}`, opcje);
        const t = await r.text();
        return { status: r.status, tekst: t };
    } catch (e) {
        return { status: 0, tekst: `Most nie odpowiada: ${(e as Error).message}` };
    }
}

export default { pobierzDomeny, pobierzPanele, losujJajo, zapiszPanel, wystawPanel, usunPanel, wywolajNarzedzie };
