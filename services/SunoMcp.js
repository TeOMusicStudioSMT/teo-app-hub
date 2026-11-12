/**
 * 🎵🔌 Suno MCP w moście (Suweren 2026-11-01: „adaptacja suno.com/mcp — bezpośrednio podłączyć do Katedry z moim kontem Suno”).
 *
 * Oficjalny serwer Suno `https://api.suno.com/mcp` (MCP, streamable HTTP) chroni OAuth 2.1 (sprawdzone 2026-11-01):
 *   401 + `WWW-Authenticate: Bearer resource_metadata=…/.well-known/oauth-protected-resource/mcp`
 *   → serwer autoryzacji `studio-api-prod.suno.com/api/v2/external/oauth` (rejestracja klienta w locie, PKCE S256,
 *     klient publiczny `none`, refresh_token przez `offline_access`).
 * Most jest KLIENTEM: Suweren raz loguje się kontem Suno w przeglądarce (zgoda Suno), powrót na pętlę zwrotną
 * `http://127.0.0.1:3001/api/suno/zwrot` (Straż: tylko z tej maszyny, `state` + PKCE), token odświeżania idzie do
 * Skarbca 0.00G (`suno.refresh_token`, AES-256-GCM), token dostępu żyje tylko w pamięci. Hub, Główny i stado mówią
 * do Suno przez most — klucze nie wychodzą z mostu.
 *
 * KREDYTY: narzędzie bez `readOnlyHint: true` z listy Suno może wydać kredyty. Suweren 2026-11-12: „ustaw domyślnie
 * zgoda = true, aby wywołania z Katedry i od Jasona nie blokowały się na pytaniach” → brak pola `zgoda` = ZGODA DOMYŚLNA
 * (włączona; wyłącza ją `OTAKOS_SUNO_ZGODA=pytaj` albo `POST /api/suno/zgoda {domyslna: false}` — wtedy jak dawniej
 * wymagane `zgoda: true`). Jawne `zgoda: false` zawsze odmawia. Każde płatne wywołanie zostaje w historii i na szynie.
 * Wynik każdego wywołania jest przeglądany: utwory z gotowym plikiem audio lądują w `_OtakOs_Muzyka/Suno MCP/`
 * (`<tytuł> [<id8>].mp3`, raz) — biblioteka Katedry (/api/rytm/utwory, Radio, Taneczne Starcie, Warsztat).
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const ADRES_MCP = 'https://api.suno.com/mcp';
export const SCIEZKA_ZWROTU = '/api/suno/zwrot';
export const ZAKRESY = ['api:v0', 'credits:spend', 'download', 'library:read', 'library:search', 'library:write', 'offline_access', 'profile:read'];
export const WERSJA_PROTOKOLU = '2025-06-18';
export const KATALOG_MUZYKI = 'Suno MCP';
const USLUGA = 'suno';
const LIMIT_MS = 120_000;

/**
 * fetch po HTTP/2 dla https (2026-11-01, zmierzone na maszynie Suwerena): Avast (aswMonFltProxy) skanuje HTTPS i psuje
 * odpowiedzi HTTP/1.1 z `/mcp` i `/.well-known/oauth-protected-resource` („Invalid character in chunk size” — undici
 * i nawet `insecureHTTPParser` odpadają). Przez HTTP/2 nie ma kawałkowania — przechodzi czysto (tak robi curl).
 * Serwer bez HTTP/2 (ALPN) → zwykły fetch. Zwraca podzbiór Response: status, ok, headers.get, text, arrayBuffer.
 */
