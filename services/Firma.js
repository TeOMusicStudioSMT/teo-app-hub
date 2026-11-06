/**
 * 🏢 Firma Katedry — Cor-TeO i każdy TeOnauta (Suweren 2026-11-06: „uniwersalny szablon biznesu… Jajo Założyciela…
 * Skarbnik… Mecenas”).
 *
 *  · PROFIL BIZNESU `_OtakOs_Wymiar/firma/profil-biznesu.json` — nazwa, marki, branża, kraj i jurysdykcja podatkowa,
 *    forma, waluta, domeny, dane do Impressum. Brak pliku = profil pusty → 🥚 Jajo Założyciela w WORKPalace prosi o dane.
 *    Każda Katedra ma SWÓJ (plik w `_OtakOs_Wymiar`, nie w paczce).
 *  · 💰 SKARBNIK — przychody i koszty roku z FAKTÓW: opłacone sesje Stripe (`stripe.json` → sprzedaż Mini, wypożyczenia
 *    ksiąg) + wpisy Suwerena w `firma/ksiega-firmy.json` (Shopify, Printful, Meshy… — czego Katedra sama nie widzi).
 *    Próg Kleinunternehmera (§ 19 UStG, od 2025): obrót z POPRZEDNIEGO roku ≤ 25 000 EUR i BIEŻĄCEGO ≤ 100 000 EUR
 *    (progi w profilu — do zmiany). Kwoty w innych walutach liczone osobno, nie przeliczane po cichu.
 *  · ⚖️ MECENAS — SZKICE Impressum (§ 5 DDG), Datenschutzerklärung (DSGVO) i AGB z danych profilu, de/en,
 *    z nagłówkiem „ENTWURF — vor Veröffentlichung prüfen lassen”. Braki danych wypisane wprost; nic nie publikuje.
 *    To nie jest porada prawna — wiąże sprawdzenie przez Steuerberatera/prawnika.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const PROGI_KLEINUNTERNEHMER = { poprzedniRok: 25_000, biezacyRok: 100_000 };
const t = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const lista = (v, n, m) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((x) => t(x, m)).filter(Boolean).slice(0, n);
const domena = (d) => t(d, 80).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

/** Cor-TeO — profil głównego węzła (Suweren 2026-11-06); dane osobowe do Impressum wpisuje Suweren sam. */
export const PROFIL_COR_TEO = {
    nazwa: 'Cor-TeO', marki: ['0.00G Style', 'teostory.studio'], branza: 'Moda (POD), muzyka, opowieści i gry — studio twórcze AI',
    kraj: 'DE', jurysdykcja: 'DE-NRW', forma: 'Einzelunternehmen', kleinunternehmer: true, waluta: 'EUR',
    domeny: ['teo.center', 'teostory.studio', 'otakos.wtf', 'qr.teo.center'],
    wlasciciel: '', adres: { ulica: '', kod: '', miasto: '', kraj: 'Deutschland' }, email: '', telefon: '',
    progi: { ...PROGI_KLEINUNTERNEHMER },
};

export function oczyscProfil(p = {}) {
    const a = p.adres ?? {};
    const prog = (v, d) => { const n = Math.round(Number(v)); return n > 0 && n <= 10_000_000 ? n : d; };
    const email = t(p.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail wygląda niepoprawnie.');
    return {
        nazwa: t(p.nazwa, 80), marki: lista(p.marki, 12, 60), branza: t(p.branza, 160),
        kraj: t(p.kraj, 40).toUpperCase(), jurysdykcja: t(p.jurysdykcja, 40), forma: t(p.forma, 60),
        kleinunternehmer: p.kleinunternehmer === true, waluta: (t(p.waluta, 3).toUpperCase() || 'EUR'),
        domeny: lista(p.domeny, 12, 80).map(domena).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)),
        wlasciciel: t(p.wlasciciel, 80), adres: { ulica: t(a.ulica, 80), kod: t(a.kod, 12), miasto: t(a.miasto, 60), kraj: t(a.kraj, 40) },
        email, telefon: t(p.telefon, 30),
        uslugi: Array.isArray(p.uslugi) ? [...new Set(p.uslugi.map(String))].filter((id) => USLUGI_ZEWNETRZNE[id]) : Object.keys(USLUGI_ZEWNETRZNE),
        progi: { poprzedniRok: prog(p.progi?.poprzedniRok, PROGI_KLEINUNTERNEHMER.poprzedniRok), biezacyRok: prog(p.progi?.biezacyRok, PROGI_KLEINUNTERNEHMER.biezacyRok) },
    };
}

