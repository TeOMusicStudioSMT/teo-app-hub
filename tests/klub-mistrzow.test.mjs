// 🏛️ Klub Mistrzów — przedstawicielstwo w wizytówce, zwiad po wizytówkach Katedr z rejestru (nick + klucz),
// eventy globalne, wyniki i ranking, wieści „z pola” (każda raz). Atrapa sieci, prawdziwy dysk tymczasowy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { utworzKlub, eventZSieci, wynikZSieci, ranking } from '../services/KlubMistrzow.js';
import { utworzMistrzaGry } from '../services/MistrzGry.js';

const T0 = Date.parse('2026-10-09T12:00:00Z');

test('eventZSieci / wynikZSieci / ranking: tylko turniej w dziedzinie, który dziś trwa; wynik 0–3 z 3', () => {
    const e = { id: 'g-0a1b2c3d', typ: 'turniej', dziedzina: 'takt', od: '2026-10-08', do: '2026-10-10', opis: 'x' };
    assert.equal(eventZSieci(e, 'teo-mas', T0).nazwa, 'Turniej Taktu Klubu Mistrzów');
    assert.equal(eventZSieci({ ...e, do: '2026-10-08' }, 'teo-mas', T0), null, 'skończony');
    assert.equal(eventZSieci({ ...e, dziedzina: 'magia' }, 'teo-mas', T0), null);
    assert.equal(eventZSieci({ ...e, id: '../x' }, 'teo-mas', T0), null);
    assert.equal(wynikZSieci({ event: 'teo-mas:g-0a1b2c3d', wygrane: 4, starc: 3 }, 'x'), null);
    assert.equal(wynikZSieci({ event: 'teo-mas:g-0a1b2c3d', wygrane: 2, starc: 3 }, 'x').wygrane, 2);
    assert.deepEqual(ranking([{ nick: 'a', wygrane: 2, kiedy: '1' }, { nick: 'b', wygrane: 3, kiedy: '2' }, { nick: 'c', wygrane: 3, kiedy: '1' }]).map((x) => x.nick), ['c', 'b', 'a']);
});

