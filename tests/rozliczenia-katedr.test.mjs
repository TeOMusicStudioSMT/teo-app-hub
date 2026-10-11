// 💳 Rozliczenia Katedr (krok 4): dwie Katedry z OSOBNYMI księgami — kupujący odkłada, sprzedający dopisuje i kwituje,
// kupujący zamyka; powtórka nie płaci drugi raz, zła cena/podpis = zwrot, zerwane łącze = czeka i ponowienie,
// fałszywe pokwitowanie nie zamyka, paczka tylko po zapłacie i podpisanym żądaniu. Na końcu pełna droga przez HTTP i Straż.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { utworzRozliczenia, sprawdzPodpis, trescPokwitowania, KONTO_ROZLICZEN } from '../services/RozliczeniaKatedr.js';

const para = () => {
    const p = crypto.generateKeyPairSync('ed25519');
    return { pub: p.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), podpisz: async (t) => crypto.sign(null, Buffer.from(t, 'utf8'), p.privateKey).toString('base64') };
};
/** Księga w pamięci jak w moście: skarbiec ∞, właściciel, przelew z kontrolą salda, pieczęcie z notatką. */
function ksiega(wlasciciel, saldo) {
    const L = { nodes: { skarbiec: { grv: 'INFINITE' }, [wlasciciel]: { grv: saldo } }, pieczecie: [] };
    return {
        L,
        przelej: async (od, doW, kwota, notatka) => {
            if (!L.nodes[od]) throw new Error(`Węzeł ${od} nieznany.`);
            L.nodes[doW] ??= { grv: 0 };
            if (L.nodes[od].grv !== 'INFINITE') { if (L.nodes[od].grv < kwota) throw new Error('Za mało GRV u nadawcy.'); L.nodes[od].grv -= kwota; }
            if (L.nodes[doW].grv !== 'INFINITE') L.nodes[doW].grv += kwota;
            L.pieczecie.push({ od, do: doW, kwota, ...notatka });
        },
        wlasciciel: async () => wlasciciel, zarzadca: async () => 'skarbiec', saldo: async (w) => L.nodes[w]?.grv ?? 0,
    };
}

async function dwieKatedry({ cenaA = 333, saldoB = 1000 } = {}) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rozliczenia-'));
    const kA = para(), kB = para();
    const rejestr = { 'teo-mas': { nick: 'teo-mas', adres: 'https://a.example', klucz: kA.pub }, 'wyspa-ola': { nick: 'wyspa-ola', adres: 'https://b.example', klucz: kB.pub } };
    const katedra = async (n) => { if (!rejestr[n]) throw new Error('brak w rejestrze'); return rejestr[n]; };
    const ksA = ksiega('wezel-a', 0), ksB = ksiega('wezel-b', saldoB);
    const siec = { dziala: true, zapytan: 0 };
    let teraz = Date.parse('2026-10-12T10:00:00Z');
    const A = utworzRozliczenia({ katalog: path.join(root, 'a'), nick: async () => 'teo-mas', podpisz: kA.podpisz, katedra, ksiega: ksA, cena: async (g) => (g === 'teterhia' ? cenaA : null), teraz: () => teraz });
    const fetchB = async (url, o) => {
        siec.zapytan++;
        if (!siec.dziala) throw new Error('fetch failed');
        assert.equal(url, 'https://a.example/wizytowka/gra/teterhia/platnosc');
        const w = await A.przyjmij(JSON.parse(o.body));
        return new Response(JSON.stringify(w), { status: w.odrzucone ? 409 : 200 });
    };
    const B = utworzRozliczenia({ katalog: path.join(root, 'b'), nick: async () => 'wyspa-ola', podpisz: kB.podpisz, katedra, ksiega: ksB, cena: async () => null, fetch: fetchB, teraz: () => teraz });
    return { root, A, B, ksA, ksB, kA, kB, rejestr, siec, przesun: (ms) => { teraz += ms; } };
}