/** Stan progu: ok / blisko (≥ 80%) / przekroczony. */
export function stanProgu(kwota, prog) { const u = prog > 0 ? kwota / prog : 0; return { kwota: Math.round(kwota * 100) / 100, prog, procent: Math.round(u * 1000) / 10, stan: u > 1 ? 'przekroczony' : u >= 0.8 ? 'blisko' : 'ok' }; }

/** Suma pozycji roku w walucie profilu + osobno inne waluty. */
export function podsumujRok(pozycje, rok, waluta) {
    const w = { przychody: 0, koszty: 0, inneWaluty: {} };
    for (const p of pozycje) {
        if (String(p.data ?? '').slice(0, 4) !== String(rok)) continue;
        const k = Number(p.kwota) || 0;
        if (String(p.waluta ?? waluta).toUpperCase() !== waluta) { const kl = `${p.waluta} ${p.rodzaj}`; w.inneWaluty[kl] = Math.round(((w.inneWaluty[kl] ?? 0) + k) * 100) / 100; continue; }
        if (p.rodzaj === 'koszt') w.koszty += k; else w.przychody += k;
    }
    w.przychody = Math.round(w.przychody * 100) / 100; w.koszty = Math.round(w.koszty * 100) / 100;
    return w;
}

export const WHITEPAPER = 'docs/whitepaper-grv.md';

