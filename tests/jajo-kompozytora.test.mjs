// 🏛️⚡ JaJo Kompozytor — oś czasu z modelu sprawdzana (granice, typy, sceny LED), jedna poprawka z błędem w prośbie,
// takty z rytmu utworu, poprawka Suwerena = para „model → Suweren”, decyzje i etap jaja, kurs dla Kuźni, zamówienie
// w PRAWDZIWEJ Bazylice z gotowym promptem Kompozytora (Joanna nie pisze) i oś przypięta do zamówionego utworu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzKompozytora, oczyscOs, odczytajOs, typSekcji, taktyZCzasu, profilGlosnosci, przykladPodzialu, SYSTEM_KOMPOZYTORA } from '../services/JajoKompozytora.js';
import { utworzBazylike } from '../services/BazylikaDzwieku.js';

const OS = {
    tytul: 'Cathedral Electro-Pulse', opis: 'Organy i electro.', prompt: 'electro organ, cathedral, club beat, 126 bpm, instrumental',
    sekcje: [
        { typ: 'Intro', od: 0, do: 8, ruch: 'Slow Freeze', swiatla: { scena: 'gwiazdy', kolor: '#7C3AED' } },
        { typ: 'staccato', od: 8, do: 16, energia: 0.6 },
        { typ: 'Build-up', od: 16, do: 24, swiatla: { scena: 'fale' } },
        { typ: 'The Drop', od: 24, do: 40, energia: 1, ruch: 'Heavy Bass Stomp', swiatla: { scena: 'stroboskop', kolor: '#dc2626' } },
        { typ: 'outro', od: 40, do: 47 },
    ],
    markery: [{ takt: 24, typ: 'drop', opis: 'Tutti' }, { takt: 99, typ: 'drop' }, { takt: 8, typ: 'laser' }],
};

test('profil głośności taktów 0–9 względem najgłośniejszego', () => {
    const beaty = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((t, i) => ({ t: t + 0.1, sila: i < 4 ? 0.2 : 0.8 }));
    assert.equal(profilGlosnosci({ beaty, okresSek: 0.5, przesuniecieSek: 0.1 }, 2), '29');
    assert.equal(profilGlosnosci({ beaty: [], okresSek: 0.5 }, 4), '');
    assert.equal(przykladPodzialu(32), 'intro 0–4, staccato 4–12, buildup 12–16, drop 16–28, outro 28–32');
    assert.equal(przykladPodzialu(16), 'intro 0–2, staccato 2–6, buildup 6–8, drop 8–14, outro 14–16');
    assert.ok(oczyscOs({ ...OS, sekcje: przykladPodzialu(9).split(', ').map((x) => { const [typ, z] = x.split(' '); const [od, d] = z.split('–').map(Number); return { typ, od, do: d }; }) }, { takty: 9 }), 'przykład zawsze przechodzi sprawdzenie');
});

test('typSekcji i takty z czasu', () => {
    assert.deepEqual(['INTRO', 'Build-up', 'the drop', 'Staccato', 'chorus'].map(typSekcji), ['intro', 'buildup', 'drop', 'staccato', null]);
    assert.equal(taktyZCzasu(90, 126), 47);                 // 90 s · 126 BPM / 60 / 4 = 47,25
    assert.equal(taktyZCzasu(60, 120, 0.5), 29);
});

test('oczyscOs: dobra oś przechodzi, markery spoza listy/utworu pominięte', () => {
    const o = oczyscOs(OS, { takty: 47, bpm: 126 });
    assert.deepEqual(o.sekcje.map((s) => [s.typ, s.od, s.do]), [['intro', 0, 8], ['staccato', 8, 16], ['buildup', 16, 24], ['drop', 24, 40], ['outro', 40, 47]]);
    assert.equal(o.sekcje[0].swiatla.kolor, '#7c3aed');
    assert.equal(o.sekcje[1].swiatla.scena, 'kolor', 'brak sceny = domyślna dla typu');
    assert.equal(o.sekcje[2].energia, 0.75);
    assert.deepEqual(o.markery, [{ takt: 24, typ: 'drop', opis: 'Tutti' }]);
    assert.equal(o.pominiete, 2);
});

