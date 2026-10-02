// 🎓 Akademia Katedry: quizy muszą mieć poprawną odpowiedź wśród opcji, przewodniki — prawdziwe widoki Hubu,
// recenzje — pliki, które naprawdę leżą w public/ (dawniej: zaślepkowe ID filmów YouTube).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transformSync } from 'esbuild';

const zrodlo = fs.readFileSync(new URL('../constants/education.ts', import.meta.url), 'utf8');
const { code } = transformSync(zrodlo, { loader: 'ts', format: 'esm' });
const { QUIZZES, TUTORIALS, RECENZJE } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('Akademia: każdy quiz ma unikalne id, ≥ 3 pytania, a poprawna odpowiedź jest jedną z opcji', () => {
    assert.ok(QUIZZES.length >= 3);
    assert.equal(new Set(QUIZZES.map((q) => q.id)).size, QUIZZES.length);
    for (const q of QUIZZES) {
        assert.ok(q.questions.length >= 3, q.id);
        for (const p of q.questions) {
            assert.ok(p.options.includes(p.correctAnswer), `${q.id}: „${p.question}”`);
            assert.equal(new Set(p.options).size, p.options.length, `${q.id}: zdublowana opcja`);
        }
    }
});

test('Akademia: przewodniki prowadzą do istniejących widoków Hubu i nie mają atrap filmów', () => {
    const nawigacja = fs.readFileSync(new URL('../components/LoungeNavigation.tsx', import.meta.url), 'utf8');
    for (const t of TUTORIALS) {
        assert.ok(t.steps.length >= 2, t.id);
        assert.equal(t.videoId, undefined, t.id);
        if (t.widok) assert.match(nawigacja, new RegExp(`id: '${t.widok}'`), `${t.id} → ${t.widok}`);
    }
});

test('Akademia: wideo i plakat recenzji leżą w public/', () => {
    for (const r of RECENZJE) {
        for (const plik of [...(r.wideo ?? []), r.plakat].filter(Boolean)) {
            assert.ok(fs.existsSync(new URL(`../public${plik}`, import.meta.url)), plik);
        }
        assert.ok(r.rozmowa.some((w) => w.kto === 'ai') && r.rozmowa.some((w) => w.kto === 'suweren'), r.id);
    }
});