export function utworzFirme({ katalog, sprzedazStripe = async () => [], teraz = () => Date.now(), whitepaper = new URL('../' + WHITEPAPER, import.meta.url) }) {
    const KAT = path.join(katalog, 'firma'), PROFIL = path.join(KAT, 'profil-biznesu.json'), KSIEGA = path.join(KAT, 'ksiega-firmy.json'), PRAWO = path.join(KAT, 'prawo');
    const czytajJson = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
    const zapisz = async (p, d) => { await fs.mkdir(path.dirname(p), { recursive: true }); const tmp = `${p}.${process.pid}.tmp`; await fs.writeFile(tmp, JSON.stringify(d, null, 2), 'utf8'); await fs.rename(tmp, p); };

    async function profil() { const p = await czytajJson(PROFIL, null); return p ? { ...oczyscProfil(p), zalozony: true, kiedy: p.kiedy ?? null } : { ...oczyscProfil({}), zalozony: false }; }
    async function ustawProfil(dane) {
        const p = oczyscProfil(dane);
        if (p.nazwa.length < 2) throw new Error('Podaj nazwę firmy (2–80 znaków).');
        if (!/^[A-Z]{2}$/.test(p.kraj)) throw new Error('Kraj podatków: dwuliterowy kod (np. DE, PL).');
        await zapisz(PROFIL, { ...p, kiedy: new Date(teraz()).toISOString() });
        return profil();
    }

    // ── 💰 Skarbnik ──
    const ksiega = async () => (await czytajJson(KSIEGA, { pozycje: [] })).pozycje ?? [];
    async function dodajPozycje({ data, rodzaj, kwota, waluta, opis, zrodlo }) {
        const k = Math.round(Number(kwota) * 100) / 100;
        if (!(k > 0) || k > 10_000_000) throw new Error('Kwota: liczba większa od zera.');
        if (!['przychod', 'koszt'].includes(rodzaj)) throw new Error('Rodzaj: przychod albo koszt.');
        const d = t(data, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Data: RRRR-MM-DD.');
        const poz = { id: `p-${crypto.randomBytes(4).toString('hex')}`, data: d, rodzaj, kwota: k, waluta: (t(waluta, 3).toUpperCase() || (await profil()).waluta), opis: t(opis, 160), zrodlo: t(zrodlo, 40) || 'ręcznie', dodano: new Date(teraz()).toISOString() };
        const l = await ksiega(); l.unshift(poz); await zapisz(KSIEGA, { pozycje: l.slice(0, 5000) });
        return poz;
    }
    async function usunPozycje(id) { const l = await ksiega(); const n = l.filter((p) => p.id !== id); if (n.length === l.length) throw new Error('Nie ma takiej pozycji.'); await zapisz(KSIEGA, { pozycje: n }); return { usunieta: id }; }

    async function skarbnik(rok = new Date(teraz()).getUTCFullYear()) {
        const p = await profil(), r = Number(rok) || new Date(teraz()).getUTCFullYear();
        const stripe = (await Promise.resolve().then(sprzedazStripe).catch(() => [])).filter((s) => s.oplacona)
            .map((s) => ({ id: s.sesja, data: String(s.kiedy ?? '').slice(0, 10), rodzaj: 'przychod', kwota: Number(s.kwota) || 0, waluta: String(s.waluta ?? '').toUpperCase(), opis: `Stripe · ${s.rodzaj ?? 'sprzedaż'}${s.pakiet ? ` · ${s.pakiet}` : ''}`, zrodlo: 'stripe' }));
        const reczne = await ksiega(), wszystkie = [...stripe, ...reczne];
        const ten = podsumujRok(wszystkie, r, p.waluta), poprzedni = podsumujRok(wszystkie, r - 1, p.waluta);
        return {
            rok: r, waluta: p.waluta, profil: { nazwa: p.nazwa, kleinunternehmer: p.kleinunternehmer, zalozony: p.zalozony },
            przychody: ten.przychody, koszty: ten.koszty, wynik: Math.round((ten.przychody - ten.koszty) * 100) / 100, inneWaluty: ten.inneWaluty,
            kleinunternehmer: p.kleinunternehmer ? { poprzedniRok: stanProgu(poprzedni.przychody, p.progi.poprzedniRok), biezacyRok: stanProgu(ten.przychody, p.progi.biezacyRok),
                uwaga: 'Liczy się obrót (Gesamtumsatz) — wpisz też przychody spoza Stripe (Shopify, Printful, przelewy). Progi § 19 UStG od 2025; ostatecznie decyduje Steuerberater.' } : null,
            zrodla: { stripe: stripe.filter((s) => s.data.startsWith(String(r))).length, reczne: reczne.filter((s) => s.data.startsWith(String(r))).length,
                brak: ['Shopify (niepodłączony — wpisz wypłaty ręcznie)', 'koszty druku i tokenów chmury (wpisz z faktur)'] },
            pozycje: wszystkie.filter((s) => s.data.startsWith(String(r))).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 300),
        };
    }

    // ── ⚖️ Mecenas — szkice ──
    async function mecenas(dokument, jezyk = 'de') {
        const p = await profil();
        if (!['impressum', 'datenschutz', 'agb'].includes(dokument)) throw new Error('Dokument: impressum, datenschutz albo agb.');
        const j = jezyk === 'en' ? 'en' : 'de';
        const braki = [!p.wlasciciel && 'imię i nazwisko właściciela', !p.adres.ulica && 'ulica', !p.adres.kod && 'kod pocztowy', !p.adres.miasto && 'miasto', !p.email && 'e-mail'].filter(Boolean);
        const tekst = szkic(dokument, j, p);
        const plik = path.join(PRAWO, `${dokument}-${j}.md`);
        await fs.mkdir(PRAWO, { recursive: true }); await fs.writeFile(plik, tekst, 'utf8');
        return { dokument, jezyk: j, tekst, braki, plik: path.relative(katalog, plik).replace(/\\/g, '/') };
    }

    /** 📄 Whitepaper Cor-TeO & GRV — plik w repo (docs/), tylko do odczytu w panelu Mecenasa. */
    async function czytajWhitepaper() {
        const tekst = await fs.readFile(whitepaper, 'utf8').catch(() => null);
        if (tekst === null) throw new Error('Brak pliku ' + WHITEPAPER + ' w tej Katedrze.');
        return { tekst, braki: [], plik: WHITEPAPER };
    }

    return { profil, ustawProfil, skarbnik, dodajPozycje, usunPozycje, mecenas, whitepaper: czytajWhitepaper };
}