test('oczyscOs: zła oś = błąd wprost', () => {
    const z = (zmiana, re) => assert.throws(() => oczyscOs({ ...OS, ...zmiana }, { takty: 47 }), re);
    z({ sekcje: [...OS.sekcje.slice(0, 4), { typ: 'outro', od: 40, do: 60 }] }, /poza utworem 0–47/);
    z({ sekcje: [{ typ: 'chorus', od: 0, do: 8 }, OS.sekcje[1]] }, /nieznany typ „chorus”/);
    z({ sekcje: [{ typ: 'intro', od: 0, do: 10 }, OS.sekcje[1]] }, /nakładają się/);
    z({ sekcje: [OS.sekcje[1], OS.sekcje[0]] }, /nie są po kolei/);
    z({ sekcje: [{ ...OS.sekcje[0], swiatla: { scena: 'lasery' } }, OS.sekcje[1]] }, /nieznana scena świateł „lasery”/);
    z({ sekcje: [{ typ: 'intro', od: 0.5, do: 8 }, OS.sekcje[1]] }, /całymi taktami/);
    z({ prompt: '' }, /bez promptu/);
    z({ sekcje: [OS.sekcje[0]] }, /co najmniej 2 sekcji/);
    assert.throws(() => oczyscOs(OS, { takty: 4 }), /oś potrzebuje 8–256/);
    assert.throws(() => odczytajOs('nie wiem', { takty: 47 }), /nie oddał obiektu JSON/);
    assert.equal(odczytajOs(`<think>…</think>\`\`\`json\n${JSON.stringify(OS)}\n\`\`\``, { takty: 47 }).sekcje.length, 5);
});

async function srodowisko(o = {}) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kompozytor-'));
    const prosby = [];
    const odpowiedzi = [...(o.odpowiedzi ?? [JSON.stringify(OS)])];
    const K = utworzKompozytora({
        katalog: path.join(root, 'jajo-kompozytora'), katalogKuzni: path.join(root, 'kuznia'),
        pisz: async (p) => { prosby.push(p); return { tekst: odpowiedzi.shift() ?? '', model: 'gemma4:test' }; },
        rytm: async (plik) => ({ bpm: 125.8, sekundy: 92, przesuniecieSek: 0.4, plik, okresSek: 60 / 125.8, beaty: Array.from({ length: 192 }, (_, i) => ({ t: 0.4 + i * 60 / 125.8, sila: i >= 96 && i < 128 ? 0.9 : 0.3 })) }),
        ...o.cfg,
    });
    return { root, K, prosby, sprzataj: () => fs.rm(root, { recursive: true, force: true }) };
}

test('komponuj z opisu: model → oś zapisana; zła odpowiedź = jedna poprawka z błędem, druga zła = błąd', async () => {
    const s = await srodowisko({ odpowiedzi: ['{"sekcje":[]}', JSON.stringify(OS)] });
    try {
        const o = await s.K.komponuj({ opis: 'majestatyczny taniec z dropem', bpm: 126, sekundy: 90, styl: 'electro-organ' });
        assert.match(o.id, /^o-[0-9a-f]{8}$/);
        assert.deepEqual([o.stan, o.takty, o.bpm, o.model, o.sekcje.length], ['propozycja', 47, 126, 'gemma4:test', 5]);
        assert.equal(s.prosby.length, 2);
        assert.equal(s.prosby[0].system, SYSTEM_KOMPOZYTORA);
        assert.match(s.prosby[1].prompt, /poprzednia odpowiedź była zła: Oś potrzebuje co najmniej 2 sekcji/);
        assert.equal((await s.K.os(o.id)).tytul, 'Cathedral Electro-Pulse');
        await assert.rejects(s.K.komponuj({ opis: 'x' }), /Opisz utwór/);
    } finally { await s.sprzataj(); }
    const s2 = await srodowisko({ odpowiedzi: ['zły', 'też zły'] });
    try { await assert.rejects(s2.K.komponuj({ opis: 'taniec' }), /nie oddał obiektu JSON/); assert.equal((await s2.K.osie()).length, 0); } finally { await s2.sprzataj(); }
});

test('komponuj z utworu: takty i tempo z rytmu mostu; oś przypięta do pliku (dla)', async () => {
    const s = await srodowisko();
    try {
        const o = await s.K.komponuj({ utwor: 'Bazylika/Bit_1.mp3' });
        assert.equal(o.takty, 48);                         // (92 − 0,4) s · 125,8 BPM / 60 / 4 = 48,01 — z prawdziwego tempa utworu
        assert.equal(o.bpm, 126);
        assert.deepEqual(o.utwor, { plik: 'Bazylika/Bit_1.mp3', tytul: 'Bit 1', bpm: 125.8, sekundy: 92, przesuniecieSek: 0.4 });
        assert.match(s.prosby[0].prompt, /Utwór z biblioteki Katedry: „Bit 1” — 126 BPM \(zmierzone\), 48 taktów/);
        assert.match(s.prosby[0].prompt, /Głośność taktów utworu \(zmierzona, 0–9, takt po takcie od 0\): 3{24}9{8}3{16}\. Drop połóż/);
        assert.equal((await s.K.dla('Bazylika/Bit_1.mp3')).id, o.id);
        assert.equal(await s.K.dla('inny.mp3'), null);
    } finally { await s.sprzataj(); }
});

