/** Zlecenia Stada: wkłady same zlecają moduły Katedry — parsowanie, kolejka, błędy modułów, ponowienie. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ProjektStada from '../services/ProjektStada.js';
import { wyciagnij, wykonaj } from '../services/ZleceniaStada.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'zlecenia-'));
const czekaj = async (fn, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const w = await fn(); if (w) return w; await new Promise((r) => setTimeout(r, 15)); } throw new Error('timeout'); };

const WKLADY = {
    joanna: 'Motyw: mroczny synthwave.\nMUZYKA: dark synthwave, 96 BPM, analog pads, female vocal\nREFREN: Teterhia śpi / klocki świecą / my wracamy',
    klatka: 'Ujęcie 1: plan ogólny.\nUJĘCIE: wide shot of a lego city at dusk, slow dolly in\nUJECIE: close-up of a glowing crystal, rack focus\nUJĘCIE: third shot that exceeds the limit',
    paleta: 'Paleta: #112233\nOBIEKT: kryształowy tron\n- OBIEKT: latarnia z klocków',
    kupiec: 'PRODUKT: Figurka Teterhii | 120 GRV | dla kolekcjonerów\n**PRODUKT: Plakat zwiastunu | ~40 grv | do pokoju**\nPRODUKT: | 10 | bez nazwy',
};

test('wyciągnij: linie dla maszyny → zlecenia, limity, bez Biblii, merch pierwszy', () => {
    const kroki = Object.entries(WKLADY).map(([agent, wklad]) => ({ agent, imie: agent, stan: 'gotowe', wklad }));
    kroki.push({ agent: 'rezyser', imie: 'Reżyser', stan: 'gotowe', synteza: true, wklad: 'OBIEKT: kryształowy tron\nPRODUKT: Duplikat | 5 | z Biblii' });
    kroki.push({ agent: 'kodeks', imie: 'Kodeks', stan: 'blad', wklad: 'PRODUKT: z błędu | 1 | nie' });
    const z = wyciagnij(kroki);
    assert.deepEqual(z.map((x) => x.modul), ['merch', 'merch', 'muzyka', 'model3d', 'model3d', 'wideo', 'wideo']);
    assert.deepEqual(z[0].argumenty, { nazwa: 'Figurka Teterhii', cenaGrv: 120, opis: 'dla kolekcjonerów' });
    assert.equal(z[1].argumenty.cenaGrv, 40);
    assert.equal(z[2].argumenty.prompt, 'dark synthwave, 96 BPM, analog pads, female vocal');
    assert.equal(z[2].argumenty.tekst, '[chorus]\nTeterhia śpi\nklocki świecą\nmy wracamy');
    assert.equal(z[4].opis, 'latarnia z klocków');
    assert.equal(z[6].argumenty.prompt, 'close-up of a glowing crystal, rack focus');   // UJECIE bez ogonka też
    assert.ok(z.every((x) => x.stan === 'czeka' && x.agent !== 'rezyser'));
});

/** Atrapa mostu: zapisuje wywołania, odpowiada jak prawdziwe trasy (kształty z wiesio-bridge.js). */
function atrapaMostu({ comfySpi = false } = {}) {
    const wolania = [];
    let pytan = 0;
    const most = async (sciezka, body) => {
        wolania.push({ sciezka, body });
        if (sciezka === '/api/market/create') return { success: true, product: { id: `projekt-stada-${body.name.length}`, priceGrv: body.priceGrv } };
        if (sciezka === '/api/music/generate') { if (comfySpi) throw new Error('ComfyUI nie odpowiada.'); return { success: true, promptId: 'p1', engine: 'ComfyUI × ACE' }; }
        if (sciezka.startsWith('/api/music/progress')) return ++pytan < 2 ? { success: true, stan: 'liczy' } : { success: true, stan: 'gotowe', audio: [{ filename: 'a.flac', subfolder: '', type: 'output' }] };
        if (sciezka === '/api/music/collect') return { success: true, savedPath: '/K/_OtakOs_Muzyka/motyw.flac' };
        if (sciezka === '/api/assety3d/generuj') { if (comfySpi) throw new Error('TRELLIS.2: brak wag'); return { success: true, zadanie: 'a3-1', asset: `tron-${wolania.length}` }; }
        if (sciezka.startsWith('/api/assety3d/zadania/')) return { success: true, zadanie: { stan: 'gotowe' } };
        if (sciezka === '/api/wideo/generuj') return { success: true, zlecenie: 'w1', silnik: 'WAN' };
        if (sciezka.startsWith('/api/wideo/zlecenie/')) return { success: true, gotowe: true, materialy: [{ nazwa: 'x.png', sciezka: '/C/x.png' }, { nazwa: 'x.mp4', sciezka: '/C/x.mp4' }] };
        if (sciezka === '/api/wideo/do-projektu') return { success: true, sciezka: '/K/Produkcje/ujecia/x.mp4' };
        throw new Error(`nieznana trasa ${sciezka}`);
    };
    return { most, wolania };
}

