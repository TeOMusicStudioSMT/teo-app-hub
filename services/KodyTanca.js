/**
 * 💃🎟️ Kody tańca + automat choreografii (Suweren 2026-11-05/06, potok „0.00G Style”, docs/designs/potok-0-00g-style.md):
 *  · KOLEJKA ZLECEŃ dla automatu Tanecznego Starcia — zlecenie = {tancerz z Bestiariusza, utwór}; apka z „🤖 automat”
 *    bierze następne (`nastepne`), układa choreografię, nagrywa i odsyła (`gotowe`/`blad`). Choreografię LICZY apka
 *    (scena, klipy riga) — most tylko kolejkuje i pilnuje stanów (robi > 45 min = wraca do kolejki, 3 razy = błąd).
 *  · KODY QR dla kupujących produkt 0.00G Style — `t-<12 hex>`, JEDNORAZOWE: kupujący (strona przez tunel, publicznie)
 *    wybiera tancerza, utwór LOSUJE most z biblioteki Katedry → zlecenie PRYWATNE (bez TeO Game Show i Wieczoru Tańca)
 *    → po nagraniu kod na zawsze pokazuje tylko ten występ (`filmy/<kod>.mp4` w katalogu kodów, nie YouTube).
 * Zlecenie Suwerena bez utworu = utwór „pierwszego razu” tancerza z Bestiariusza, inaczej losowy.
 * `_OtakOs_Wymiar/kody-tanca/stan.json` {zlecenia, kody}. Nic tu nie płaci i nie publikuje.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const WZOR_KODU = /^t-[0-9a-f]{12}$/;
const MAX_ZLECEN = 300, MAX_KODOW = 2000, ROBI_MAX_MS = 45 * 60_000, MAX_PROB = 3;
const tekst = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

/**
 * @param {{ katalog: string, utwory: () => Promise<{plik:string, tytul:string}[]>, bestiariusz: () => Promise<{mini:any[]}>,
 *           sciezkaNagrania: (nazwa:string) => Promise<string>, losuj?: (n:number) => number, teraz?: () => number }} cfg
 */
