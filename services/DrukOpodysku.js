/**
 * 🖨️ Druk Opodysku (Suweren 2026-11-14): Manuskrypt PDF z utworu i Rolowany Pergamin (TeOfon Scroll).
 *
 * Czyste budowniczki HTML (testowalne bez przeglądarki) + `htmlDoPdf` (puppeteer → wektorowy PDF, fonty systemowe, polskie znaki).
 *  • `htmlManuskryptu` — książeczka A5: okładka, karta tytułowa, tekst utworu w dwóch szpaltach, po stronie na AKT
 *    (klatka FLUX, opis akcji, wersy), kolofon. Obrazy po względnych nazwach z katalogu roboczego (file://).
 *  • `htmlPergaminu` — jedna strona o rozmiarze wstęgi (SVG zbudowany w przeglądarce silnikiem partytury) do druku na rolce.
 *  • `macierzQr` — moduły kodu QR z biblioteki `qrcode` (SVG rysuje je w przeglądarce jako kwadraty — wektor, bez obrazu).
 */
import { pathToFileURL } from 'url';

const ZNAKI = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ZNAKI[c]);
const sek = (s) => (Number(s) > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');
const akapity = (t) => String(t ?? '').split(/\n+/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join('');

/**
 * @param {{tytul, album, artysci: string[], bpm?, sekundy?, okladka?: string|null, tekst?: {nazwa, wersy: string[]}[], akty: {nr, sekcja, od?, do?, plan?, opis?, wersy: string[], obraz?: string|null}[], autor?: string, kolofon?: string}} d
 */
export function htmlManuskryptu(d) {
    const kto = (d.artysci ?? []).join(' & ');
    let nr = 1;
    const strona = (tresc, klasa = '') => `<section class="strona ${klasa}">${tresc}<div class="stopka"><span>OPODYSK 0.00G · ${esc(d.tytul)}</span><span>${nr++}</span></div></section>`;
    const sekcjeTekstu = (d.tekst ?? []).filter((s) => s.wersy?.length)
        .map((s) => `<div class="sekcja"><h4>${esc(s.nazwa)}</h4>${s.wersy.map((w) => `<div class="wers">${esc(w)}</div>`).join('')}</div>`).join('');
    const strony = [];
    strony.push(`<section class="okladka">${d.okladka ? `<img src="${esc(d.okladka)}" alt="">` : ''}<div class="tytul-okl"><div class="mala">OPODYSK 0.00G</div><h1>${esc(d.tytul)}</h1><div class="mala">${esc(kto)}</div></div></section>`);
    nr = 2;
    strony.push(strona(`<div class="karta"><div class="mala">MANUSKRYPT · ŻYWA KSIĘGA</div><h2>${esc(d.tytul)}</h2><div class="podtytul">${esc(kto)}</div><div class="linia"></div>
        <div class="dane">${esc(d.album ?? '')}${d.bpm ? ` · ${esc(d.bpm)} BPM` : ''}${d.sekundy ? ` · ${esc(sek(d.sekundy))}` : ''}</div>
        <div class="dane">${d.akty?.length ? `${d.akty.length} aktów` : ''}</div></div>`, 'tytulowa'));
    if (sekcjeTekstu) strony.push(strona(`<h3>Tekst utworu</h3><div class="szpalty">${sekcjeTekstu}</div>`, 'tekst'));
    for (const a of d.akty ?? []) {
        strony.push(strona(`${a.obraz ? `<div class="kadr"><img src="${esc(a.obraz)}" alt=""></div>` : '<div class="kadr pusty"></div>'}
            <div class="naglowek"><span class="nrakt">AKT ${esc(a.nr)}</span><span class="sekcja-akt">${esc(a.sekcja)}</span>${a.od != null ? `<span class="czas">${esc(sek(a.od))}–${esc(sek(a.do))}</span>` : ''}</div>
            ${a.plan ? `<div class="plan">${esc(a.plan)}</div>` : ''}${a.opis ? `<div class="opis">${akapity(a.opis)}</div>` : ''}
            ${a.wersy?.length ? `<blockquote>${a.wersy.map((w) => `<div>${esc(w)}</div>`).join('')}</blockquote>` : ''}`, 'akt'));
    }
    strony.push(strona(`<div class="karta koniec"><div class="mala">KOLOFON</div><div class="linia"></div><p>${esc(d.kolofon ?? 'Złożone w Katedrze OtakOS z utworu i storyboardu 0.00G.')}</p>${d.autor ? `<p class="dane">${esc(d.autor)}</p>` : ''}<div class="pieczec">0.00G</div></div>`, 'tytulowa'));
    return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${esc(d.tytul)} — manuskrypt 0.00G</title><style>
@page { size: 148mm 210mm; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; font-family: Georgia, 'Palatino Linotype', 'Times New Roman', serif; color: #2b2217; }
.okladka, .strona { width: 148mm; height: 210mm; position: relative; overflow: hidden; page-break-after: always; break-after: page; }
.okladka { background: #080a14; color: #f3e3c2; }
.okladka img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .55; }
.okladka::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(8,10,20,.78), rgba(8,10,20,.1) 38%, rgba(8,10,20,.85)); }
.tytul-okl { position: absolute; left: 0; right: 0; bottom: 22mm; z-index: 2; text-align: center; padding: 0 14mm; }
.tytul-okl h1 { font-size: 25pt; margin: 4mm 0; font-weight: 400; letter-spacing: .02em; }
.mala { font: 600 7.5pt 'Segoe UI', Arial, sans-serif; letter-spacing: .32em; color: #d4a853; }
.strona { background: #f6efdd; padding: 15mm 14mm 16mm; }
.stopka { position: absolute; left: 14mm; right: 14mm; bottom: 8mm; display: flex; justify-content: space-between; font: 7pt 'Segoe UI', Arial, sans-serif; letter-spacing: .12em; color: #8a7a55; text-transform: uppercase; }
.tytulowa { display: flex; align-items: center; justify-content: center; text-align: center; }
.karta h2 { font-size: 22pt; font-weight: 400; margin: 5mm 0 2mm; } .podtytul { font-style: italic; font-size: 12pt; color: #6b5a2a; }
.linia { width: 30mm; height: 0; border-top: 1px solid #b8862b; margin: 7mm auto; } .dane { font-size: 9.5pt; color: #6b5a2a; margin: 1.5mm 0; }
.koniec p { font-size: 10pt; line-height: 1.5; max-width: 90mm; margin: 0 auto 3mm; } .pieczec { margin: 10mm auto 0; width: 22mm; height: 22mm; border: 1px solid #b8862b; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 600 9pt 'Segoe UI', Arial, sans-serif; letter-spacing: .15em; color: #b8862b; }
h3 { font-size: 15pt; font-weight: 400; margin: 0 0 6mm; text-align: center; letter-spacing: .08em; color: #6b4a12; }
.szpalty { column-count: 2; column-gap: 9mm; font-size: 9pt; line-height: 1.38; } .sekcja { break-inside: avoid; margin-bottom: 4mm; }
.sekcja h4 { margin: 0 0 1mm; font: 600 6.8pt 'Segoe UI', Arial, sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #a2741e; } .wers { font-style: italic; }
.kadr { width: 100%; aspect-ratio: 16 / 9; border-radius: 1.5mm; overflow: hidden; border: .6mm solid #d7c597; background: #151826; } .kadr img { width: 100%; height: 100%; object-fit: cover; display: block; }
.naglowek { display: flex; align-items: baseline; gap: 3mm; margin: 6mm 0 1.5mm; } .nrakt { font: 700 8pt 'Segoe UI', Arial, sans-serif; letter-spacing: .3em; color: #a2741e; }
.sekcja-akt { font-size: 14pt; flex: 1; } .czas { font: 7.5pt 'Segoe UI', Arial, sans-serif; color: #8a7a55; }
.plan { font: italic 8pt 'Segoe UI', Arial, sans-serif; color: #8a7a55; margin-bottom: 3mm; } .opis p { margin: 0 0 2.5mm; font-size: 10pt; line-height: 1.5; text-align: justify; hyphens: auto; }
blockquote { margin: 4mm 0 0; padding: 0 0 0 5mm; border-left: .6mm solid #b8862b; font-style: italic; font-size: 10.5pt; line-height: 1.55; color: #4a3b1f; }
</style></head><body>${strony.join('')}</body></html>`;
}

/** Wstęga pergaminu jako jedna strona PDF o rozmiarze obrazu (px CSS; Chrome liczy 96 px = 1 cal). */
export function htmlPergaminu(svg, szer, wys) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>@page { size: ${Math.round(szer)}px ${Math.round(wys)}px; margin: 0; } html, body { margin: 0; padding: 0; } svg { display: block; }</style></head><body>${svg}</body></html>`;
}

/** Rozmiar SVG z atrybutów korzenia (wstęga ma je zawsze); poza zakresem PDF Chrome'a (≤ 200 cali) = błąd. */
export function rozmiarSvg(svg) {
    const g = /<svg\b[^>]*>/i.exec(String(svg ?? ''))?.[0] ?? '';
    const w = Number(/\swidth="([\d.]+)"/.exec(g)?.[1]), h = Number(/\sheight="([\d.]+)"/.exec(g)?.[1]);
    if (!(w > 100 && h > 100)) throw new Error('SVG nie ma rozmiaru (width/height na korzeniu).');
    if (w > 19000 || h > 19000) throw new Error('Wstęga jest za duża na PDF (limit ~19 000 px = 200 cali).');
    return { szer: w, wys: h };
}
/** Pergamin przychodzi z przeglądarki Suwerena, ale i tak: żadnych skryptów ani odwołań poza dokument. */
export function sprawdzSvg(svg) {
    const t = String(svg ?? '');
    if (!/^\s*(<\?xml[^>]*>\s*)?<svg\b/i.test(t) || !/<\/svg>\s*$/i.test(t)) throw new Error('To nie jest SVG.');
    if (t.length > 40 * 1024 * 1024) throw new Error('SVG za duży (limit 40 MB).');
    if (/<script|<foreignObject|\son\w+\s*=|javascript:|<iframe|<image[^>]+href\s*=\s*["']?(?!data:)/i.test(t)) throw new Error('SVG zawiera elementy, których pergamin nie używa (skrypty, obce obrazy).');
    return rozmiarSvg(t);
}

/** Kod QR: macierz modułów jako wiersze „0101…” (SVG rysuje z nich kwadraty). */
export function macierzQr(QRCode, tresc) {
    const q = QRCode.create(String(tresc), { errorCorrectionLevel: 'M' }), n = q.modules.size, d = q.modules.data;
    const wiersze = [];
    for (let y = 0; y < n; y++) { let r = ''; for (let x = 0; x < n; x++) r += d[y * n + x] ? '1' : '0'; wiersze.push(r); }
    return { rozmiar: n, wiersze };
}

/** HTML (plik na dysku) → PDF; puppeteer wstrzykiwany z mostu (Chrome ładuje się dopiero tu, nie przy starcie). */
export async function htmlDoPdf(puppeteer, { plikHtml, wyjscie, timeoutMs = 180_000 }) {
    if (!puppeteer) throw new Error('Most nie ma puppeteera (Chrome) — PDF nie powstanie.');
    const przegladarka = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        const strona = await przegladarka.newPage();
        await strona.goto(pathToFileURL(plikHtml).href, { waitUntil: 'load', timeout: timeoutMs });
        await strona.evaluate(() => (document.fonts ? document.fonts.ready : null));
        await strona.pdf({ path: wyjscie, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, timeout: timeoutMs });
    } finally { await przegladarka.close().catch(() => {}); }
    return wyjscie;
}

export default { htmlManuskryptu, htmlPergaminu, rozmiarSvg, sprawdzSvg, macierzQr, htmlDoPdf, esc };