test('wykonaj: muzyka czeka na ComfyUI i odbiera plik; wideo kopiuje film (nie klatkę) do projektu', async () => {
    const { most, wolania } = atrapaMostu();
    const projekt = { id: 'teterhia-ab12', nazwa: 'Teterhia' };
    const m = await wykonaj({ modul: 'muzyka', argumenty: { prompt: 'synthwave', tekst: '' }, imie: 'Joanna' }, { most, projekt, odstepMs: 1 });
    assert.deepEqual(m, { promptId: 'p1', plik: '/K/_OtakOs_Muzyka/motyw.flac', silnik: 'ComfyUI × ACE' });
    assert.equal(wolania.find((w) => w.sciezka === '/api/music/collect').body.title, 'Teterhia — motyw');
    const w = await wykonaj({ id: 'wideo-1', modul: 'wideo', argumenty: { prompt: 'lego city' }, imie: 'Klatka' }, { most, projekt, odstepMs: 1 });
    assert.equal(w.plik, '/K/Produkcje/ujecia/x.mp4');
    assert.deepEqual(wolania.find((x) => x.sciezka === '/api/wideo/do-projektu').body, { projekt: 'Teterhia', plik: '/C/x.mp4', tytul: 'wideo-1' });
});

test('wykonaj: błąd modułu w ComfyUI przerywa czekanie od razu; cisza kończy się limitem, nie wiecznością', async () => {
    const projekt = { id: 'p', nazwa: 'P' };
    const blad = async (s) => (s.startsWith('/api/assety3d/zadania') ? { zadanie: { stan: 'blad', blad: 'VRAM pełny' } } : { zadanie: 'a3-9', asset: 'x' });
    await assert.rejects(wykonaj({ modul: 'model3d', argumenty: { tekst: 'tron' } }, { most: blad, projekt, odstepMs: 1 }), /VRAM pełny/);
    const cisza = async (s) => (s === '/api/music/generate' ? { promptId: 'p9' } : { stan: 'liczy' });
    await assert.rejects(wykonaj({ modul: 'muzyka', argumenty: { prompt: 'x' } }, { most: cisza, projekt, odstepMs: 1, limityMs: { muzyka: 30 } }), /nie skończyło się/);
});

