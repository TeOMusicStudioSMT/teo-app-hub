/**
 * 🛡️🎼 Straż modeli — „auto 3” (Suweren 2026-10-08: „opcja 2… oraz auto 3… jak już mamy Dyrygenta zmodernizowanego”).
 *
 * Ollama 0.40.0 potrafi „zgubić” model (manifest-dowiązanie → „untrusted mount point” → model znika z /api/tags,
 * a zapytania kończą się HTTP 500 — tak padł model Aktora 2026-10-08). Straż co `coMs` porównuje przydział
 * TeOgochi (ModeleAgentow) z modelami, które Ollama NAPRAWDĘ widzi:
 *   · model zniknął → Dyrygent daje zastępcę z katalogu (reguły ról: Kodeks kod/≥7B, Wektor ≥8B, scalający >4,5B),
 *     zapis w `zastepstwa.json` + szyna; najbliższy rozmiarem oryginału (podobny instrument, nie największy),
 *   · oryginał wrócił → przywraca go i zdejmuje zastępstwo,
 *   · Suweren / Dyrygent ustawił w międzyczasie coś innego → zastępstwo zapomniane (decyzja człowieka wygrywa).
 * Modeli chmury (:cloud) nie rusza — ich nie ma w /api/tags lokalnie po awarii sieci, a to inny problem.
 */
import fs from 'fs/promises';
import path from 'path';

/**
 * @param {{ plik: string, modeleAgentow: () => Promise<Record<string,string>>, ustaw: (agent: string, model: string) => Promise<unknown>,
 *           tagi: () => Promise<{models: {name: string}[]}>, katalog: () => Promise<object[]>, zastepca: (kat: object[], agent: string, oryginal: string) => object|null,
 *           szyna?: object|null, coMs?: number }} o
 */
export function utworzStrazModeli({ plik, modeleAgentow, ustaw, tagi, katalog, zastepca, szyna = null, coMs = 10 * 60_000 }) {
    let timer = null;
    const ostatnio = { kiedy: null, zmiany: [], blad: null };

    async function czytaj() { try { return JSON.parse(await fs.readFile(plik, 'utf8')); } catch { return {}; } }
    async function zapisz(d) {
        await fs.mkdir(path.dirname(plik), { recursive: true });
        await fs.writeFile(plik, JSON.stringify(d, null, 2), 'utf8');
    }
    const jest = (nazwy, m) => nazwy.has(m) || nazwy.has(`${m}:latest`) || nazwy.has(String(m).replace(/:latest$/, ''));

    /** Jedno sprawdzenie. Zwraca listę zmian [{agent, z, na, powod, rodzaj: 'zastepstwo'|'powrot'|'brak-zastepcy'|'zapomniane'}]. */
    async function sprawdz() {
        const zmiany = [];
        try {
            const nazwy = new Set(((await tagi()).models ?? []).map((m) => m.name ?? m.model));
            if (!nazwy.size) throw new Error('Ollama nie podała żadnego modelu (śpi?) — nic nie ruszam.');
            const przydzial = await modeleAgentow();
            const zast = await czytaj();
            // 1) zastępstwa: powrót oryginału / zmiana przez człowieka
            for (const [agent, z] of Object.entries(zast)) {
                if (przydzial[agent] !== z.zastepca) { delete zast[agent]; zmiany.push({ agent, rodzaj: 'zapomniane', z: z.oryginal, na: przydzial[agent] ?? null, powod: 'przydział zmieniony ręcznie albo przez Dyrygenta' }); continue; }
                if (jest(nazwy, z.oryginal)) {
                    await ustaw(agent, z.oryginal);
                    delete zast[agent];
                    zmiany.push({ agent, rodzaj: 'powrot', z: z.zastepca, na: z.oryginal, powod: 'oryginalny model znowu jest w Ollamie' });
                }
            }
            // 2) przydziały na modele, których Ollama nie widzi
            let kat = null;
            for (const [agent, model] of Object.entries(przydzial)) {
                if (!model || /:cloud$|-cloud$/.test(model) || /^(claude|gemini):/.test(model) || jest(nazwy, model) || zast[agent]) continue;
                kat ??= (await katalog()).filter((m) => jest(nazwy, m.nazwa));
                const z = zastepca(kat, agent, model);
                if (!z) { zmiany.push({ agent, rodzaj: 'brak-zastepcy', z: model, na: null, powod: 'model zniknął z Ollamy, a w katalogu nie ma nic, co spełnia jego rolę' }); continue; }
                await ustaw(agent, z.nazwa);
                zast[agent] = { oryginal: model, zastepca: z.nazwa, kiedy: new Date().toISOString() };
                zmiany.push({ agent, rodzaj: 'zastepstwo', z: model, na: z.nazwa, powod: 'model zniknął z Ollamy (np. zablokowany manifest) — zastępca wg reguł roli, wróci sam' });
            }
            await zapisz(zast);
            for (const c of zmiany.filter((x) => x.rodzaj !== 'zapomniane')) {
                await szyna?.nadaj?.({ agent: 'Dyrygent', rodzaj: c.rodzaj === 'brak-zastepcy' ? 'blad' : 'praca', tresc: c.rodzaj === 'powrot' ? `🛡️ ${c.agent}: wraca na ${c.na}` : c.rodzaj === 'zastepstwo' ? `🛡️ ${c.agent}: ${c.z} zniknął z Ollamy — gra teraz na ${c.na}` : `🛡️ ${c.agent}: ${c.z} zniknął z Ollamy — brak zastępcy`, dane: c }).catch(() => {});
            }
            ostatnio.blad = null;
        } catch (e) { ostatnio.blad = String(e.message || e).slice(0, 200); }
        ostatnio.kiedy = new Date().toISOString();
        ostatnio.zmiany = zmiany;
        return zmiany;
    }

    function start(opoznienieMs = 60_000) {
        if (timer) return;
        timer = { raz: null, co: null };
        timer.raz = setTimeout(() => { void sprawdz(); timer.co = setInterval(() => void sprawdz(), coMs); timer.co.unref?.(); }, opoznienieMs);
        timer.raz.unref?.();
    }
    function stop() { if (!timer) return; clearTimeout(timer.raz); clearInterval(timer.co); timer = null; }

    return { sprawdz, start, stop, stan: async () => ({ ...ostatnio, zastepstwa: await czytaj() }) };
}

export default { utworzStrazModeli };