export function utworzKodyTanca(cfg) {
    const teraz = cfg.teraz ?? (() => Date.now());
    const losuj = cfg.losuj ?? ((n) => crypto.randomInt(n));
    const PLIK = path.join(cfg.katalog, 'stan.json');
    const FILMY = path.join(cfg.katalog, 'filmy');
    let kolejka = Promise.resolve();
    const poKolei = (f) => (kolejka = kolejka.then(f, f));
    const czytaj = async () => { try { const s = JSON.parse(await fs.readFile(PLIK, 'utf8')); return { zlecenia: s.zlecenia ?? [], kody: s.kody ?? [] }; } catch { return { zlecenia: [], kody: [] }; } };
    const zapisz = async (s) => { await fs.mkdir(cfg.katalog, { recursive: true }); const tmp = `${PLIK}.${process.pid}.tmp`; await fs.writeFile(tmp, JSON.stringify(s, null, 2), 'utf8'); await fs.rename(tmp, PLIK); };
    const iso = () => new Date(teraz()).toISOString();

    /** Tancerze, którzy mogą tańczyć: Mini z bryłą (klucz) w Bestiariuszu. */
    async function tancerze() {
        const b = await cfg.bestiariusz();
        return (b?.mini ?? []).filter((m) => m.klucz).map((m) => ({ id: m.id, nazwa: m.nazwa, utwor: m.utwor ?? null }));
    }
    async function wybierzUtwor(plik, startowy) {
        const lista = await cfg.utwory();
        if (!lista.length) throw new Error('Biblioteka muzyki Katedry jest pusta.');
        if (plik) { const u = lista.find((x) => x.plik === plik); if (!u) throw new Error(`Utworu „${plik}” nie ma w bibliotece.`); return u; }
        if (startowy) { const u = lista.find((x) => x.plik === startowy); if (u) return u; }
        return lista[losuj(lista.length)];
    }

    async function zlecW(s, { mini, utwor = null, zrodlo = 'suweren', kod = null, prywatny = false, losowy = false }) {
        const t = (await tancerze()).find((x) => x.id === mini);
        if (!t) throw new Error('Tego tancerza nie ma w Bestiariuszu (albo nie ma bryły).');
        const u = await wybierzUtwor(losowy ? null : utwor, losowy ? null : t.utwor);
        const z = { id: `z-${crypto.randomBytes(4).toString('hex')}`, mini: { id: t.id, nazwa: t.nazwa }, utwor: { plik: u.plik, tytul: u.tytul }, zrodlo, kod, prywatny: !!prywatny, stan: 'czeka', proby: 0, kiedy: iso(), od: null, choreografia: null, nagranie: null, powod: null };
        s.zlecenia = [z, ...s.zlecenia].slice(0, MAX_ZLECEN);
        return z;
    }
    const zlec = (o) => poKolei(async () => { const s = await czytaj(); const z = await zlecW(s, o ?? {}); await zapisz(s); return z; });

    /** Automat bierze najstarsze czekające; zawieszone „robi” wraca do kolejki (≤ MAX_PROB). */
    const nastepne = () => poKolei(async () => {
        const s = await czytaj();
        for (const z of s.zlecenia) if (z.stan === 'robi' && teraz() - Date.parse(z.od) > ROBI_MAX_MS) {
            if (z.proby >= MAX_PROB) { z.stan = 'blad'; z.powod = `automat ${z.proby} razy nie skończył (karta zamknięta?)`; } else z.stan = 'czeka';
        }
        const z = [...s.zlecenia].reverse().find((x) => x.stan === 'czeka');
        if (z) { z.stan = 'robi'; z.od = iso(); z.proby += 1; }
        await zapisz(s);
        return z ?? null;
    });

    const gotowe = (id, { choreografia, nagranie } = {}) => poKolei(async () => {
        const s = await czytaj();
        const z = s.zlecenia.find((x) => x.id === id);
        if (!z) throw new Error('Nie ma takiego zlecenia.');
        const nazwa = path.basename(String(nagranie?.nazwa ?? ''));
        if (!/\.(mp4|webm)$/i.test(nazwa)) throw new Error('Brak nagrania (nazwa pliku z Montażowni).');
        const zrodlo = await cfg.sciezkaNagrania(nazwa);
        await fs.access(zrodlo).catch(() => { throw new Error(`Nagrania ${nazwa} nie ma w Montażowni.`); });
        if (z.kod) {
            await fs.mkdir(FILMY, { recursive: true });
            await fs.copyFile(zrodlo, path.join(FILMY, `${z.kod}${path.extname(nazwa).toLowerCase()}`));
            const k = s.kody.find((x) => x.kod === z.kod);
            if (k) { k.stan = 'gotowy'; k.film = `${z.kod}${path.extname(nazwa).toLowerCase()}`; k.gotowy = iso(); }
        }
        Object.assign(z, { stan: 'gotowe', choreografia: tekst(choreografia, 40) || null, nagranie: nazwa, powod: null, koniec: iso() });
        await zapisz(s);
        return z;
    });
    const blad = (id, powod) => poKolei(async () => {
        const s = await czytaj();
        const z = s.zlecenia.find((x) => x.id === id);
        if (!z) throw new Error('Nie ma takiego zlecenia.');
        // padło u kupującego — wraca do kolejki, póki są próby (karta mogła stracić dźwięk)
        z.powod = tekst(powod, 300) || 'automat zgłosił błąd';
        z.stan = z.proby >= MAX_PROB ? 'blad' : 'czeka';
        await zapisz(s);
        return z;
    });
    const ponow = (id) => poKolei(async () => {
        const s = await czytaj(); const z = s.zlecenia.find((x) => x.id === id);
        if (!z || z.stan !== 'blad') throw new Error('Ponowić można tylko zlecenie z błędem.');
        Object.assign(z, { stan: 'czeka', proby: 0, powod: null }); await zapisz(s); return z;
    });

    // ── 🎟️ kody ──
    const noweKody = ({ ile = 1, postac = null, produkt = '' } = {}) => poKolei(async () => {
        const n = Math.max(1, Math.min(100, Math.round(Number(ile) || 1)));
        let tylko = null;
        if (postac) {
            const t = (await tancerze()).filter((x) => x.id === postac || x.nazwa.toLowerCase() === String(postac).toLowerCase());
            if (!t.length) throw new Error(`Tancerza „${postac}” nie ma w Bestiariuszu.`);
            tylko = t.map((x) => x.id);
        }
        const s = await czytaj();
        const nowe = Array.from({ length: n }, () => ({ kod: `t-${crypto.randomBytes(6).toString('hex')}`, produkt: tekst(produkt, 120), tylko, stan: 'wolny', utworzono: iso(), zlecenie: null, film: null }));
        s.kody = [...nowe, ...s.kody].slice(0, MAX_KODOW);
        await zapisz(s);
        return nowe;
    });
    async function kodPubliczny(kod) {
        if (!WZOR_KODU.test(String(kod))) return null;
        const s = await czytaj();
        const k = s.kody.find((x) => x.kod === kod);
        if (!k) return null;
        const z = k.zlecenie ? s.zlecenia.find((x) => x.id === k.zlecenie) : null;
        const wolny = k.stan === 'wolny';
        return {
            stan: wolny ? 'wolny' : k.stan === 'gotowy' ? 'gotowy' : z?.stan === 'blad' ? 'blad' : z?.stan === 'robi' ? 'robi' : 'czeka',
            tancerze: wolny ? (await tancerze()).filter((t) => !k.tylko || k.tylko.includes(t.id)).map(({ id, nazwa }) => ({ id, nazwa })) : null,
            tancerz: z?.mini?.nazwa ?? null, utwor: z?.utwor?.tytul ?? null, film: k.stan === 'gotowy' && k.film ? `/wizytowka/taniec/${kod}/film${path.extname(k.film)}` : null,
        };
    }
    /** Kupujący zużywa kod: wybrany tancerz, LOSOWY utwór, zlecenie prywatne. Drugi raz = odmowa. */
    const uzyjKodu = (kod, mini) => poKolei(async () => {
        if (!WZOR_KODU.test(String(kod))) throw new Error('Invalid code.');
        const s = await czytaj();
        const k = s.kody.find((x) => x.kod === kod);
        if (!k) throw new Error('Code not found.');
        if (k.stan !== 'wolny') throw new Error('This code has already been used — it shows your performance.');
        if (k.tylko && !k.tylko.includes(mini)) throw new Error('This code is for a different dancer.');
        const z = await zlecW(s, { mini, zrodlo: 'kod', kod, prywatny: true, losowy: true });
        k.stan = 'zuzyty'; k.zlecenie = z.id; k.uzyty = iso();
        await zapisz(s);
        return z;
    });
    async function sciezkaFilmu(kod) {
        if (!WZOR_KODU.test(String(kod))) return null;
        const k = (await czytaj()).kody.find((x) => x.kod === kod);
        return k?.stan === 'gotowy' && k.film ? path.join(FILMY, path.basename(k.film)) : null;
    }
    return { zlec, nastepne, gotowe, blad, ponow, noweKody, kodPubliczny, uzyjKodu, sciezkaFilmu, stan: czytaj, tancerze };
}