const LUKA = (x, j) => x || (j === 'en' ? '[MISSING]' : '[FEHLT]');

/** Usługi zewnętrzne do Datenschutz (Suweren 2026-11-06). Profil wybiera, których używa (`uslugi`). Opisy ogólne — dane podmiotów i podstawy prawne do sprawdzenia przez prawnika. */
export const USLUGI_ZEWNETRZNE = {
    cloudflare: {
        nazwa: 'Cloudflare',
        de: '**Cloudflare** (Cloudflare, Inc., USA): DNS, Content Delivery Network und Tunnel (z. B. für QR-Code-Seiten). Dabei werden IP-Adresse, Zeitpunkt und angefragte Adresse verarbeitet, um die Seiten auszuliefern und vor Angriffen zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Übermittlung in die USA auf Grundlage des EU-US Data Privacy Framework bzw. von Standardvertragsklauseln. [Auftragsverarbeitungsvertrag (DPA) mit Cloudflare prüfen.]',
        en: '**Cloudflare** (Cloudflare, Inc., USA): DNS, content delivery network and tunnel (e.g. for QR code pages). IP address, time and requested address are processed to deliver the pages and protect them from attacks (Art. 6(1)(f) GDPR). Transfers to the USA under the EU-US Data Privacy Framework or standard contractual clauses. [Check the data processing agreement (DPA) with Cloudflare.]',
    },
    stripe: {
        nazwa: 'Stripe',
        de: '**Stripe** (Stripe Payments Europe, Ltd., Irland): Zahlungsabwicklung, z. B. für Ausleihen auf teostory.studio. Ihre Zahlungsdaten gibt Stripe nicht an uns weiter; wir erhalten Betrag, Währung, Zeitpunkt, Zahlungsstatus und Sitzungskennung (Art. 6 Abs. 1 lit. b DSGVO; Aufbewahrung nach Art. 6 Abs. 1 lit. c DSGVO, § 147 AO).',
        en: '**Stripe** (Stripe Payments Europe, Ltd., Ireland): payment processing, e.g. for rentals on teostory.studio. Stripe does not pass your payment card data to us; we receive amount, currency, time, payment status and session id (Art. 6(1)(b) GDPR; retention under Art. 6(1)(c) GDPR and German tax law).',
    },
    shopify: {
        nazwa: 'Shopify',
        de: '**Shopify** (Shopify International Limited, Irland): Betrieb des Online-Shops. Für Bestellungen verarbeitet Shopify Name, Liefer- und Rechnungsadresse, E-Mail, Bestellinhalt und Zahlungsstatus (Art. 6 Abs. 1 lit. b DSGVO). Shopify kann Daten an verbundene Unternehmen in Kanada und den USA übermitteln. [Shop-Cookies und Shopify-Datenschutzhinweis ergänzen.]',
        en: '**Shopify** (Shopify International Limited, Ireland): runs the online shop. For orders Shopify processes name, shipping and billing address, e-mail, order contents and payment status (Art. 6(1)(b) GDPR). Shopify may transfer data to affiliates in Canada and the USA. [Add shop cookies and the Shopify privacy notice.]',
    },
    printful: {
        nazwa: 'Printful / Print-on-Demand',
        de: '**Print-on-Demand-Fertigung und Versand** (z. B. Printful): Zur Herstellung und Lieferung erhält der Dienstleister Name, Lieferadresse, ggf. Telefonnummer und Bestellinhalt (Art. 6 Abs. 1 lit. b DSGVO). [Anbieter, Sitz und Produktionsstandort ergänzen.]',
        en: '**Print-on-demand production and shipping** (e.g. Printful): to produce and deliver your order the provider receives name, shipping address, phone number if given, and order contents (Art. 6(1)(b) GDPR). [Add provider, registered office and production location.]',
    },
    youtube: {
        nazwa: 'YouTube / Google',
        de: '**YouTube** (Google Ireland Limited, Irland): Wir veröffentlichen Videos über die YouTube-API und betten Videos auf unseren Seiten ein. Beim Abspielen eingebetteter Videos verarbeitet Google u. a. Ihre IP-Adresse und kann Cookies setzen; Übermittlung in die USA möglich (Art. 6 Abs. 1 lit. f DSGVO bzw. Einwilligung, falls abgefragt). [Prüfen: erweiterter Datenschutzmodus (youtube-nocookie.com) oder Zwei-Klick-Lösung.]',
        en: '**YouTube** (Google Ireland Limited, Ireland): we publish videos via the YouTube API and embed videos on our pages. When an embedded video plays, Google processes your IP address among other data and may set cookies; transfers to the USA are possible (Art. 6(1)(f) GDPR or consent where requested). [Check: privacy-enhanced mode (youtube-nocookie.com) or a two-click solution.]',
    },
};
const USLUGI_IDS = Object.keys(USLUGI_ZEWNETRZNE);