test('przelew 333 GRV: odłożone → dopisane u sprzedającego → pokwitowanie → zamknięte; drugi raz bez płacenia', async () => {
    const k = await dwieKatedry();
    try {
        const z = await k.B.zaplac({ sprzedawca: 'teo-mas', gra: 'teterhia', kwota: 333 });
        assert.equal(z.stan, 'potwierdzona', z.blad);
        assert.equal(k.ksB.L.nodes['wezel-b'].grv, 667);
        assert.equal(k.ksB.L.nodes[KONTO_ROZLICZEN].grv, 0, 'odłożone poszło do skarbca kupującego');
        assert.equal(k.ksA.L.nodes['wezel-a'].grv, 333, 'sprzedający dopisał swojemu właścicielowi');
        assert.ok(sprawdzPodpis(trescPokwitowania(z, z.pokwitowanie.czas), k.kA.pub, z.pokwitowanie.podpis), 'pokwitowanie podpisane kluczem sprzedającego');
        assert.deepEqual(k.ksB.L.pieczecie.map((p) => p.strona), ['odlozone', 'zakup']);
        assert.deepEqual(k.ksA.L.pieczecie.map((p) => [p.strona, p.od, p.rozliczenie]), [['sprzedaz', 'wyspa-ola', z.id]]);
        const drugi = await k.B.zaplac({ sprzedawca: 'teo-mas', gra: 'teterhia', kwota: 333 });
        assert.equal(drugi.juz, true);
        assert.equal(k.ksB.L.nodes['wezel-b'].grv, 667, 'bez drugiego płacenia');
        assert.equal(await k.B.zaplacone('teo-mas', 'teterhia'), true);
        // to samo zlecenie wysłane drugi raz do sprzedającego → to samo pokwitowanie, bez drugiego dopisania
        const sprzedaz = (await k.A.stan()).sprzedaz[0];
        const powt = await k.A.przyjmij({ zlecenie: { id: sprzedaz.id, od: sprzedaz.od, do: sprzedaz.do, kwota: sprzedaz.kwota, gra: sprzedaz.gra, czas: sprzedaz.czas }, podpis: sprzedaz.podpisZlecenia });
        assert.equal(powt.powtorka, true);
        assert.equal(k.ksA.L.nodes['wezel-a'].grv, 333);
    } finally { await fs.rm(k.root, { recursive: true, force: true }); }
});

test('zła cena i podszyty podpis = odrzucone i zwrot; za mało GRV = nic nie rusza', async () => {
    const k = await dwieKatedry({ cenaA: 500 });
    try {
        const z = await k.B.zaplac({ sprzedawca: 'teo-mas', gra: 'teterhia', kwota: 333 });
        assert.equal(z.stan, 'zwrot');
        assert.match(z.blad, /Cena gry to 500 GRV/);
        assert.equal(k.ksB.L.nodes['wezel-b'].grv, 1000, 'pełny zwrot');
        assert.equal(k.ksA.L.nodes['wezel-a'].grv, 0);
        // podszyty: w rejestrze kupujący ma inny klucz niż ten, którym podpisał
        k.rejestr['wyspa-ola'].klucz = para().pub;
        const z2 = await k.B.zaplac({ sprzedawca: 'teo-mas', gra: 'teterhia', kwota: 500 });
        assert.equal(z2.stan, 'zwrot');
        assert.match(z2.blad, /Podpis zlecenia nie zgadza się/);
        assert.equal(k.ksB.L.nodes['wezel-b'].grv, 1000);
        await assert.rejects(k.B.zaplac({ sprzedawca: 'teo-mas', gra: 'teterhia', kwota: 5000 }), /Za mało GRV/);
        assert.equal(k.ksB.L.nodes['wezel-b'].grv, 1000);
        await assert.rejects(k.B.zaplac({ sprzedawca: 'wyspa-ola', gra: 'teterhia', kwota: 1 }), /sama sobie/);
    } finally { await fs.rm(k.root, { recursive: true, force: true }); }
});