test('poprawka Suwerena = para „model → Suweren”, decyzje grzeją jajo, kurs dla Kuźni', async () => {
    const s = await srodowisko();
    try {
        const o = await s.K.komponuj({ opis: 'taniec' });
        const bez = await s.K.popraw(o.id, {});
        assert.equal(bez.zmiana, false, 'bez zmian nie ma pary');
        await assert.rejects(s.K.popraw(o.id, { sekcje: [{ typ: 'drop', od: 0, do: 99 }, OS.sekcje[1]] }), /poza utworem/);
        const sekcje = OS.sekcje.map((x) => ({ ...x })); sekcje[3].do = 36; sekcje[4] = { typ: 'outro', od: 36, do: 47 };
        const p = await s.K.popraw(o.id, { sekcje, prompt: 'gothic organ, electro house, 126 bpm, instrumental' });
        assert.deepEqual([p.zmiana, p.obserwacja, p.os.poprawiona], [true, 1, true]);
        assert.equal(p.os.odModelu.sekcje[3].do, 40, 'wersja modelu zostaje do pary');
        await s.K.decyzja(o.id, 'przyjmij');
        await assert.rejects(s.K.decyzja(o.id, 'moze'), /Werdykt/);
        const st = await s.K.stan();
        assert.deepEqual([st.poprawki, st.decyzje, st.etap.punkty, st.etap.nazwa, st.osie[0].stan], [1, 1, 3, 'jajo', 'przyjeta']);
        const k = await s.K.kurs();
        assert.deepEqual([k.pary, k.sft], [1, 1]);
        const para = JSON.parse((await fs.readFile(path.join(s.root, 'kuznia', 'kompozytor', 'pary-kompozytora.jsonl'), 'utf8')).trim());
        assert.equal(JSON.parse(para.chosen).sekcje[3].do, 36);
        assert.equal(JSON.parse(para.rejected).sekcje[3].do, 40);
    } finally { await s.sprzataj(); }
});

test('zamówienie w Bazylice z promptem Kompozytora (Joanna nie pisze) → utwór przypięty do osi', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kompozytor-baz-'));
    const muzyka = path.join(root, 'muzyka');
    const wyw = [];
    let joanna = 0;
    const B = utworzBazylike({
        katalogMuzyki: muzyka, katalog: path.join(root, 'baz'), ffmpeg: 'ffmpeg', uruchom: async () => ({}), czekaj: async () => {},
        pisz: async () => { joanna++; return 'joanna tags'; },
        most: async (sc, c) => {
            wyw.push([sc, c]);
            if (sc === '/api/music/generate') return { promptId: 'p1' };
            if (sc.startsWith('/api/music/progress')) return { stan: 'gotowe', audio: [{ filename: 'a.flac', subfolder: '', type: 'output' }] };
            if (sc === '/api/music/collect') return { savedPath: path.join(muzyka, 'Bazylika_kat.flac') };
            return {};
        },
    });
    const s = await srodowisko({ cfg: { bazylika: B } });
    try {
        const o = await s.K.komponuj({ opis: 'katedralny drop', bpm: 126, sekundy: 90 });
        const { zamowienie } = await s.K.zamow(o.id);
        assert.equal(zamowienie.os, o.id);
        await B._czekajNaKolejke();
        assert.equal(joanna, 0, 'gotowy prompt Kompozytora — Joanna nie przepisuje');
        const gen = wyw.find(([x]) => x === '/api/music/generate')[1];
        assert.deepEqual([gen.prompt, gen.bpm, gen.duration], [OS.prompt, 126, 90]);
        const [z] = await B.zamowienia();
        assert.deepEqual([z.stan, z.promptOdKompozytora, z.promptOdJoanny], ['gotowe', true, false]);
        const zUtw = await s.K.os(o.id);
        assert.deepEqual([zUtw.utwor.plik, zUtw.zamowienie.stan], ['Bazylika_kat.flac', 'gotowe']);
        assert.equal((await s.K.dla('Bazylika_kat.flac')).id, o.id);
        await s.K.decyzja(o.id, 'odrzuc');
        await assert.rejects(s.K.zamow(o.id), /odrzucona/);
    } finally { await s.sprzataj(); await fs.rm(root, { recursive: true, force: true }); }
});