function datenschutz(de, p, adres) {
    const j = de ? 'de' : 'en';
    const kontakt = `${de ? 'E-Mail' : 'E-mail'}: ${LUKA(p.email, j)}${p.telefon ? `\n${de ? 'Telefon' : 'Phone'}: ${p.telefon}` : ''}`;
    const uslugi = (p.uslugi ?? USLUGI_IDS).filter((id) => USLUGI_ZEWNETRZNE[id]).map((id) => `- ${USLUGI_ZEWNETRZNE[id][j]}`);
    const domeny = p.domeny.join(', ') || (de ? '[Domains]' : '[domains]');
    if (de) return `# Datenschutzerklärung\n\n## 1. Verantwortlicher\n${p.nazwa}\n${adres}\n${kontakt}\n\n## 2. Welche Daten wir selbst verarbeiten\n- **Tanz-Codes (QR)**: Code, gewählte Figur, Aufnahme Ihres privaten Tanzes; IP-Adresse kurzzeitig zur Missbrauchsbremse (Art. 6 Abs. 1 lit. f DSGVO).\n- **Server**: ${domeny} — Zugriffsprotokolle beim jeweiligen Hoster (eigene Hardware über den Cloudflare-Tunnel, ggf. Cloudflare Workers oder Google Cloud) [Hoster je Domain prüfen].\n\n## 3. Externe Dienste\n${uslugi.length ? uslugi.join('\n') : '[Keine externen Dienste angegeben — prüfen.]'}\n\n## 4. Speicherdauer\nSolange für den Zweck nötig bzw. gesetzliche Aufbewahrungspflichten (z. B. § 147 AO).\n\n## 5. Ihre Rechte\nAuskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch (Art. 15–21 DSGVO); Beschwerde bei einer Aufsichtsbehörde${p.jurysdykcja.startsWith('DE-NRW') ? ' (in NRW: LDI NRW)' : ''}.\n\n## 6. Cookies\n[Prüfen: Setzen Ihre Seiten Cookies oder Tracking (auch durch Shopify oder YouTube)? Wenn ja, hier ergänzen und ggf. Einwilligung einholen.]\n`;
    return `# Privacy policy\n\n## 1. Controller\n${p.nazwa}\n${adres}\n${kontakt}\n\n## 2. Data we process ourselves\n- **Dance codes (QR)**: the code, chosen dancer, recording of your private dance; IP address briefly for abuse limiting (Art. 6(1)(f) GDPR).\n- **Servers**: ${domeny} — access logs at the respective host (own hardware behind the Cloudflare tunnel, possibly Cloudflare Workers or Google Cloud) [check the host per domain].\n\n## 3. External services\n${uslugi.length ? uslugi.join('\n') : '[No external services listed — check.]'}\n\n## 4. Retention\nAs long as needed for the purpose or required by law.\n\n## 5. Your rights\nAccess, rectification, erasure, restriction, portability, objection (Art. 15–21 GDPR); complaint to a supervisory authority.\n\n## 6. Cookies\n[Check: do your pages set cookies or tracking (including via Shopify or YouTube)? If so, add them here and obtain consent where required.]\n`;
}
/** Szkice dokumentów — czyste, z profilu. Wszystko oznaczone jako ENTWURF/DRAFT. */
export function szkic(dokument, j, p) {
    const de = j === 'de';
    const naglowek = de ? '> **ENTWURF** — automatisch aus dem Firmenprofil erstellt. Vor Veröffentlichung von Steuerberater/Anwalt prüfen lassen. Keine Rechtsberatung.\n\n'
        : '> **DRAFT** — generated from the business profile. Have it reviewed by a lawyer/tax advisor before publishing. Not legal advice.\n\n';
    const adres = `${LUKA(p.wlasciciel, j)}\n${LUKA(p.adres.ulica, j)}\n${LUKA(p.adres.kod, j)} ${LUKA(p.adres.miasto, j)}\n${p.adres.kraj || ''}`.trim();
    const klein = p.kleinunternehmer ? (de ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).' : 'No VAT is charged under the small-business rule (§ 19 UStG).') : '';
    if (dokument === 'impressum') return naglowek + (de
        ? `# Impressum\n\nAngaben gemäß § 5 DDG\n\n${p.nazwa}${p.marki.length ? ` (Marken: ${p.marki.join(', ')})` : ''}\n${adres}\n\n**Kontakt**\nE-Mail: ${LUKA(p.email, j)}${p.telefon ? `\nTelefon: ${p.telefon}` : ''}\n\n${p.forma ? `Rechtsform: ${p.forma}\n\n` : ''}${klein ? `${klein}\n\n` : ''}**Verantwortlich für den Inhalt** (§ 18 Abs. 2 MStV): ${LUKA(p.wlasciciel, j)}, Anschrift wie oben.\n\nDomains: ${p.domeny.join(', ') || '—'}\n\nEU-Streitschlichtung: Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.\n`
        : `# Legal notice (Impressum)\n\nInformation pursuant to § 5 DDG (Germany)\n\n${p.nazwa}${p.marki.length ? ` (brands: ${p.marki.join(', ')})` : ''}\n${adres}\n\n**Contact**\nE-mail: ${LUKA(p.email, j)}${p.telefon ? `\nPhone: ${p.telefon}` : ''}\n\n${p.forma ? `Legal form: ${p.forma}\n\n` : ''}${klein ? `${klein}\n\n` : ''}**Responsible for content** (§ 18 (2) MStV): ${LUKA(p.wlasciciel, j)}, address as above.\n\nDomains: ${p.domeny.join(', ') || '—'}\n`);
    if (dokument === 'datenschutz') return naglowek + datenschutz(de, p, adres);
    return naglowek + (de
        ? `# Allgemeine Geschäftsbedingungen (AGB)\n\n## § 1 Geltungsbereich\nDiese AGB gelten für Bestellungen bei ${p.nazwa}${p.marki.length ? ` (${p.marki.join(', ')})` : ''} über ${p.domeny.join(', ') || '[Shop-Domain]'}.\n\n## § 2 Vertragsschluss\nDie Darstellung der Produkte ist kein bindendes Angebot. Mit Absenden der Bestellung geben Sie ein Angebot ab; der Vertrag kommt mit unserer Bestätigung zustande.\n\n## § 3 Preise\nAlle Preise in ${p.waluta}. ${klein}\n\n## § 4 Herstellung auf Bestellung\nProdukte werden nach Bestellung gefertigt (Print-on-Demand). [Lieferzeiten und Versandkosten je Produkt ergänzen.]\n\n## § 5 Widerrufsrecht\n[Hier die gesetzliche Widerrufsbelehrung nach Muster (Anlage 1 zu Art. 246a § 1 EGBGB) einfügen. Hinweis: Für nach Kundenspezifikation angefertigte Waren kann das Widerrufsrecht ausgeschlossen sein (§ 312g Abs. 2 Nr. 1 BGB) — prüfen lassen.]\n\n## § 6 Digitale Zugaben (Tanz-Code, GRV-Bonus)\nDer Tanz-Code ist einmalig nutzbar. GRV sind Spielpunkte des OtakOS-Ökosystems ohne Geldwert und ohne Auszahlungsanspruch.\n\n## § 7 Gewährleistung\nEs gelten die gesetzlichen Mängelrechte.\n`
        : `# Terms and conditions\n\n## 1 Scope\nThese terms apply to orders from ${p.nazwa}${p.marki.length ? ` (${p.marki.join(', ')})` : ''} via ${p.domeny.join(', ') || '[shop domain]'}.\n\n## 2 Contract\nProduct listings are not a binding offer. Your order is an offer; the contract is formed with our confirmation.\n\n## 3 Prices\nAll prices in ${p.waluta}. ${klein}\n\n## 4 Made to order\nProducts are produced after ordering (print on demand). [Add delivery times and shipping costs.]\n\n## 5 Right of withdrawal\n[Insert the statutory withdrawal notice. Note: goods made to customer specification may be excluded — have this checked.]\n\n## 6 Digital extras (dance code, GRV bonus)\nThe dance code is single-use. GRV are points of the OtakOS ecosystem with no monetary value and no payout.\n\n## 7 Warranty\nStatutory warranty rights apply.\n`);
}