test('Klub: ogłoszenie, przedstawicielstwo, zwiad (podszywacz odrzucony), ranking, wieści raz, wynik z Teterhii', async () => {
    const kat = await fs.mkdtemp(path.join(os.tmpdir(), 'klub-'));
    try {
        const wiesci = [];
        let teraz = T0;
        // sieć: rejestr + dwie Katedry; „falszywa” ma w wizytówce inny klucz niż w rejestrze
        const siec = {
            'https://rejestr/api/katedry': { katedry: [
                { nick: 'teo-mas', adres: 'https://teo-mas.example', klucz: 'KJA' },
                { nick: 'wyspa-ola', adres: 'https://ola.example', klucz: 'KOLA' },
                { nick: 'falszywa', adres: 'https://zly.example', klucz: 'KPRAWDZIWY' },
                { nick: 'stara', adres: 'https://stara.example', klucz: 'KS' },
            ] },
            'https://ola.example/api/wizytowka': { nick: 'wyspa-ola', klucz: 'KOLA', motto: 'Kot i fale', mistrz: { etap: 'pęka', teterhia: 'Dzień tonu: empatyczny',
                eventy: [{ id: 'g-11112222', typ: 'turniej', dziedzina: 'urok', od: '2026-10-09', do: '2026-10-11', opis: 'Dla kotów' }],
                wyniki: [{ event: 'teo-mas:PLACEHOLDER', wygrane: 2, starc: 3, kiedy: '2026-10-09T11:00:00Z' }] } },
            'https://zly.example/api/wizytowka': { nick: 'falszywa', klucz: 'KINNY', mistrz: { eventy: [{ id: 'g-99999999', typ: 'turniej', dziedzina: 'takt', od: '2026-10-09', do: '2026-10-09' }] } },
            'https://stara.example/api/wizytowka': { nick: 'stara', klucz: 'KS' },
        };
        const f = async (url) => {
            if (!(url in siec)) throw new Error(`brak ${url}`);
            return { ok: true, status: 200, json: async () => siec[url] };
        };
        const K = utworzKlub({ katalog: kat, nick: async () => 'teo-mas', rejestr: 'https://rejestr/api/katedry', fetch: f, teraz: () => teraz,
            mistrz: async () => ({ etap: 'jajo', obserwacji: 4, zasad: 0, teterhia: 'Turniej: Takt' }), wiesc: async (w) => wiesci.push(w) });
        await assert.rejects(K.oglos({ dziedzina: 'magia' }), /Dziedzina/);
        await assert.rejects(K.oglos({ dziedzina: 'takt', dni: 9 }), /od 1 do 7 dni/);
        const moj = await K.oglos({ dziedzina: 'takt', dni: 3, opis: 'Kto upadł, wstaje w rytmie' });
        assert.deepEqual([moj.od, moj.do, moj.nazwa], ['2026-10-09', '2026-10-11', 'Turniej Taktu Klubu Mistrzów']);
        siec['https://ola.example/api/wizytowka'].mistrz.wyniki[0].event = moj.klucz;
        const pub = await K.publiczne();
        assert.deepEqual([pub.etap, pub.teterhia, pub.eventy.length, pub.eventy[0].dziedzina], ['jajo', 'Turniej: Takt', 1, 'takt']);
        assert.equal(pub.eventy[0].klucz, undefined, 'wizytówka niesie dane źródłowe, nie wyliczone');
        // zwiad
        const p = await K.zwiad();
        assert.deepEqual(p.czlonkowie.map((c) => c.nick), ['wyspa-ola']);
        assert.deepEqual(p.pominiete.map((x) => x.nick).sort(), ['falszywa', 'stara']);
        assert.match(p.pominiete.find((x) => x.nick === 'falszywa').powod, /nie zgadza się z rejestrem/);
        assert.deepEqual(p.eventy.map((e) => e.klucz), [moj.klucz, 'wyspa-ola:g-11112222']);
        assert.deepEqual(p.rankingi[moj.klucz].map((w) => [w.nick, w.wygrane]), [['wyspa-ola', 2]]);
        assert.ok(wiesci.some((w) => /Katedra „wyspa-ola” ogłasza Turniej Uroku Klubu Mistrzów do 2026-10-11 — Dla kotów/.test(w.tresc)));
        assert.ok(wiesci.some((w) => /Turniej Taktu Klubu Mistrzów \(Twój\): Katedra „wyspa-ola” — 2\/3/.test(w.tresc)));
        const ile = wiesci.length;
        await K.zwiad({ swiezo: true });
        assert.equal(wiesci.length, ile, 'te same wieści drugi raz nie lecą');
        // gra: turniej Klubu przez Mistrza Gry → najlepszy wynik w wizytówce
        const glob = await K.aktywneGlobalne();
        assert.deepEqual(glob.map((e) => e.mod.turniej), [{ dziedzina: 'takt', starc: 3, nagrodaMGRV: 0 }, { dziedzina: 'urok', starc: 3, nagrodaMGRV: 0 }]);
        const MG = utworzMistrzaGry({ katalog: path.join(kat, 'mg'), klub: K, wiesc: async (w) => wiesci.push(w), teraz: () => new Date(teraz) });
        await assert.rejects(MG.wynikTurnieju({ event: 'wyspa-ola:g-11112222', dziedzina: 'takt', wygrane: 3, starc: 3 }), /w dziedzinie Urok/);
        const r1 = await MG.wynikTurnieju({ event: 'wyspa-ola:g-11112222', dziedzina: 'urok', wygrane: 2, starc: 3, gracz: { imie: 'Arek' } });
        assert.equal(r1.nagrodaMGRV, 0);
        await MG.wynikTurnieju({ event: 'wyspa-ola:g-11112222', dziedzina: 'urok', wygrane: 1, starc: 3, gracz: { imie: 'Arek' } });
        assert.equal((await K.publiczne()).wyniki[0].wygrane, 2, 'gorszy wynik nie nadpisuje lepszego');
        assert.match(wiesci.at(-1).tresc, /Arek — Turniej Uroku Klubu Mistrzów \(Katedra „wyspa-ola”\): 2\/3\./);
        // po końcu eventu: znika z gry i z wizytówki
        teraz = Date.parse('2026-10-12T12:00:00Z');
        assert.equal((await K.publiczne()).eventy.length, 0);
        await assert.rejects(K.zapiszWynik({ event: moj.klucz, dziedzina: 'takt', wygrane: 3, starc: 3 }), /nie trwa/);
        // bez nicku — Klub mówi, co zrobić
        const bez = utworzKlub({ katalog: kat, nick: async () => null, rejestr: 'x', fetch: f });
        await assert.rejects(bez.oglos({ dziedzina: 'takt' }), /najpierw 🪪 Wizytówka/);
    } finally { await fs.rm(kat, { recursive: true, force: true }); }
});
