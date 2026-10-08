// ⚖️ Jev (TypeSafe) — sędzia semantyczny; Sędzia zadania w Kodeksie (Suweren 2026-10-08).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utworzJev } from '../services/Jev.js';

function atrapa(odp, status = 200) {
    const wolania = [];
    const f = async (url, init) => { wolania.push({ url, init, body: JSON.parse(init.body) }); return new Response(JSON.stringify(odp), { status }); };
    return { f, wolania };
}

test('bez klucza: czyZrobione = null (sędzia pominięty), zapytaj = błąd BEZ_KLUCZA', async () => {
    const a = atrapa({});
    const j = utworzJev({ klucz: () => null, fetch: a.f });
    assert.equal(await j.czyZrobione({ zadanie: 'x', zmiany: 'y' }), null);
    await assert.rejects(j.zapytaj({ state: 's', questions: {} }), (e) => e.kod === 'BEZ_KLUCZA');
    assert.equal(a.wolania.length, 0);
});

test('czyZrobione: POST /systemone z Bearer, model jev-latest, pytanie noul; p z odpowiedzi; tokeny liczone', async () => {
    const a = atrapa({ model: 'jev-1.13.0', answers: { zrobione: { type: 'noul', noul: 0.12 } }, usage: { input_tokens: 300, output_tokens: 20 } });
    const j = utworzJev({ klucz: () => 'apikey_test', fetch: a.f });
    const w = await j.czyZrobione({ zadanie: 'Quest od Kustosza przez POST /api/tgs/quest', zmiany: '+ loader.load(skrzynia)' });
    assert.deepEqual(w, { p: 0.12, model: 'jev-1.13.0' });
    const { url, init, body } = a.wolania[0];
    assert.match(url, /\/v1\/systemone$/);
    assert.equal(init.headers.Authorization, 'Bearer apikey_test');
    assert.equal(body.model, 'jev-latest');
    assert.equal(body.questions.zrobione.type, 'noul');
    assert.ok(body.questions.zrobione.criteria.true && body.questions.zrobione.criteria.false);
    assert.match(body.state.zadanie, /Kustosza/);
    assert.equal(j.stan().dzis.tokeny, 320);
});

test('błędy HTTP mówią po ludzku (401 klucz, 429 limit) i zostają w stanie', async () => {
    const j = utworzJev({ klucz: () => 'apikey_zly', fetch: atrapa({ detail: 'invalid' }, 401).f });
    await assert.rejects(j.czyZrobione({ zadanie: 'a', zmiany: 'b' }), /Jev HTTP 401 \(zły albo nieważny klucz\)/);
    assert.match(j.stan().dzis.ostatniBlad, /401/);
    const j2 = utworzJev({ klucz: () => 'apikey_x', fetch: atrapa({}, 429).f });
    await assert.rejects(j2.zapytaj({ state: 's', questions: {} }), /429 \(limit zapytań/);
});

test('długie zmiany przycinane (koszt pod kontrolą)', async () => {
    const a = atrapa({ model: 'jev', answers: { zrobione: { noul: 0.9 } }, usage: {} });
    const j = utworzJev({ klucz: () => 'apikey_x', fetch: a.f });
    await j.czyZrobione({ zadanie: 'z'.repeat(9000), zmiany: 'x'.repeat(100_000) });
    assert.equal(a.wolania[0].body.state.zadanie.length, 4000);
    assert.equal(a.wolania[0].body.state.zmiany_w_kodzie.length, 24_000);
});