/** Trasy (Straż `/api/firma`: tylko maszyna). */
export function zamontujTrasyFirmy(app, F) {
    const odp = (res, p) => p.then((d) => res.json({ success: true, ...d })).catch((e) => res.status(400).json({ success: false, message: e.message }));
    app.get('/api/firma/profil', (_q, res) => odp(res, F.profil().then((profil) => ({ profil }))));
    app.put('/api/firma/profil', (req, res) => odp(res, F.ustawProfil(req.body ?? {}).then((profil) => ({ profil }))));
    app.get('/api/firma/skarbnik', (req, res) => odp(res, F.skarbnik(req.query.rok)));
    app.post('/api/firma/ksiega', (req, res) => odp(res, F.dodajPozycje(req.body ?? {}).then((pozycja) => ({ pozycja }))));
    app.delete('/api/firma/ksiega/:id', (req, res) => odp(res, F.usunPozycje(req.params.id)));
    app.get('/api/firma/whitepaper', (_q, res) => odp(res, F.whitepaper()));
    app.post('/api/firma/mecenas', (req, res) => odp(res, F.mecenas(String(req.body?.dokument ?? ''), String(req.body?.jezyk ?? 'de'))));
}

export default { utworzFirme, zamontujTrasyFirmy, oczyscProfil, podsumujRok, stanProgu, szkic, PROFIL_COR_TEO, PROGI_KLEINUNTERNEHMER };
