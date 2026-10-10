/**
 * 🌍 Tłumacz w apkach Katedry — most dokleja `<script type="module" src="/tlumacz.js">` do stron HTML, które sam
 * serwuje (/apps/…, /apki/<id>/, /swiat/), żeby apki w Pierścieniu mówiły językiem Huba (public/tlumacz.js,
 * rdzeń lib/tlumaczRdzen.js). Studia na własnych portach (dev) mają tę jedną linię w swoim index.html.
 * Strona, która już ma tłumacza, zostaje nietknięta.
 */
import fs from 'fs/promises';
import path from 'path';

export const ZNACZNIK_TLUMACZA = 'tlumacz.js';

/** HTML z doklejonym skryptem tłumacza (przed </head>, inaczej na początku <body>/dokumentu). */
export function wstrzyknijTlumacza(html, src = '/tlumacz.js') {
    const s = String(html ?? '');
    if (/<script[^>]+src=["'][^"']*\/tlumacz\.js["']/i.test(s)) return s;
    const tag = `<script type="module" src="${src}"></script>`;
    if (/<\/head>/i.test(s)) return s.replace(/<\/head>/i, `${tag}</head>`);
    if (/<body[^>]*>/i.test(s)) return s.replace(/<body[^>]*>/i, (m) => `${m}${tag}`);
    return tag + s;
}

/**
 * Middleware przed express.static: GET/HEAD strony HTML z `katalog(req)` → z tłumaczem; reszta (i brak pliku) idzie dalej.
 * Adres katalogu bez końcowego „/” zostawiamy static (przekierowanie — inaczej względne ścieżki assetów się sypią).
 */
export function htmlZTlumaczem(katalog) {
    return async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        let p;
        try { p = decodeURIComponent(req.path); } catch { return next(); }
        if (p.endsWith('/')) {
            if (!String(req.originalUrl || '').split('?')[0].endsWith('/')) return next();
            p += 'index.html';
        }
        if (!/\.html?$/i.test(p)) return next();
        const baza = path.resolve(typeof katalog === 'function' ? katalog(req) : katalog);
        const plik = path.resolve(baza, '.' + p);
        if (!plik.startsWith(baza + path.sep)) return next();
        let html;
        try { html = await fs.readFile(plik, 'utf8'); } catch { return next(); }
        res.set('Cache-Control', 'no-cache');
        res.type('html').send(wstrzyknijTlumacza(html));
    };
}
