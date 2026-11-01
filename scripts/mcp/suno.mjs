#!/usr/bin/env node
/**
 * 🎵🔌 MCP Suno Katedry (stdio) — narzędzia Suno Suwerena dla Głównego i Claude Code, BEZ klucza w kliencie.
 * Suweren 2026-11-01: „suno.com/mcp bezpośrednio podłączyć do Katedry z moim kontem Suno”.
 *
 * Konto Suno trzyma most (services/SunoMcp.js: OAuth, token w Skarbcu, HTTP/2 omija Avasta). Ten serwer tylko
 * przekazuje: tools/list ← GET /api/suno/narzedzia, tools/call → POST /api/suno/wywolaj. Narzędzie, które może
 * wydać kredyty Suno (bez readOnlyHint u Suno), dostaje tu parametr `zgoda` — bez `zgoda: true` most odmawia.
 * Gotowe utwory most sam zapisuje w _OtakOs_Muzyka/Suno MCP/ (wynik mówi, który plik).
 */
import path from 'path';
import { pathToFileURL } from 'url';
import { uruchomStdio, skroc, WERSJE_PROTOKOLU } from './game-studio.mjs';

export const NAZWA = 'katedra-suno';
const ZGODA = { type: 'boolean', description: 'Jawna zgoda Suwerena: to narzędzie może wydać kredyty Suno albo zmienić bibliotekę. Bez true most odmawia — zapytaj Suwerena.' };

export function utworzSerwerSuno({ most = process.env.OTAKOS_MOST || 'http://127.0.0.1:3001', fetch: f = globalThis.fetch } = {}) {
    async function wolaj(metoda, sciezka, cialo) {
        let r;
        try { r = await f(`${most}${sciezka}`, { method: metoda, headers: cialo ? { 'Content-Type': 'application/json' } : {}, body: cialo ? JSON.stringify(cialo) : undefined, signal: AbortSignal.timeout(10 * 60_000) }); }
        catch (e) { throw new Error(`Most Katedry nie odpowiada (${most}): ${e.message}. Czy Katedra działa?`); }
        const j = await r.json().catch(() => null);
        if (!r.ok || j?.success === false) throw new Error(j?.message ?? `HTTP ${r.status}`);
        return j;
    }
    async function narzedzia() {
        const { narzedzia: lista } = await wolaj('GET', '/api/suno/narzedzia');
        return lista.map((n) => {
            const zgoda = n.annotations?.readOnlyHint !== true;
            const schemat = { type: 'object', ...(n.inputSchema ?? {}) };
            if (zgoda) schemat.properties = { ...(schemat.properties ?? {}), zgoda: ZGODA };
            return { name: n.name, description: `${zgoda ? '[💳 kredyty Suno — zgoda Suwerena] ' : ''}${n.description ?? ''}`, inputSchema: schemat, annotations: n.annotations ?? {} };
        });
    }
    async function obsluz(w) {
        const { id, method, params } = w ?? {};
        const ok = (result) => ({ jsonrpc: '2.0', id, result });
        if (w?.jsonrpc !== '2.0' || typeof method !== 'string') return id === undefined ? null : { jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid Request' } };
        if (id === undefined) return null;
        switch (method) {
            case 'initialize': {
                const chce = params?.protocolVersion;
                return ok({ protocolVersion: WERSJE_PROTOKOLU.includes(chce) ? chce : WERSJE_PROTOKOLU[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: NAZWA, version: '1.0.0' },
                    instructions: 'Suno konta Suwerena przez most Katedry. Utwory, które coś tworzą/wydają kredyty, mają parametr zgoda — ustaw true TYLKO po wyraźnym „tak” Suwerena. Gotowe utwory lądują w _OtakOs_Muzyka/Suno MCP/. Brak połączenia = Suweren łączy konto w Hubie (Impresariat → 🎵 Suno).' });
            }
            case 'ping': return ok({});
            case 'tools/list':
                try { return ok({ tools: await narzedzia() }); }
                catch (e) { return ok({ tools: [{ name: 'suno_stan', description: `Suno niedostępne: ${e.message}`, inputSchema: { type: 'object', properties: {} } }] }); }
            case 'tools/call': {
                const { name, arguments: args = {} } = params ?? {};
                try {
                    if (name === 'suno_stan') return ok({ content: [{ type: 'text', text: skroc((await wolaj('GET', '/api/suno/stan')).suno) }] });
                    const { zgoda, ...reszta } = args ?? {};
                    const r = await wolaj('POST', '/api/suno/wywolaj', { narzedzie: name, argumenty: reszta, zgoda: zgoda === true });
                    const zapisane = (r.utwory ?? []).filter((u) => u.plik).map((u) => `🎵 w bibliotece: _OtakOs_Muzyka/${u.plik}${u.nowy ? '' : ' (był)'}`);
                    return ok({ ...r.wynik, content: [...(r.wynik?.content ?? []), ...(zapisane.length ? [{ type: 'text', text: zapisane.join('\n') }] : [])] });
                } catch (e) { return ok({ isError: true, content: [{ type: 'text', text: e.message }] }); }
            }
            case 'resources/list': return ok({ resources: [] });
            case 'prompts/list': return ok({ prompts: [] });
            default: return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
        }
    }
    return { obsluz };
}

const glowny = !!process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase() === import.meta.url.toLowerCase();
if (glowny) {
    uruchomStdio(utworzSerwerSuno());
    process.stderr.write(`[${NAZWA}] gotowy, most: ${process.env.OTAKOS_MOST || 'http://127.0.0.1:3001'}\n`);
}
