// 🔐 Skarbiec 0.00G: usuwanie klucza i nowy skarbiec z nowym kluczem głównym (Suweren 2026-10-13: „w skarbcu nie
// da się usunąć kluczy”); trasy Skarbca tylko przy maszynie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Vault from '../services/VaultService.js';
import { SCIEZKI_TYLKO_LOKALNE } from '../services/StrazMostu.js';

const KATALOG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.vault-0.00g');

test('usuń klucz, potem nowy skarbiec: inny klucz główny, zero sekretów', async () => {
    const kopia = path.join(KATALOG + '-test-kopia');
    const bylo = await fs.stat(KATALOG).then(() => true, () => false);
    if (bylo) await fs.cp(KATALOG, kopia, { recursive: true });
    try {
        const v = Vault.getInstance();
        await v.setSecret('gemini', 'api_key', 'AIza-test-1234567890');
        await v.setSecret('anthropic', 'api_key', 'sk-ant-test-1234567890');
        assert.equal(await v.deleteSecret('gemini', 'api_key'), true);
        assert.equal(await v.getSecret('gemini', 'api_key'), null);
        assert.equal(await v.getSecret('anthropic', 'api_key'), 'sk-ant-test-1234567890');
        const stary = await fs.readFile(path.join(KATALOG, '.master'), 'utf8');
        const w = await v.resetuj();
        assert.ok(w.usunietoUslug >= 1);
        assert.notEqual(await fs.readFile(path.join(KATALOG, '.master'), 'utf8'), stary, 'nowy klucz główny');
        assert.equal(await v.getSecret('anthropic', 'api_key'), null, 'stare sekrety przepadły');
        assert.ok((await v.getStatus()).every((s) => !s.connected));
    } finally {
        await fs.rm(KATALOG, { recursive: true, force: true });
        if (bylo) await fs.rename(kopia, KATALOG);
    }
});

test('Straż: trasy Skarbca tylko przy maszynie', () => {
    for (const p of ['/api/vault/status', '/api/vault/set', '/api/vault/sekret/', '/api/vault/resetuj']) assert.ok(SCIEZKI_TYLKO_LOKALNE.includes(p), p);
});