export async function fetchH2(adres, opcje = {}) {
    const u = new URL(adres);
    if (u.protocol !== 'https:') return globalThis.fetch(adres, opcje);
    const http2 = await import('http2');
    return new Promise((ok, nie) => {
        const sesja = http2.connect(u.origin, { ALPNProtocols: ['h2'] });
        let skonczone = false;
        const koniec = (e, w) => { if (skonczone) return; skonczone = true; sesja.close(); e ? nie(e) : ok(w); };
        sesja.on('error', (e) => (e.code === 'ERR_HTTP2_ERROR' || /ALPN|protocol/i.test(e.message) ? globalThis.fetch(adres, opcje).then((w) => koniec(null, w), (x) => koniec(x)) : koniec(e)));
        opcje.signal?.addEventListener?.('abort', () => { sesja.destroy(); koniec(new Error('przekroczony czas')); });
        const naglowki = { ':method': opcje.method ?? 'GET', ':path': `${u.pathname}${u.search}` };
        for (const [k, v] of Object.entries(opcje.headers ?? {})) naglowki[k.toLowerCase()] = v;
        const cialo = opcje.body == null ? null : Buffer.from(String(opcje.body));
        const q = sesja.request(naglowki, { endStream: !cialo });
        const kawalki = [];
        let odp = null;
        q.on('response', (h) => { odp = h; });
        q.on('data', (c) => kawalki.push(c));
        q.on('error', (e) => koniec(e));
        q.on('end', () => {
            const status = Number(odp?.[':status'] ?? 0);
            if ([301, 302, 303, 307, 308].includes(status) && odp.location && opcje.redirect !== 'manual') {
                skonczone = true; sesja.close();
                return fetchH2(new URL(odp.location, adres).toString(), status === 303 ? { ...opcje, method: 'GET', body: null } : opcje).then(ok, nie);
            }
            const dane = Buffer.concat(kawalki);
            koniec(null, { status, ok: status >= 200 && status < 300, headers: { get: (k) => { const v = odp?.[String(k).toLowerCase()]; return v == null ? null : Array.isArray(v) ? v.join(', ') : String(v); } },
                text: async () => dane.toString('utf8'), arrayBuffer: async () => dane.buffer.slice(dane.byteOffset, dane.byteOffset + dane.length) });
        });
        if (cialo) q.end(cialo);
    });
}

const b64url = (b) => Buffer.from(b).toString('base64url');
export function pkce() {
    const weryfikator = b64url(crypto.randomBytes(32));
    return { weryfikator, wyzwanie: b64url(crypto.createHash('sha256').update(weryfikator).digest()) };
}

/** Odpowiedź streamable HTTP: JSON albo SSE (`data:` linie) — zwraca wiadomość JSON-RPC o danym id. */
export function odczytajOdpowiedz(tekst, typ, id) {
    if (/text\/event-stream/i.test(typ ?? '')) {
        const wiadomosci = [];
        for (const blok of String(tekst).split(/\r?\n\r?\n/)) {
            const dane = blok.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
            if (!dane) continue;
            try { const j = JSON.parse(dane); wiadomosci.push(...(Array.isArray(j) ? j : [j])); } catch { /* komentarz/heartbeat */ }
        }
        return wiadomosci.find((w) => w.id === id) ?? null;
    }
    if (!String(tekst).trim()) return null;
    const j = JSON.parse(tekst);
    return Array.isArray(j) ? j.find((w) => w.id === id) ?? null : j;
}

/** Czy narzędzie może wydać kredyty / zmienić konto — tylko jawny `readOnlyHint: true` jest „bez pytania”. */
export function wymagaZgody(narzedzie) {
    return narzedzie?.annotations?.readOnlyHint !== true;
}

const NAZWY_AUDIO = ['audio_url', 'audioUrl', 'audio', 'stream_audio_url', 'song_url', 'mp3_url', 'download_url', 'url'];
/** Z dowolnego wyniku (structuredContent albo JSON w tekście) wyłuskuje utwory z adresem pliku audio. */
export function utworyZWyniku(wynik) {
    const korzenie = [];
    if (wynik?.structuredContent) korzenie.push(wynik.structuredContent);
    for (const c of wynik?.content ?? []) {
        if (c?.type === 'text' && typeof c.text === 'string') { try { korzenie.push(JSON.parse(c.text)); } catch { /* zwykły tekst */ } }
        if (c?.type === 'resource' && c.resource) korzenie.push(c.resource);
    }
    const znalezione = new Map();
    const widziane = new Set();
    const idz = (o, gl = 0) => {
        if (!o || typeof o !== 'object' || gl > 8 || widziane.has(o)) return;
        widziane.add(o);
        if (Array.isArray(o)) { for (const x of o) idz(x, gl + 1); return; }
        const id = o.id ?? o.clip_id ?? o.song_id ?? o.uuid;
        const adres = NAZWY_AUDIO.map((k) => o[k]).find((v) => typeof v === 'string' && /^https:\/\/\S+\.(mp3|wav|m4a)(\?|$)/i.test(v));
        if (id && adres) znalezione.set(String(id), { id: String(id), tytul: String(o.title ?? o.name ?? o.tytul ?? 'Suno').trim() || 'Suno', adres });
        for (const v of Object.values(o)) idz(v, gl + 1);
    };
    for (const k of korzenie) idz(k);
    return [...znalezione.values()];
}

