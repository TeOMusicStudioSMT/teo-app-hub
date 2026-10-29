// 🌐 Wix MCP dla Głównego: serwer tylko po włączeniu, żadne narzędzie Wix bez prośby ✓, Tłumacz mówi o żywej stronie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Glowny from '../services/Glowny.js';

test('wpis serwera: Windows przez cmd /c npx, inaczej npx; adres oficjalny Wix', () => {
    assert.deepEqual(Glowny.wpisWixMcp('win32'), { type: 'stdio', command: 'cmd', args: ['/c', 'npx', '-y', '@wix/mcp-remote', 'https://mcp.wix.com/sse'] });
    assert.equal(Glowny.wpisWixMcp('linux').command, 'npx');
});

test('serwer Wix tylko, gdy most go podał; narzędzia Wix nie trafiają do „bez pytania”', () => {
    Glowny.skonfiguruj({ wixMcp: () => null, mcpStudio: null });
    assert.equal(Glowny.serweryMcp().wix, undefined);
    Glowny.skonfiguruj({ wixMcp: () => Glowny.wpisWixMcp('win32') });
    assert.equal(Glowny.serweryMcp().wix.command, 'cmd');
    const a = Glowny.argumenty({ tekst: 'cześć', sesjaId: '00000000-0000-4000-8000-000000000000', model: 'm' });
    const mcp = JSON.parse(a[a.indexOf('--mcp-config') + 1]);
    assert.ok(mcp.mcpServers.wix);
    assert.ok(!a.some((x) => String(x).startsWith('mcp__wix__')), 'żadne narzędzie Wix bez ✓');
    assert.match(a[a.indexOf('--append-system-prompt') + 1], /WIX \(MCP[\s\S]*KOPII strony/);
    Glowny.skonfiguruj({ wixMcp: () => null });
});

test('Tłumacz próśb: odczyt Wix = średnie, wywołanie API strony = wysokie i ostrzeżenie o żywej stronie', () => {
    const c = Glowny.tlumacz('mcp__wix__SearchWixRESTDocumentation', { query: 'pages' });
    assert.equal(c.ryzyko, 'srednie');
    const z = Glowny.tlumacz('mcp__wix__CallWixSiteAPI', { url: 'https://www.wixapis.com/x', method: 'PATCH' });
    assert.equal(z.ryzyko, 'wysokie');
    assert.match(z.coRobi, /ZMIENIĆ żywą stronę/);
    assert.equal(z.klucz, 'mcp__wix__CallWixSiteAPI');
});