test('zerwane łącze: GRV czekają odłożone, ponowienie zamyka bez podwójnego płacenia; fałszywe pokwitowanie nie zamyka', async () => {
    const k = await dwieKatedry();
    try {
        k.siec.dziala = false;
        const z = await k.B.zaplac({ sprzedawca: 'teo-mas', gra: 'teterhia', kwota: 333 });
        assert.equal(z.stan, 'wyslana');
        assert.match(z.blad, /nie odpowiedziała/);
        assert.equal(k.ksB.L.nodes['wezel-b'].grv, 667);
        assert.equal(k.ksB.L.nodes[KONTO_ROZLICZEN].grv, 333, 'odłożone czeka');
        k.siec.dziala = true;
        const p = await k.B.ponow(z.id);
        assert.equal(p.stan, 'potwierdzona');
        assert.equal(k.ksB.L.nodes['wezel-b'].grv, 667, 'bez drugiego obciążenia');
        assert.equal(k.ksA.L.nodes['wezel-a'].grv, 333);
        // przeterminowane zlecenie
        k.przesun(2 * 60 * 60_000);
        const stare = (await k.A.stan()).sprzedaz[0];
        const odp = await k.A.przyjmij({ zlecenie: { ...stare, id: 'aaaaaaaaaaaaaaaa' }, podpis: stare.podpisZlecenia });
        assert.equal(odp.odrzucone, true);
    } finally { await fs.rm(k.root, { recursive: true, force: true }); }
    // fałszywe pokwitowanie (sprzedający w rejestrze ma inny klucz) — rozliczenie zostaje otwarte
    const f = await dwieKatedry();
    try {
        f.rejestr['teo-mas'].klucz = para().pub;
        const z = await f.B.zaplac({ sprzedawca: 'teo-mas', gra: 'teterhia', kwota: 333 });
        assert.equal(z.stan, 'wyslana');
        assert.match(z.blad, /nie zgadza się z kluczem sprzedającego/);
    } finally { await fs.rm(f.root, { recursive: true, force: true }); }
});

test('paczka tylko po zapłacie: podpisane żądanie kupującego, świeże; darmowa gra dla każdego', async () => {
    const k = await dwieKatedry();
    try {
        assert.equal((await k.A.mozePobrac('teterhia', await k.B.naglowkiPobrania('teterhia').then((h) => ({ nick: h['x-katedra-nick'], czas: h['x-katedra-czas'], podpis: h['x-katedra-podpis'] })))).tak, false, 'przed zapłatą nie');
        await k.B.zaplac({ sprzedawca: 'teo-mas', gra: 'teterhia', kwota: 333 });
        const h = await k.B.naglowkiPobrania('teterhia');
        const z = { nick: h['x-katedra-nick'], czas: h['x-katedra-czas'], podpis: h['x-katedra-podpis'] };
        assert.equal((await k.A.mozePobrac('teterhia', z)).tak, true);
        assert.equal((await k.A.mozePobrac('teterhia', { ...z, podpis: (await para().podpisz('x')) })).tak, false, 'cudzy podpis');
        assert.equal((await k.A.mozePobrac('teterhia', { ...z, nick: 'teo-mas' })).tak, false, 'inny nick');
        k.przesun(20 * 60_000);
        assert.equal((await k.A.mozePobrac('teterhia', z)).tak, false, 'stare żądanie');
        assert.equal((await k.A.mozePobrac('inna', z)).tak, false);
    } finally { await fs.rm(k.root, { recursive: true, force: true }); }
    const d = await dwieKatedry({ cenaA: 0 });
    try { assert.equal((await d.A.mozePobrac('teterhia', {})).tak, true, 'darmowa'); } finally { await fs.rm(d.root, { recursive: true, force: true }); }
});