// ── strona kupującego (po angielsku — wydanie globalne; translate="no" przy kodzie) ──
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function stronaKodu(kod) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>0.00G Style · Your dance</title>
<style>body{margin:0;background:#0b0b10;color:#f3ead7;font:16px/1.5 system-ui,sans-serif;display:flex;justify-content:center}main{max-width:560px;width:100%;padding:24px 16px}
h1{font:700 26px Georgia,serif;letter-spacing:.04em;margin:0 0 4px}small{opacity:.65}button{background:#1b1b24;color:inherit;border:1px solid #c9a44c;border-radius:10px;padding:12px 14px;margin:6px 6px 0 0;font:inherit;cursor:pointer}
button:disabled{opacity:.4}video{width:100%;border-radius:12px;margin-top:12px;background:#000}#info{margin-top:14px}.blad{color:#ff8a8a}</style></head>
<body><main><h1>0.00G Style</h1><small translate="no">${esc(kod)}</small><p>Your one-time code: pick a dancer and the Cathedral draws a random track from its library. The dance is choreographed and recorded for you alone — after that, this code always shows your private performance.</p>
<div id="wybor"></div><div id="info"></div><video id="film" controls playsinline hidden></video></main>
<script>
const K=${JSON.stringify(kod)};const $=(i)=>document.getElementById(i);
async function stan(){const r=await fetch('/wizytowka/taniec/'+K+'/stan',{cache:'no-store'});const d=await r.json();if(!r.ok){$('info').innerHTML='<p class="blad">'+(d.message||'Code not found.')+'</p>';return}pokaz(d.kod)}
function pokaz(s){const w=$('wybor');w.innerHTML='';
 if(s.stan==='wolny'){w.innerHTML='<p>Choose your dancer:</p>';for(const t of s.tancerze){const b=document.createElement('button');b.textContent=t.nazwa;b.onclick=()=>uzyj(t.id,b);w.appendChild(b)}return}
 if(s.stan==='gotowy'){$('info').innerHTML='<p>💃 '+s.tancerz+' — “'+s.utwor+'”</p>';const v=$('film');v.src=s.film;v.hidden=false;return}
 if(s.stan==='blad'){$('info').innerHTML='<p class="blad">The recording failed. The Cathedral will retry — check back later.</p>';setTimeout(stan,60000);return}
 $('info').innerHTML='<p>⏳ '+(s.tancerz||'')+' is dancing to “'+(s.utwor||'…')+'”. The Cathedral records the performance on its own machine — this can take a few minutes, or longer if the Cathedral is busy. You can close this page and come back with the same code.</p>';setTimeout(stan,20000)}
async function uzyj(id,b){for(const x of document.querySelectorAll('button'))x.disabled=true;const r=await fetch('/wizytowka/taniec/'+K,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mini:id})});const d=await r.json().catch(()=>({}));if(!r.ok){$('info').innerHTML='<p class="blad">'+(d.message||'Error')+'</p>';for(const x of document.querySelectorAll('button'))x.disabled=false;return}stan()}
stan();
</script></body></html>`;
}

/** Trasy: automat i kody (maszyna, Straż `/api/taniec/automat`, `/api/taniec/kody`) + strona kodu (publicznie przez tunel). */
export function zamontujTrasyKodowTanca(app, K, { adresTunelu = async () => null, qr = null } = {}) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(400).json({ success: false, message: e.message }));
    app.get('/api/taniec/automat', (_req, res) => odp(res, K.stan().then((s) => ({ zlecenia: s.zlecenia.slice(0, 50) }))));
    app.post('/api/taniec/automat/zlec', (req, res) => odp(res, K.zlec({ mini: req.body?.mini, utwor: req.body?.utwor || null }).then((zlecenie) => ({ zlecenie }))));
    app.post('/api/taniec/automat/nastepne', (_req, res) => odp(res, K.nastepne().then((zlecenie) => ({ zlecenie }))));
    app.post('/api/taniec/automat/:id/gotowe', (req, res) => odp(res, K.gotowe(req.params.id, req.body ?? {}).then((zlecenie) => ({ zlecenie }))));
    app.post('/api/taniec/automat/:id/blad', (req, res) => odp(res, K.blad(req.params.id, req.body?.powod).then((zlecenie) => ({ zlecenie }))));
    app.post('/api/taniec/automat/:id/ponow', (req, res) => odp(res, K.ponow(req.params.id).then((zlecenie) => ({ zlecenie }))));
    app.get('/api/taniec/kody', (_req, res) => odp(res, (async () => {
        const s = await K.stan(); const adres = await Promise.resolve().then(adresTunelu).catch(() => null);
        const kody = await Promise.all(s.kody.slice(0, 200).map(async (k) => {
            const url = adres ? `${String(adres).replace(/\/$/, '')}/wizytowka/taniec/${k.kod}` : null;
            return { ...k, url, qr: url && qr ? await qr(url).catch(() => null) : null };
        }));
        return { kody, tunel: !!adres, powod: adres ? null : 'Tunel nie działa — kupujący nie otworzy strony kodu. Włącz tunel (najlepiej nazwany, ze stałym adresem — QR na metce nie może się zmieniać).' };
    })()));
    app.post('/api/taniec/kody', (req, res) => odp(res, K.noweKody({ ile: req.body?.ile, postac: req.body?.postac || null, produkt: req.body?.produkt }).then((kody) => ({ kody }))));
    // publicznie (tunel): strona, stan, zużycie (≤ 5/min z adresu), film
    const proby = new Map();
    app.get(/^\/wizytowka\/taniec\/(t-[0-9a-f]{12})$/, async (req, res) => {
        if (!(await K.kodPubliczny(req.params[0]))) return res.status(404).type('text/plain').send('Code not found.');
        res.type('html').set('Cache-Control', 'no-store').send(stronaKodu(req.params[0]));
    });
    app.get(/^\/wizytowka\/taniec\/(t-[0-9a-f]{12})\/stan$/, async (req, res) => {
        const kod = await K.kodPubliczny(req.params[0]);
        if (!kod) return res.status(404).json({ success: false, message: 'Code not found.' });
        res.set('Cache-Control', 'no-store').json({ success: true, kod });
    });
    app.post(/^\/wizytowka\/taniec\/(t-[0-9a-f]{12})$/, async (req, res) => {
        const ip = String(req.get?.('cf-connecting-ip') || req.ip || '');
        const t = (proby.get(ip) ?? []).filter((x) => Date.now() - x < 60_000);
        if (t.length >= 5) return res.status(429).json({ success: false, message: 'Too many attempts — wait a minute.' });
        proby.set(ip, [...t, Date.now()]);
        try { await K.uzyjKodu(req.params[0], String(req.body?.mini ?? '')); res.json({ success: true }); }
        catch (e) { res.status(409).json({ success: false, message: e.message }); }
    });
    app.get(/^\/wizytowka\/taniec\/(t-[0-9a-f]{12})\/film\.(mp4|webm)$/, async (req, res) => {
        const p = await K.sciezkaFilmu(req.params[0]);
        if (!p || path.extname(p).slice(1) !== req.params[1]) return res.status(404).end();
        res.sendFile(p);
    });
}