export function nazwaPliku(u) {
    const ext = (u.adres.match(/\.(mp3|wav|m4a)(\?|$)/i)?.[1] ?? 'mp3').toLowerCase();
    const tytul = u.tytul.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Suno';
    return `${tytul} [${u.id.replace(/[^\w-]/g, '').slice(0, 8)}].${ext}`;
}

/**
 * @param {{ katalog: string, katalogMuzyki: string, skarbiec: { czytaj:(u:string,p:string)=>Promise<string|null>, zapisz:(u:string,p:string,v:string)=>Promise<void>, usun:(u:string,p:string)=>Promise<void> },
 *   adresMostu?: string, adresMcp?: string, adresZasobu?: string, fetch?: typeof fetch, szyna?: { nadaj?: Function }, teraz?: () => number }} cfg
 */
export function utworzSunoMcp(cfg) {
    const f = cfg.fetch ?? fetchH2;
    const teraz = cfg.teraz ?? Date.now;
    const adresMcp = cfg.adresMcp ?? ADRES_MCP;
    const zwrot = `${cfg.adresMostu ?? 'http://127.0.0.1:3001'}${SCIEZKA_ZWROTU}`;
    const plikStanu = path.join(cfg.katalog, 'suno-mcp.json');
    const katalogUtworow = path.join(cfg.katalogMuzyki, KATALOG_MUZYKI);
    const oczekujace = new Map();              // state → { weryfikator, clientId, tokenUrl, od }
    let dostep = null;                          // { token, wygasa }
    let sesja = null;                           // { id, wersja }
    let narzedzia = null;                       // ostatnia lista z Suno
    let ostatniBlad = null;
    let licznikId = 1;
    const nadaj = (tresc, dane) => { try { cfg.szyna?.nadaj?.({ agent: 'Joanna', rodzaj: 'praca', tresc, dane })?.catch?.(() => {}); } catch { /* szyna opcjonalna */ } };

    async function czytajStan() { try { return JSON.parse(await fs.readFile(plikStanu, 'utf8')); } catch { return {}; } }
    async function zapiszStan(s) { await fs.mkdir(cfg.katalog, { recursive: true }); await fs.writeFile(plikStanu, JSON.stringify(s, null, 2)); }

    async function json(adres, opcje = {}, proba = 0) {
        let r, t;
        try { r = await f(adres, { ...opcje, signal: AbortSignal.timeout(30_000) }); t = await r.text(); }
        catch (e) { if (proba < 2) return json(adres, opcje, proba + 1); throw new Error(`${adres}: ${e.message}`); }   // zerwane połączenie (keep-alive) — jeszcze raz
        let j = null; try { j = JSON.parse(t); } catch { /* nie JSON */ }
        if (!r.ok) throw new Error(`${adres} → HTTP ${r.status}: ${j?.error_description ?? j?.error ?? t.slice(0, 200)}`);
        return j;
    }

    /** Odkrycie: zasób → serwer autoryzacji → metadane (zapamiętane w stanie). */
    async function odkryj() {
        const s = await czytajStan();
        if (s.as?.authorization_endpoint && s.as?.token_endpoint && s.as?.registration_endpoint) return s.as;
        const baza = new URL(adresMcp);
        // cfg.adresZasobu — tylko testy: Avast (aswMonFltProxy) psuje lokalne odpowiedzi spod /.well-known/oauth-protected-resource
        const zasob = cfg.adresZasobu ? await json(cfg.adresZasobu) : await json(`${baza.origin}/.well-known/oauth-protected-resource${baza.pathname}`).catch(() => json(`${baza.origin}/.well-known/oauth-protected-resource`));
        const issuer = zasob?.authorization_servers?.[0];
        if (!issuer) throw new Error('Suno nie podał serwera autoryzacji.');
        const u = new URL(issuer);
        const as = await json(`${u.origin}/.well-known/oauth-authorization-server${u.pathname.replace(/\/$/, '')}`).catch(() => json(`${issuer.replace(/\/$/, '')}/.well-known/oauth-authorization-server`));
        if (!as?.authorization_endpoint || !as?.token_endpoint) throw new Error('Metadane OAuth Suno są niepełne.');
        await zapiszStan({ ...s, as: { issuer: as.issuer, authorization_endpoint: as.authorization_endpoint, token_endpoint: as.token_endpoint, registration_endpoint: as.registration_endpoint ?? null, revocation_endpoint: as.revocation_endpoint ?? null }, zasob: zasob.resource ?? null });
        return (await czytajStan()).as;
    }

    /** Klient publiczny zarejestrowany RAZ (id w Skarbcu — gdy zwrot się zmieni, rejestrujemy ponownie). */
    async function klient(as) {
        const s = await czytajStan();
        const id = await cfg.skarbiec.czytaj(USLUGA, 'client_id');
        if (id && s.zwrotKlienta === zwrot) return id;
        if (!as.registration_endpoint) throw new Error('Suno nie pozwala zarejestrować klienta (brak registration_endpoint).');
        const r = await json(as.registration_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            client_name: 'Katedra OtakOS', redirect_uris: [zwrot], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
            token_endpoint_auth_method: 'none', scope: ZAKRESY.join(' '),
        }) });
        if (!r?.client_id) throw new Error('Suno nie oddał client_id przy rejestracji.');
        await cfg.skarbiec.zapisz(USLUGA, 'client_id', r.client_id);
        await zapiszStan({ ...(await czytajStan()), zwrotKlienta: zwrot });
        return r.client_id;
    }

    /** Adres zgody Suno (Hub otwiera go w przeglądarce). */
    async function polacz() {
        const as = await odkryj();
        const clientId = await klient(as);
        const { weryfikator, wyzwanie } = pkce();
        const state = b64url(crypto.randomBytes(18));
        for (const [k, v] of oczekujace) if (teraz() - v.od > 15 * 60_000) oczekujace.delete(k);
        oczekujace.set(state, { weryfikator, clientId, tokenUrl: as.token_endpoint, od: teraz() });
        const u = new URL(as.authorization_endpoint);
        const zasob = (await czytajStan()).zasob;
        Object.entries({ response_type: 'code', client_id: clientId, redirect_uri: zwrot, scope: ZAKRESY.join(' '), state, code_challenge: wyzwanie, code_challenge_method: 'S256', ...(zasob ? { resource: zasob } : {}) })
            .forEach(([k, v]) => u.searchParams.set(k, v));
        return { adres: u.toString() };
    }

    async function zapiszTokeny(t) {
        if (!t?.access_token) throw new Error('Suno nie oddał tokenu dostępu.');
        dostep = { token: t.access_token, wygasa: teraz() + Math.max(60, Number(t.expires_in) || 3600) * 1000 - 60_000 };
        if (t.refresh_token) await cfg.skarbiec.zapisz(USLUGA, 'refresh_token', t.refresh_token);
        sesja = null;
    }

    /** Powrót z ekranu zgody: kod → tokeny. */
    async function zwrotZgody({ code, state, error, error_description: opis }) {
        if (error) throw new Error(`Suno odmówił: ${opis ?? error}`);
        const o = oczekujace.get(String(state ?? ''));
        if (!o) throw new Error('Nieznany albo przeterminowany „state” — zacznij łączenie od nowa.');
        oczekujace.delete(String(state));
        const t = await json(o.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
            grant_type: 'authorization_code', code: String(code ?? ''), redirect_uri: zwrot, client_id: o.clientId, code_verifier: o.weryfikator,
        }) });
        await zapiszTokeny(t);
        await zapiszStan({ ...(await czytajStan()), polaczono: new Date(teraz()).toISOString() });
        ostatniBlad = null;
        nadaj('🎵 Suno połączone z Katedrą');
        const st = await stan({ odswiez: true }).catch((e) => ({ blad: e.message }));
        return st;
    }

    async function tokenDostepu() {
        if (dostep && teraz() < dostep.wygasa) return dostep.token;
        const odswiezajacy = await cfg.skarbiec.czytaj(USLUGA, 'refresh_token');
        if (!odswiezajacy) throw Object.assign(new Error('Suno niepołączone — połącz konto (Impresariat → 🎵 Suno).'), { kod: 'NIEPOLACZONE' });
        const as = await odkryj();
        const clientId = await cfg.skarbiec.czytaj(USLUGA, 'client_id');
        try {
            await zapiszTokeny(await json(as.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: odswiezajacy, client_id: clientId ?? '' }) }));
        } catch (e) {
            if (/HTTP 4\d\d/.test(e.message)) { await cfg.skarbiec.usun(USLUGA, 'refresh_token').catch(() => {}); dostep = null; throw Object.assign(new Error(`Suno unieważnił dostęp — połącz konto ponownie. (${e.message})`), { kod: 'NIEPOLACZONE' }); }
            throw e;
        }
        return dostep.token;
    }

    /** Jedno żądanie JSON-RPC do serwera Suno (z ponowieniem po 401 i po zgubionej sesji). */
    async function rpc(metoda, params, { powiadomienie = false, proba = 0 } = {}) {
        const token = await tokenDostepu();
        const id = powiadomienie ? undefined : licznikId++;
        const naglowki = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}`, 'MCP-Protocol-Version': sesja?.wersja ?? WERSJA_PROTOKOLU };
        if (sesja?.id) naglowki['Mcp-Session-Id'] = sesja.id;
        const r = await f(adresMcp, { method: 'POST', headers: naglowki, body: JSON.stringify({ jsonrpc: '2.0', ...(id !== undefined ? { id } : {}), method: metoda, ...(params ? { params } : {}) }), signal: AbortSignal.timeout(LIMIT_MS) });
        if (r.status === 401 && proba < 1) { dostep = null; return rpc(metoda, params, { powiadomienie, proba: proba + 1 }); }
        if (r.status === 404 && sesja?.id && proba < 1 && metoda !== 'initialize') { sesja = null; await inicjuj(); return rpc(metoda, params, { powiadomienie, proba: proba + 1 }); }
        const sid = r.headers.get('mcp-session-id');
        const tekst = await r.text();
        if (!r.ok && r.status !== 202) throw new Error(`Suno MCP ${metoda} → HTTP ${r.status}: ${tekst.slice(0, 300)}`);
        if (powiadomienie) return null;
        const w = odczytajOdpowiedz(tekst, r.headers.get('content-type'), id);
        if (!w) throw new Error(`Suno MCP ${metoda}: pusta odpowiedź.`);
        if (w.error) throw new Error(`Suno MCP ${metoda}: ${w.error.message ?? JSON.stringify(w.error)}`);
        if (metoda === 'initialize') sesja = { id: sid ?? null, wersja: w.result?.protocolVersion ?? WERSJA_PROTOKOLU, serwer: w.result?.serverInfo ?? null, instrukcje: w.result?.instructions ?? null };
        return w.result;
    }

    async function inicjuj() {
        if (sesja) return sesja;
        await rpc('initialize', { protocolVersion: WERSJA_PROTOKOLU, capabilities: {}, clientInfo: { name: 'katedra-otakos', version: '1.0.0' } });
        await rpc('notifications/initialized', null, { powiadomienie: true }).catch(() => {});
        return sesja;
    }

    async function listaNarzedzi({ odswiez = false } = {}) {
        if (narzedzia && !odswiez) return narzedzia;
        await inicjuj();
        const wszystkie = [];
        let kursor;
        do { const r = await rpc('tools/list', kursor ? { cursor: kursor } : {}); wszystkie.push(...(r?.tools ?? [])); kursor = r?.nextCursor; } while (kursor && wszystkie.length < 500);
        narzedzia = wszystkie;
        return narzedzia;
    }

    /** Ściąga gotowe utwory z wyniku do biblioteki (raz na id). `gotowe` = lista { id, tytul, adres } zamiast wyniku (Jason: adres z audio-download). */
    async function zapiszUtwory(wynik, gotowe = null) {
        const utwory = gotowe ?? utworyZWyniku(wynik);
        if (!utwory.length) return [];
        await fs.mkdir(katalogUtworow, { recursive: true });
        const istniejace = await fs.readdir(katalogUtworow).catch(() => []);
        const out = [];
        for (const u of utwory) {
            const znacznik = `[${u.id.replace(/[^\w-]/g, '').slice(0, 8)}]`;
            const juz = istniejace.find((n) => n.includes(znacznik));
            if (juz) { out.push({ ...u, plik: `${KATALOG_MUZYKI}/${juz}`, nowy: false }); continue; }
            try {
                const r = await f(u.adres, { signal: AbortSignal.timeout(5 * 60_000) });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const dane = Buffer.from(await r.arrayBuffer());
                if (dane.length < 10_000) throw new Error('plik za mały — utwór pewnie jeszcze się tworzy');
                const nazwa = nazwaPliku(u);
                await fs.writeFile(path.join(katalogUtworow, nazwa), dane);
                out.push({ ...u, plik: `${KATALOG_MUZYKI}/${nazwa}`, nowy: true });
                nadaj(`🎵 Suno → biblioteka: „${u.tytul}”`, { plik: nazwa });
            } catch (e) { out.push({ ...u, blad: e.message }); }
        }
        return out;
    }

    /** Zgoda domyślna na płatne narzędzia: env `OTAKOS_SUNO_ZGODA=pytaj|0` wyłącza na sztywno, inaczej stan (domyślnie WŁ.). */
    async function zgodaDomyslna() {
        const env = String(process.env.OTAKOS_SUNO_ZGODA ?? '').toLowerCase();
        if (['pytaj', '0', 'false', 'nie'].includes(env)) return false;
        return (await czytajStan()).zgodaDomyslna !== false;
    }
    async function ustawZgodeDomyslna(wl) { await zapiszStan({ ...(await czytajStan()), zgodaDomyslna: wl !== false }); return stan(); }

    /** Wywołanie narzędzia Suno. Płatne/zmieniające (bez readOnlyHint): `zgoda: true`, a bez pola — zgoda domyślna; `false` odmawia. */
    async function wywolaj(nazwa, args = {}, { zgoda, zapisz = true, tytul = null } = {}) {
        const lista = await listaNarzedzi();
        const n = lista.find((x) => x.name === nazwa);
        if (!n) throw new Error(`Suno nie ma narzędzia „${nazwa}”. Dostępne: ${lista.map((x) => x.name).join(', ')}`);
        if (zgoda === undefined || zgoda === null) zgoda = await zgodaDomyslna();
        if (wymagaZgody(n) && zgoda !== true) throw Object.assign(new Error(`„${nazwa}” może wydać kredyty Suno albo zmienić bibliotekę — potrzebna zgoda Suwerena (zgoda: true).`), { kod: 'BEZ_ZGODY' });
        let wynik;
        try { wynik = await rpc('tools/call', { name: nazwa, arguments: args ?? {} }); ostatniBlad = null; }
        catch (e) { ostatniBlad = e.message; throw e; }
        let utwory = zapisz ? await zapiszUtwory(wynik).catch((e) => [{ blad: e.message }]) : [];
        // `audio-download` oddaje sam `url` (często bez .mp3 w adresie) — zapisujemy go pod id klipu z argumentów
        if (zapisz && nazwa === 'audio-download' && args?.id && !utwory.some((u) => u.plik)) {
            const d = wynik?.structuredContent ?? (() => { for (const c of wynik?.content ?? []) { try { return JSON.parse(c.text); } catch { /* tekst */ } } return null; })();
            if (typeof d?.url === 'string' && /^https:\/\//.test(d.url)) utwory = await zapiszUtwory(null, [{ id: String(args.id), tytul: String(tytul ?? d.title ?? 'Suno').trim() || 'Suno', adres: d.url }]).catch((e) => [{ blad: e.message }]);
        }
        const s = await czytajStan();
        await zapiszStan({ ...s, historia: [{ kiedy: new Date(teraz()).toISOString(), narzedzie: nazwa, zgoda: !!zgoda, blad: !!wynik?.isError, utwory: utwory.filter((u) => u.nowy).map((u) => u.plik) }, ...(s.historia ?? [])].slice(0, 50) });
        if (wymagaZgody(n)) nadaj(`🎵 Suno: ${nazwa}${wynik?.isError ? ' — błąd' : ''}`, { args });
        return { wynik, utwory };
    }

    async function stan({ odswiez = false } = {}) {
        const s = await czytajStan();
        const polaczone = !!(await cfg.skarbiec.czytaj(USLUGA, 'refresh_token').catch(() => null));
        const out = { polaczone, zgodaDomyslna: await zgodaDomyslna(), adres: adresMcp, zwrot, katalog: `_OtakOs_Muzyka/${KATALOG_MUZYKI}`, polaczono: s.polaczono ?? null, historia: (s.historia ?? []).slice(0, 10), blad: ostatniBlad };
        if (!polaczone) return { ...out, powod: 'Konto Suno niepołączone — „🔌 Połącz z Suno” zaloguje Cię w Suno i wróci do Katedry.' };
        try {
            const lista = await listaNarzedzi({ odswiez });
            Object.assign(out, { serwer: sesja?.serwer ?? null, instrukcje: sesja?.instrukcje ?? null, narzedzia: lista.map((n) => ({ nazwa: n.name, opis: n.description ?? '', zgoda: wymagaZgody(n), schemat: n.inputSchema ?? null })) });
        } catch (e) { out.blad = e.message; if (e.kod === 'NIEPOLACZONE') out.polaczone = false; }
        return out;
    }

    async function rozlacz() {
        const odswiezajacy = await cfg.skarbiec.czytaj(USLUGA, 'refresh_token').catch(() => null);
        const as = (await czytajStan()).as;
        if (odswiezajacy && as?.revocation_endpoint) {
            const clientId = await cfg.skarbiec.czytaj(USLUGA, 'client_id').catch(() => null);
            await f(as.revocation_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: odswiezajacy, token_type_hint: 'refresh_token', client_id: clientId ?? '' }), signal: AbortSignal.timeout(15_000) }).catch(() => {});
        }
        await cfg.skarbiec.usun(USLUGA, 'refresh_token').catch(() => {});
        dostep = null; sesja = null; narzedzia = null;
        const s = await czytajStan(); delete s.polaczono; await zapiszStan(s);
        return stan();
    }

    return { polacz, zwrotZgody, stan, listaNarzedzi, wywolaj, rozlacz, zapiszUtwory, zgodaDomyslna, ustawZgodeDomyslna, katalogUtworow, _wewn: { oczekujace } };
}

const STRONA = (tytul, tresc) => `<!doctype html><meta charset="utf-8"><title>${tytul}</title><body style="font-family:Georgia,serif;background:#120a1e;color:#f3e9ff;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center;max-width:560px"><h1>${tytul}</h1><p>${tresc}</p></div>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Trasy (Straż: `/api/suno/` tylko maszyna; powrót OAuth wpuszcza `czyZwrotYouTube` przez SCIEZKI_ZWROTU_OAUTH). */
export function zamontujTrasySuno(app, S) {
    const odp = (res, p, kod = 400) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(e.kod === 'NIEPOLACZONE' ? 409 : e.kod === 'BEZ_ZGODY' ? 403 : kod).json({ success: false, message: e.message, kod: e.kod ?? null }));
    app.get('/api/suno/stan', (req, res) => odp(res, S.stan({ odswiez: req.query.odswiez === '1' }).then((suno) => ({ suno })), 500));
    app.get('/api/suno/polacz', (req, res) => S.polacz().then(({ adres }) => (req.query.json === '1' ? res.json({ success: true, adres }) : res.redirect(adres))).catch((e) => res.status(502).json({ success: false, message: e.message })));
    app.get(SCIEZKA_ZWROTU, (req, res) => S.zwrotZgody(req.query)
        .then((st) => res.type('html').send(STRONA('🎵 Suno połączone z Katedrą', `Konto Suno jest podłączone${st?.narzedzia ? ` — ${st.narzedzia.length} narzędzi Suno gotowych` : ''}. Możesz zamknąć tę kartę.`)))
        .catch((e) => res.status(400).type('html').send(STRONA('🎵 Suno — nie udało się', esc(e.message)))));
    app.post('/api/suno/rozlacz', (_req, res) => odp(res, S.rozlacz().then((suno) => ({ suno }))));
    app.get('/api/suno/narzedzia', (req, res) => odp(res, S.listaNarzedzi({ odswiez: req.query.odswiez === '1' }).then((narzedzia) => ({ narzedzia })), 502));
    app.post('/api/suno/wywolaj', (req, res) => odp(res, S.wywolaj(String(req.body?.narzedzie ?? ''), req.body?.argumenty ?? {}, { zgoda: typeof req.body?.zgoda === 'boolean' ? req.body.zgoda : undefined, zapisz: req.body?.zapisz !== false, tytul: req.body?.tytul ?? null }), 502));
    app.post('/api/suno/zgoda', (req, res) => odp(res, S.ustawZgodeDomyslna(req.body?.domyslna !== false).then((suno) => ({ suno }))));
}