test('pełna droga przez HTTP za Strażą: kupujący płaci, instaluje; bez zapłaty 402; zła cena = zwrot', async () => {
    const { default: express } = await import('express');
    const { strazMostu } = await import('../services/StrazMostu.js');
    const { utworzPaczkiGier, zamontujTrasyGier } = await import('../services/PaczkiGier.js');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rozliczenia-http-'));
    const kA = para(), kB = para();
    const ksA = ksiega('wezel-a', 0), ksB = ksiega('wezel-b', 1000);
    const rejestr = { 'teo-mas': { nick: 'teo-mas', adres: '', klucz: kA.pub }, 'wyspa-ola': { nick: 'wyspa-ola', adres: 'https://b.example', klucz: kB.pub } };
    const katedra = async (n) => { if (!rejestr[n]) throw new Error('brak'); return rejestr[n]; };
    try {
        const dist = path.join(root, 'a-apki', 'teterhia', 'dist');
        await fs.mkdir(dist, { recursive: true });
        await fs.writeFile(path.join(dist, 'index.html'), '<div id="gra"></div>');
        // ── Katedra A (sprzedająca) za Strażą; każde żądanie jak z tunelu ──
        let RA;
        const PA = utworzPaczkiGier({ katalog: path.join(root, 'a'), katalogApek: path.join(root, 'a-apki'), nick: async () => 'teo-mas', klucz: async () => kA.pub, podpisz: kA.podpisz, rejestr: 'x' });
        RA = utworzRozliczenia({ katalog: path.join(root, 'a'), nick: async () => 'teo-mas', podpisz: kA.podpisz, katedra, ksiega: ksA, cena: (g) => PA.cena(g) });
        await PA.udostepnij('teterhia', { cenaGRV: 333 });
        const app = express();
        app.use((req, _res, next) => { req.headers['cf-connecting-ip'] = '7.7.7.7'; next(); });
        app.use(express.json());
        app.use(strazMostu({ klucz: () => 'k'.repeat(48) }));
        zamontujTrasyGier(app, { paczki: PA, rozliczenia: RA, nick: async () => 'teo-mas', wczytajRynek: async () => ({ products: [] }), zapiszRynek: async () => {} });
        const srv = app.listen(0);
        rejestr['teo-mas'].adres = `http://127.0.0.1:${srv.address().port}`;
        try {
            // ── Katedra B (kupująca): rejestr z atrapy (adres A = lokalny serwer), płaci i instaluje ──
            const RB = utworzRozliczenia({ katalog: path.join(root, 'b'), nick: async () => 'wyspa-ola', podpisz: kB.podpisz, katedra, ksiega: ksB, cena: async () => null });
            const PB = utworzPaczkiGier({ katalog: path.join(root, 'b'), katalogApek: path.join(root, 'b-apki'), nick: async () => 'wyspa-ola', klucz: async () => kB.pub, podpisz: kB.podpisz,
                rejestr: 'https://rejestr/api/katedry', naglowkiPobrania: (g) => RB.naglowkiPobrania(g),
                fetch: async (url, o) => (url === 'https://rejestr/api/katedry' ? new Response(JSON.stringify({ katedry: [{ ...rejestr['teo-mas'], adres: 'https://a.example' }] })) : fetch(url.replace('https://a.example', rejestr['teo-mas'].adres), o)) });
            const { cena } = await PB.oferta('teo-mas', 'teterhia');
            assert.equal(cena, 333, 'cena z manifestu sprzedającego');
            await assert.rejects(PB.instaluj({ nick: 'teo-mas', gra: 'teterhia' }), /nie zapłaciła/, 'bez zapłaty paczka 402');
            const z = await RB.zaplac({ sprzedawca: 'teo-mas', gra: 'teterhia', kwota: 333 });
            assert.equal(z.stan, 'potwierdzona', z.blad);
            const w = await PB.instaluj({ nick: 'teo-mas', gra: 'teterhia' });
            assert.equal(w.id, 'teterhia-teo-mas');
            assert.deepEqual([ksA.L.nodes['wezel-a'].grv, ksB.L.nodes['wezel-b'].grv], [333, 667]);
            // zła cena przez HTTP → 409 odrzucone → zwrot u kupującego
            const zly = await (await fetch(`${rejestr['teo-mas'].adres}/wizytowka/gra/teterhia/platnosc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zlecenie: { id: 'bbbbbbbbbbbbbbbb', od: 'wyspa-ola', do: 'teo-mas', kwota: 1, gra: 'teterhia', czas: new Date().toISOString() }, podpis: 'x' }) })).json();
            assert.equal(zly.odrzucone, true);
            assert.match(zly.powod, /Cena gry to 333/);
            // inne POST dalej zamknięte dla tunelu
            assert.equal((await fetch(`${rejestr['teo-mas'].adres}/api/gry/kup`, { method: 'POST' })).status, 401);
        } finally { srv.close(); }
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});