test('projekt: po wkładach moduły ruszają same, po kolei; błąd modułu zapisany; ponowienie bierze tylko to, co nie wyszło', async () => {
    const katalog = tmp(), zdarzenia = [];
    let atrapa = atrapaMostu({ comfySpi: true });
    let wRownolegle = 0, maks = 0;
    const most = async (s, b) => { wRownolegle++; maks = Math.max(maks, wRownolegle); try { await new Promise((r) => setTimeout(r, 2)); return await atrapa.most(s, b); } finally { wRownolegle--; } };
    ProjektStada.skonfiguruj({
        katalog, domyslnyModel: 'gemma4:e2b', most, odstepMs: 1,
        szyna: { nadaj: async (z) => { zdarzenia.push(z); } },
        modelDla: async () => null, karta: async () => null,
        chat: async (model, [sys]) => {
            const kto = Object.keys(WKLADY).find((a) => sys.content.includes(`Jesteś ${a}`));
            return kto ? WKLADY[kto] : 'Biblia: OBIEKT: kryształowy tron';
        },
    });
    const uczestnicy = ['joanna', 'paleta', 'kupiec'].map((id) => ({ id, imie: id }));
    const s = await ProjektStada.zaloz({ nazwa: 'Teterhia', wizja: 'Świat klocków z muzyką i merchem.', uczestnicy });
    const p = await czekaj(async () => { const x = await ProjektStada.projekt(s.id); return x?.zlecenia?.length && x.zlecenia.every((z) => z.stan === 'gotowe' || z.stan === 'blad') && x; });
    assert.equal(p.stan, 'gotowe');
    assert.deepEqual(p.zlecenia.map((z) => `${z.modul}:${z.stan}`), ['merch:gotowe', 'merch:gotowe', 'muzyka:blad', 'model3d:blad', 'model3d:blad']);
    assert.match(p.zlecenia[2].blad, /ComfyUI nie odpowiada/);
    assert.equal(p.zlecenia[0].wynik.cenaGrv, 120);
    assert.equal(maks, 1);                                                              // jedna karta graficzna → jedno zlecenie naraz
    assert.ok(zdarzenia.some((z) => z.agent === 'Stado' && /zleca moduły Katedry: 🛒 Marketplace ×2, 🎵 Generator muzyki ×1, 🧊 Assety3D ×2/.test(z.tresc)));
    assert.ok(zdarzenia.some((z) => z.agent === 'kupiec' && /Marketplace oddał „Figurka Teterhii"/.test(z.tresc)));
    assert.ok(zdarzenia.every((z) => z.rodzaj === 'projekt'));                            // Świat odświeża klocki na każdym kroku
    assert.deepEqual(ProjektStada.skrot(p).zlecenia.map((z) => z.stan), ['gotowe', 'gotowe', 'blad', 'blad', 'blad']);

    // ComfyUI się obudził → ponów: merch NIE idzie drugi raz do Marketplace.
    atrapa = atrapaMostu();
    const r = await ProjektStada.zlec(s.id);
    assert.equal(r.ile, 3);
    await assert.rejects(ProjektStada.zlec(s.id), /już są w kolejce/);
    const p2 = await czekaj(async () => { const x = await ProjektStada.projekt(s.id); return x.zlecenia.every((z) => z.stan === 'gotowe') && x; });
    assert.equal(atrapa.wolania.filter((w) => w.sciezka === '/api/market/create').length, 0);
    assert.equal(p2.zlecenia[2].wynik.plik, '/K/_OtakOs_Muzyka/motyw.flac');
    assert.ok(p2.zlecenia[3].wynik.asset);
});

test('samoZlecanie:false → nic nie rusza samo; zlecenie przerwane restartem mostu widać jako przerwane', async () => {
    const katalog = tmp();
    const { most, wolania } = atrapaMostu();
    ProjektStada.skonfiguruj({ katalog, most, odstepMs: 1, szyna: null, modelDla: async () => null, karta: async () => null, chat: async () => WKLADY.kupiec });
    const s = await ProjektStada.zaloz({ nazwa: 'Cisza', wizja: 'Bez zlecania, tylko tekst.', uczestnicy: [{ id: 'kupiec', imie: 'K' }, { id: 'joanna', imie: 'J' }], samoZlecanie: false });
    const p = await czekaj(async () => { const x = await ProjektStada.projekt(s.id); return x.stan !== 'trwa' && x; });
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(p.zlecenia, undefined);
    assert.equal(wolania.length, 0);

    // Plik z „trwa" po restarcie (ten proces tego nie liczy) → przerwane, nie udajemy pracy.
    const surowy = JSON.parse(fs.readFileSync(path.join(katalog, `${s.id}.json`), 'utf8'));
    surowy.stan = 'trwa';
    surowy.zlecenia = [{ id: 'merch-1', modul: 'merch', agent: 'kupiec', imie: 'K', opis: 'X', argumenty: { nazwa: 'X', cenaGrv: 1 }, stan: 'trwa' }];
    fs.writeFileSync(path.join(katalog, `${s.id}.json`), JSON.stringify(surowy));
    const po = await ProjektStada.projekt(s.id);
    assert.equal(po.stan, 'przerwany');
    assert.equal(po.zlecenia[0].stan, 'przerwane');
});
