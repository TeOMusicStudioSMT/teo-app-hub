/**
 * 🛍️ Stół Produktowy — gotowe produkty TeO Fashion Studio po QC szwalni, rozdzielone na dwóch odbiorców:
 * A) sklep Shopify (makiety, tytuł, opis, cena, rozmiary — produkt FIZYCZNY), B) drukarnia (pliki 300 DPI + wymiary w cm).
 * „📂 Wyślij” = `_OtakOs_Wymiar/sklep-shopify/<postać>/<model>/{1-DO-SKLEPU-SHOPIFY, 2-DO-DRUKARNI-300DPI}` + shopify-import.csv.
 * Most: services/StolProduktowy.js. Nic nie idzie do sklepu samo — import robisz w panelu Shopify.
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';

interface Strefa { strefa: string; szer?: number; wys?: number; plik: string }
interface Produkt { postac: string; model: string; tytul: string; opisHtml: string; typ: string; tagi: string; dostawca: string; cenaEur: number | null;
    makiety: string[]; druk: Strefa[]; wymiary: boolean; gotowy: boolean; braki: string[]; wyslany: boolean }
interface Postac { postac: string; gotowe: number; wszystkie: number; wyslane: number; produkty: Produkt[] }
interface Sezon { id: string; emoji: string; nazwa: string; tag: string; fasony: string[] | null; okno: { od: string; do: string; dniDoStartu: number } | null;
    produktow: number; zTekstem: number; rabat: number | null; csv: string | null; przyklad: { model: string; tytul: string; opis: string } | null }
interface Wynik { usuniete?: string[]; fashionBlad?: string | null; wyslane: { model: string; zdjec: number; plikowDruku: number }[]; pominiete: { model: string; powod: string }[]; csv: { plik: string; produktow: number; wariantow: number }; cel: string }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    let r: Response;
    try { r = await fetch(`${MOST}${sciezka}`, { ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined }); }
    catch { throw new Error('Most (127.0.0.1:3001) milczy — odpal Katedrę.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.success === false) throw new Error(d?.message || `Most odpowiedział HTTP ${r.status}`);
    return d as T;
}
const plik = (x: Produkt, p: string) => `${MOST}/api/stol-produktowy/plik/${x.postac}/${x.model}/${p}`;
const bezHtml = (h: string) => h.replace(/<\/p>\s*/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();

interface BsProdukt { klucz: string; tytul: string; katalogId: number; aop: boolean; wariantow: number; uwaga: string | null; zdjecia?: string[] }
interface Bs { postac: string; imie: string; kiedy: string; zrodloWymiarow: Record<string, string>; produkty: BsProdukt[] }
interface ZadaniePF { stan: string; krok: string | null; zrobione: { produkt: string; wariant: string; cena: number }[]; pominiete: { produkt: string; wariant: string; powod: string }[]; bledy: { produkt: string; wariant: string; powod: string }[]; powod?: string }
interface StanPF { polaczony: boolean; powod?: string; sklep: { id: number; nazwa: string; typ?: string } | null; sklepy?: { id: number; nazwa: string; typ: string }[]; zadanie: ZadaniePF | null; mockupy?: { stan: string; krok: string | null; zrobione: { produkt: string; mockupow: number }[]; pominiete: unknown[]; bledy: { produkt: string; powod: string }[]; powod?: string } | null }

/** 🖨️ Bestsellery Printful (rysuje TeO Fashion Studio → 3-BESTSELLERY-PRINTFUL-I-ALL-OVER), 🏷️ marka i 🔄 synchronizacja wariantów z Printful. */
function PrintfulPanel() {
    const [bs, setBs] = useState<{ bestsellery: Bs[]; brand: string[] } | null>(null);
    const [pf, setPf] = useState<StanPF | null>(null);
    const [produkty, setProdukty] = useState<{ produkty: { id: number; nazwa: string; wariantow: number; zsynchronizowanych: number }[]; katedra: { wariantow: number; produktow: number } } | null>(null);
    const [token, setToken] = useState('');
    const [blad, setBlad] = useState('');
    const odswiez = useCallback(async () => {
        try { setBs(await zMostu('/api/stol-produktowy/bestsellery')); } catch (e) { setBlad((e as Error).message); }
        try { const s = await zMostu<StanPF>('/api/printful/stan'); setPf(s); if (s.polaczony) setProdukty(await zMostu('/api/printful/produkty')); } catch (e) { setBlad((e as Error).message); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);
    useEffect(() => {
        if (pf?.zadanie?.stan !== 'robi' && pf?.mockupy?.stan !== 'robi') return;
        const t = setInterval(async () => { try { const s = await zMostu<StanPF>('/api/printful/stan'); setPf(s); if (s.zadanie?.stan !== 'robi' && s.polaczony) setProdukty(await zMostu('/api/printful/produkty')); } catch { /* — */ } }, 4000);
        return () => clearInterval(t);
    }, [pf?.zadanie?.stan, pf?.mockupy?.stan]);
    const dzialaj = async (fn: () => Promise<unknown>) => { setBlad(''); try { await fn(); await odswiez(); } catch (e) { setBlad((e as Error).message); } };
    const z = pf?.zadanie;
    return (
        <div className="space-y-2 rounded-xl border border-sky-500/30 bg-black/30 p-2">
            <div className="flex flex-wrap items-center gap-2">
                <b className="text-sky-200">🖨️ Bestsellery Printful i 🔄 synchronizacja</b>
                <button onClick={() => void odswiez()} className="rounded border border-white/20 px-2 py-0.5">↻</button>
                <span className="text-[11px] text-white/50">pliki rysuje TeO Fashion Studio → Kolekcja 360° → „🖨️ Narysuj produkty” (każda postać) i „🏷️ Logo + baner”</span>
            </div>
            {blad && <p className="rounded bg-red-950/50 p-1 text-red-300">⚠ {blad}</p>}
            {bs?.brand.length ? <div className="flex flex-wrap items-center gap-2"><span className="text-white/60">🏷️ sklep-shopify/brand:</span>{bs.brand.map((f) => <a key={f} href={`${MOST}/api/stol-produktowy/bestseller/brand/-/${f}`} target="_blank" rel="noreferrer" title={f}><img src={`${MOST}/api/stol-produktowy/bestseller/brand/-/${f}`} alt={f} className="h-10 rounded bg-white/10 object-contain" /></a>)}</div>
                : <p className="text-white/40">🏷️ Logo i baneru jeszcze nie ma w sklep-shopify/brand.</p>}
            {bs?.bestsellery.map((b) => {
                const dokl = Object.values(b.zrodloWymiarow).filter((x) => x === 'printful').length;
                return (
                    <div key={b.postac} className="rounded bg-black/40 p-1">
                        <div className="flex flex-wrap gap-2"><b className="text-sky-100">{b.imie}</b><span className="text-white/50">{b.produkty.length} produktów · wymiary z Printful {dokl}/{b.produkty.length}{dokl < b.produkty.length ? ' (reszta orientacyjna — po tokenie narysuj ponownie)' : ''} · {b.kiedy.slice(0, 16).replace('T', ' ')}</span></div>
                        <div className="flex gap-1 overflow-x-auto pb-1">
                            {b.produkty.map((p) => (
                                <div key={p.klucz} className="w-24 shrink-0 text-[10px]" title={`${p.tytul} · Printful #${p.katalogId} · ${p.wariantow} war.${p.uwaga ? ` — ${p.uwaga}` : ''}`}>
                                    {p.zdjecia?.[0] ? <img src={`${MOST}/api/stol-produktowy/bestseller/${b.postac}/${p.klucz}/${p.zdjecia[0]}`} alt="" className="aspect-square w-full rounded bg-white/10 object-cover" loading="lazy" /> : <div className="aspect-square w-full rounded bg-white/5" />}
                                    <div className="truncate">{p.aop ? '🌌' : ''}{p.tytul.split(' — ')[1]?.replace(' · 0.00G Style', '') ?? p.klucz}</div>
                                    <div className="flex flex-wrap gap-1">{(p.zdjecia ?? []).map((f) => <a key={f} href={`${MOST}/api/stol-produktowy/bestseller/${b.postac}/${p.klucz}/${f}`} download={`${b.postac}-${p.klucz}-${f}`} className="text-sky-300 underline" title="zdjęcie do Shopify (≤ 20 MB)">{f.startsWith('MOCKUP') ? `📸${f.slice(7, 8)}` : '🖼️'}</a>)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
            {bs && bs.bestsellery.length > 0 && <p className="text-[11px] text-white/60">CSV: <code>sklep-shopify/shopify-import-bestsellery.csv</code> → Shopify → Products → Import (szkice, SKU = klucz synchronizacji). Potem Printful zobaczy je jako „niezsynchronizowane”.</p>}
            <div className="space-y-1 rounded border border-white/10 p-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span>Printful API:</span>
                    {pf?.polaczony ? <span className="text-emerald-300">✓ połączony · sklep {pf.sklep?.nazwa ?? '—'} ({pf.sklep?.typ ?? '?'})</span> : <span className="text-amber-300">{pf?.powod ?? '…'}</span>}
                    {pf?.polaczony && (pf.sklepy?.length ?? 0) > 1 && <select value={pf.sklep?.id ?? ''} onChange={(e) => void dzialaj(() => zMostu('/api/printful/sklep', { method: 'PUT', body: JSON.stringify({ sklep: e.target.value }) }))} className="rounded bg-black/50 px-1">{pf.sklepy!.map((s) => <option key={s.id} value={s.id}>{s.nazwa} ({s.typ})</option>)}</select>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={pf?.polaczony ? 'nowy token (zastąpi stary)' : 'PRINTFUL_API_TOKEN z developers.printful.com'} className="w-72 rounded bg-black/50 px-1 py-0.5" autoComplete="off" />
                    <button disabled={!token.trim()} onClick={() => void dzialaj(async () => { await zMostu('/api/printful/token', { method: 'PUT', body: JSON.stringify({ token: token.trim() }) }); setToken(''); })} className="rounded border border-sky-500/50 px-2 disabled:opacity-40">🔐 Zapisz w Skarbcu</button>
                    {pf?.polaczony && <button onClick={() => { if (confirm('Usunąć token Printful ze Skarbca?')) void dzialaj(() => zMostu('/api/printful/token', { method: 'PUT', body: JSON.stringify({ token: null }) })); }} className="rounded border border-white/20 px-2">✕</button>}
                </div>
                {produkty && <>
                    <div className="text-[11px] text-white/60">Produkty w Printful: {produkty.produkty.length} · niezsynchronizowane: {produkty.produkty.filter((p) => p.zsynchronizowanych < p.wariantow).length} · Katedra zna {produkty.katedra.wariantow} wariantów ({produkty.katedra.produktow} produktów) po SKU</div>
                    <div className="max-h-32 overflow-y-auto">
                        {produkty.produkty.map((p) => <div key={p.id} className="flex items-center gap-2 border-b border-white/5 py-0.5"><span className="truncate">{p.nazwa}</span><span className={`ml-auto ${p.zsynchronizowanych < p.wariantow ? 'text-amber-300' : 'text-emerald-300'}`}>{p.zsynchronizowanych}/{p.wariantow}</span>
                            <button disabled={z?.stan === 'robi'} onClick={() => void dzialaj(() => zMostu('/api/printful/synchronizuj', { method: 'POST', body: JSON.stringify({ produkt: p.id }) }))} className="rounded border border-white/20 px-1 disabled:opacity-40" title="Pliki, wariant katalogu i cenę wyśle tylko wariantom ze SKU Katedry">🔄</button></div>)}
                    </div>
                    <button disabled={z?.stan === 'robi'} onClick={() => void dzialaj(() => zMostu('/api/printful/synchronizuj', { method: 'POST', body: '{}' }))} className="rounded bg-sky-500 px-3 py-1 font-bold text-black disabled:opacity-40">🔄 Synchronizuj wszystkie niezsynchronizowane (po SKU Katedry)</button>
                </>}
                {pf?.polaczony && <div className="flex flex-wrap items-center gap-2">
                    <button disabled={pf.mockupy?.stan === 'robi'} onClick={() => void dzialaj(() => zMostu('/api/printful/mockupy', { method: 'POST', body: '{}' }))} className="rounded border border-sky-500/50 px-2 py-0.5 disabled:opacity-40" title="Printful Mockup Generator składa zdjęcia produktów z naszymi plikami; JPG-i lądują obok (📸) — do wgrania w Shopify (limit 20 MB)">📸 Mockupy Printful (nowe produkty)</button>
                    <button disabled={pf.mockupy?.stan === 'robi'} onClick={() => { if (confirm('Wygenerować mockupy od nowa dla WSZYSTKICH bestsellerów?')) void dzialaj(() => zMostu('/api/printful/mockupy', { method: 'POST', body: JSON.stringify({ wymus: true }) })); }} className="rounded border border-white/20 px-2 py-0.5 disabled:opacity-40">↻ wszystkie</button>
                    <span className="text-[10px] text-white/50">🖼️ = ZDJECIE-SKLEP.jpg (z pliku druku, od razu), 📸 = mockup Printful — oba ≤ 20 MB, do „Multimedia” w Shopify. Pliki druku (PNG) idą tylko do Printful.</span>
                    {pf.mockupy && <span className={`text-[11px] ${pf.mockupy.stan === 'blad' ? 'text-red-300' : 'text-sky-200'}`}>{pf.mockupy.stan === 'robi' ? `⏳ ${pf.mockupy.krok ?? ''}` : pf.mockupy.stan === 'blad' ? `⚠ ${pf.mockupy.powod}` : '✓ mockupy gotowe'} · {pf.mockupy.zrobione.length} prod. · błędy {pf.mockupy.bledy.length}{pf.mockupy.bledy[0] ? ` (${pf.mockupy.bledy[0].produkt}: ${pf.mockupy.bledy[0].powod})` : ''}</span>}
                </div>}
                {z && <div className={`rounded p-1 text-[11px] ${z.stan === 'blad' ? 'bg-red-950/40 text-red-300' : 'bg-sky-950/40'}`}>
                    {z.stan === 'robi' ? `⏳ ${z.krok ?? ''}` : z.stan === 'blad' ? `⚠ ${z.powod}` : '✓ gotowe'} · wysłane {z.zrobione.length} · pominięte {z.pominiete.length} · błędy {z.bledy.length}
                    {z.bledy.slice(0, 4).map((b, i) => <div key={i} className="text-red-300">✗ {b.produkt} / {b.wariant}: {b.powod}</div>)}
                    {z.pominiete.slice(0, 3).map((b, i) => <div key={i} className="text-white/50">— {b.produkt} / {b.wariant}: {b.powod}</div>)}
                </div>}
                <p className="text-[10px] text-white/40">Printful nie zakłada przez API produktów w sklepie Shopify — zakłada je import CSV; tu każdy wariant dostaje produkt z katalogu, pliki (Printful pobiera je przez tunel Katedry, link 72 h) i cenę detaliczną w Printful. Cenę w Shopify ustawia CSV albo Ty w Shopify.</p>
            </div>
        </div>
    );
}

export function StolProduktowy() {
    const [dane, setDane] = useState<{ postacie: Postac[]; cel: string; csv: string | null; sklep?: { domena: string | null; produkty?: Record<string, string>; wSklepie?: number; powod?: string } } | null>(null);
    const [domena, setDomena] = useState('');
    const [wybrany, setWybrany] = useState<Produkt | null>(null);
    const [praca, setPraca] = useState('');
    const [blad, setBlad] = useState('');
    const [wynik, setWynik] = useState<Wynik | null>(null);
    const [skopiowane, setSkopiowane] = useState('');
    const [sezony, setSezony] = useState<Sezon[]>([]);
    const [rabat, setRabat] = useState(20);
    const [sezonInfo, setSezonInfo] = useState('');
    const odswiezSezony = useCallback(async () => { try { setSezony((await zMostu<{ sezony: Sezon[] }>('/api/stol-produktowy/sezonowe')).sezony); } catch { /* most bez dropów */ } }, []);
    useEffect(() => { void odswiezSezony(); }, [odswiezSezony]);
    const drop = async (id: string, odNowa = false) => {
        setPraca(id === 'black-friday' ? 'liczę ceny Black Friday…' : 'Kronikarz pisze edycję sezonową (model — może potrwać kilka minut)…'); setBlad(''); setSezonInfo('');
        try {
            const w = await zMostu<{ plik: string; produktow: number; bezTekstu: string[]; rabat?: number }>(`/api/stol-produktowy/sezonowe/${id}`, { method: 'POST', body: JSON.stringify({ rabat, odNowa }) });
            setSezonInfo(`✓ ${w.plik}: ${w.produktow} produktów${w.rabat ? ` (−${w.rabat} %)` : ''}${w.bezTekstu.length ? ` · bez edycji: ${w.bezTekstu.length}` : ''}`);
            await odswiezSezony();
        } catch (e) { setBlad((e as Error).message); } finally { setPraca(''); }
    };
    const odswiezWszystko = async () => {
        setPraca('Fashion buduje paczki z żywych kolekcji, potem sklep-shopify i CSV…'); setBlad('');
        try { setWynik(await zMostu<Wynik>('/api/stol-produktowy/odswiez', { method: 'POST', body: '{}' })); await odswiez(); await odswiezSezony(); }
        catch (e) { setBlad((e as Error).message); } finally { setPraca(''); }
    };

    const odswiez = useCallback(async () => {
        try {
            const d = await zMostu<{ postacie: Postac[]; cel: string; csv: string | null; sklep?: { domena: string | null } }>('/api/stol-produktowy');
            setDomena((x) => x || d.sklep?.domena || '');
            setDane(d); setBlad('');
            setWybrany((w) => (w ? d.postacie.flatMap((p) => p.produkty).find((x) => x.model === w.model) ?? null : null));
        } catch (e) { setBlad((e as Error).message); }
    }, []);
    useEffect(() => { void odswiez(); }, [odswiez]);

    const wyslij = async (body: { postac?: string; model?: string }, opis: string) => {
        setPraca(opis); setBlad('');
        try { setWynik(await zMostu<Wynik>('/api/stol-produktowy/wyslij', { method: 'POST', body: JSON.stringify(body) })); await odswiez(); }
        catch (e) { setBlad((e as Error).message); } finally { setPraca(''); }
    };
    const kopiuj = async (co: string, tekst: string) => { try { await navigator.clipboard.writeText(tekst); setSkopiowane(co); setTimeout(() => setSkopiowane(''), 1500); } catch { setBlad('Schowek niedostępny — zaznacz tekst ręcznie.'); } };

    return (
        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-black/30 p-3 text-xs text-white">
            <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm text-amber-200">🛍️ Stół Produktowy — Fashion → sklep i drukarnia</b>
                <button onClick={() => void odswiez()} className="rounded border border-white/20 px-2 py-0.5">↻</button>
                <button disabled={!!praca} onClick={() => void odswiezWszystko()} title="Fashion buduje paczki tylko z żywych kolekcji (usunięte wypadają, nowe dochodzą), potem sklep-shopify i CSV od nowa"
                    className="ml-auto rounded bg-amber-500 px-3 py-1 font-bold text-black disabled:opacity-40">🔄 Odśwież i wyślij wszystko</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                🌐 Adres sklepu: <input value={domena} onChange={(e) => setDomena(e.target.value)} placeholder="np. te0shop-2w.myshopify.com" className="w-64 rounded bg-black/50 px-1 py-0.5" />
                <button disabled={!!praca} onClick={async () => { setBlad(''); try { await zMostu('/api/stol-produktowy/ustawienia', { method: 'PUT', body: JSON.stringify({ domena: domena.trim() || null }) }); await zMostu('/api/stol-produktowy/status-sklepu', { method: 'POST', body: '{}' }); await odswiez(); } catch (e) { setBlad((e as Error).message); } }} className="rounded border border-white/20 px-2">💾 zapisz i sprawdź</button>
                <span className="text-white/50">{dane?.sklep?.domena ? `w sklepie publicznie: ${dane.sklep.wSklepie ?? 0} — tylko te dostają link na teo.center` : 'bez adresu teo.center pokazuje produkty bez linku'}</span>
            </div>
            {dane && <p className="text-[11px] text-white/50">Cel: <code>{dane.cel}</code>{dane.csv && <> · ✓ <code>shopify-import.csv</code> gotowy (Shopify → Products → Import)</>}</p>}
            {praca && <p className="text-amber-200">⏳ {praca}</p>}
            {blad && <p className="rounded bg-red-950/50 p-2 text-red-300">⚠ {blad}</p>}
            {wynik && (
                <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-2">
                    {wynik.fashionBlad && <div className="text-amber-300">⚠ {wynik.fashionBlad}</div>}
                    {wynik.usuniete && wynik.usuniete.length > 0 && <div className="text-amber-200">🗑 Usunięte z sklep-shopify (kolekcji już nie ma): {wynik.usuniete.join(', ')}</div>}
                    ✓ Wysłano {wynik.wyslane.length} produkt(ów): {wynik.wyslane.reduce((s, x) => s + x.zdjec, 0)} makiet do sklepu, {wynik.wyslane.reduce((s, x) => s + x.plikowDruku, 0)} plików druku.
                    CSV: {wynik.csv.produktow} produktów ({wynik.csv.wariantow} wariantów S–XXL) → <code>{wynik.csv.plik}</code>.
                    {wynik.pominiete.length > 0 && <div className="text-amber-300">Pominięte: {wynik.pominiete.map((p) => `${p.model} (${p.powod})`).join('; ')}</div>}
                    <div className="mt-1 text-white/60">W Shopify: Products → Import → wybierz <code>shopify-import.csv</code>. Produkty wejdą jako SZKICE (fizyczne, wymagają wysyłki) bez zdjęć — zdjęcia dodaj z folderów 1-DO-SKLEPU-SHOPIFY, potem ustaw „Active”.</div>
                </div>
            )}

            {dane?.postacie.map((p) => (
                <div key={p.postac} className="space-y-1">
                    <div className="flex items-center gap-2">
                        <b className="capitalize text-amber-100">{p.postac}</b>
                        <span className={p.gotowe === p.wszystkie ? 'text-emerald-300' : 'text-amber-300'}>QC {p.gotowe}/{p.wszystkie}</span>
                        <span className="text-white/40">wysłane {p.wyslane}/{p.wszystkie}</span>
                        <button disabled={!!praca} onClick={() => void wyslij({ postac: p.postac }, `wysyłam kolekcję ${p.postac}…`)} className="ml-auto rounded border border-amber-500/50 px-2 py-0.5">📂 Wyślij kolekcję</button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {p.produkty.map((x) => (
                            <button key={x.model} onClick={() => setWybrany(x)} className={`w-28 shrink-0 rounded-lg border p-1 text-left ${wybrany?.model === x.model ? 'border-amber-400 bg-amber-900/30' : 'border-white/10 bg-black/40'}`}>
                                {x.makiety[0] ? <img src={plik(x, x.makiety[0])} alt="" className="aspect-square w-full rounded object-cover" loading="lazy" /> : <div className="aspect-square w-full rounded bg-white/5" />}
                                <div className="mt-1 truncate text-[10px]">{x.typ}</div>
                                <div className="text-[10px] text-white/60">{x.cenaEur != null ? `${x.cenaEur} €` : 'bez ceny'} {x.gotowy ? '✓' : '⚠'} {x.wyslany ? '📂' : ''} {dane?.sklep?.produkty?.[x.model] === 'w-sklepie' ? '🛍️' : ''}</div>
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            {sezony.length > 0 && (
                <div className="space-y-1 rounded-xl border border-fuchsia-500/30 bg-black/30 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <b className="text-fuchsia-200">🗓️ Sezonowe dropy</b>
                        <span className="text-[11px] text-white/50">ta sama grafika, nowa opowieść edycji (Kronikarz) i tagi → osobny CSV w <code>sklep-shopify/sezonowe/</code></span>
                        <label className="ml-auto text-[11px]">🖤 rabat BF <input type="number" min={10} max={50} value={rabat} onChange={(e) => setRabat(Number(e.target.value))} className="w-12 rounded bg-black/50 px-1" /> %</label>
                    </div>
                    {sezonInfo && <div className="text-emerald-300">{sezonInfo}</div>}
                    <div className="grid gap-1 md:grid-cols-2">
                        {sezony.map((z) => (
                            <div key={z.id} className="flex flex-wrap items-center gap-2 rounded bg-black/40 px-2 py-1">
                                <span className="w-28 shrink-0">{z.emoji} {z.nazwa}</span>
                                <span className="text-[10px] text-white/50">{z.okno ? (z.okno.dniDoStartu > 0 ? `za ${z.okno.dniDoStartu} dni (${z.okno.od})` : `trwa do ${z.okno.do}`) : ''} · {z.produktow} prod.{z.id !== 'black-friday' ? ` · edycja ${z.zTekstem}/${z.produktow}` : ''}</span>
                                <span className="ml-auto flex gap-1">
                                    {z.csv && <a href={`${MOST}/api/stol-produktowy/sezonowe/${z.id}/csv`} className="rounded border border-emerald-500/50 px-1" title={z.csv}>⬇ CSV</a>}
                                    <button disabled={!!praca || !z.produktow} onClick={() => void drop(z.id)} className="rounded border border-fuchsia-500/50 px-1 disabled:opacity-40">{z.csv ? '↻' : '✨ Przygotuj'}</button>
                                    {z.id !== 'black-friday' && z.zTekstem > 0 && <button disabled={!!praca} onClick={() => void drop(z.id, true)} title="Kronikarz pisze edycję od nowa" className="rounded border border-white/20 px-1">✍️</button>}
                                </span>
                                {z.przyklad && <div className="w-full truncate text-[10px] text-white/60" title={z.przyklad.opis}>„{z.przyklad.tytul}” — {z.przyklad.opis}</div>}
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-white/40">Black Friday = te same produkty z ceną przekreśloną (import z „nadpisz istniejące”); po promocji zaimportuj z nadpisaniem shopify-import.csv. Tagi „…_Drop” → kolekcja automatyczna w Shopify.</p>
                </div>
            )}

            <PrintfulPanel />

            {wybrany && (
                <div className="grid gap-3 rounded-xl border border-white/10 bg-black/40 p-3 md:grid-cols-2">
                    <div className="space-y-1 md:col-span-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <b className="text-sm">{wybrany.tytul}</b>
                            {!wybrany.gotowy && <span className="text-amber-300">brakuje: {wybrany.braki.join(', ')}</span>}
                            <button disabled={!!praca || !wybrany.gotowy} onClick={() => void wyslij({ postac: wybrany.postac, model: wybrany.model }, 'wysyłam produkt…')}
                                className="ml-auto rounded bg-amber-500 px-3 py-1 font-bold text-black disabled:opacity-40">📂 Wyślij ten produkt do sklep-shopify</button>
                        </div>
                    </div>
                    <div className="space-y-2 rounded-lg border border-emerald-500/30 p-2">
                        <b className="text-emerald-300">A) Do sklepu Shopify — dla klienta</b>
                        <p className="rounded bg-emerald-950/40 p-1 text-[11px]">📦 To <b>produkt fizyczny</b>: w Shopify zaznacz „This is a physical product” (wymaga wysyłki). <b>Nie</b> „Digital product” — klient dostaje ubranie, nie pliki.</p>
                        <div className="grid grid-cols-2 gap-1">{wybrany.makiety.map((m) => <img key={m} src={plik(wybrany, m)} alt={m} className="w-full rounded bg-white/5" />)}</div>
                        {([['Tytuł', wybrany.tytul], ['Opis', bezHtml(wybrany.opisHtml)], ['Cena', wybrany.cenaEur != null ? `${wybrany.cenaEur.toFixed(2)}` : '']] as const).map(([n, t]) => (
                            <div key={n}>
                                <div className="flex items-center gap-2 text-white/60">{n}{n === 'Cena' && ' (EUR)'}<button disabled={!t} onClick={() => void kopiuj(n, t)} className="rounded border border-white/20 px-1">{skopiowane === n ? '✓' : '📋'}</button></div>
                                <div className="max-h-24 overflow-y-auto whitespace-pre-line rounded bg-black/40 p-1">{t || '— brak (ustaw w TeO Fashion Studio)'}</div>
                            </div>
                        ))}
                        <div className="text-white/60">Typ: {wybrany.typ} · Rozmiary: S, M, L, XL, XXL · Producent: {wybrany.dostawca}</div>
                    </div>
                    <div className="space-y-2 rounded-lg border border-sky-500/30 p-2">
                        <b className="text-sky-300">B) Do drukarni — Printful / Gelato / Apliiq</b>
                        <p className="text-[11px] text-white/60">Pliki 300 DPI przycięte do grafiki. Wymiary z makiety względem rozmiaru M — PRZYBLIŻENIE; wiąże szablon drukarni.</p>
                        {wybrany.druk.map((s) => (
                            <div key={s.plik} className="flex items-center gap-2 border-b border-white/5 py-0.5">
                                <img src={plik(wybrany, s.plik)} alt="" className="h-8 w-8 rounded bg-white/10 object-contain" loading="lazy" />
                                <span>{s.strefa}</span><span className="ml-auto text-white/70">{s.szer != null ? `${s.szer} × ${s.wys} cm` : ''}</span>
                                <a href={plik(wybrany, s.plik)} download className="rounded border border-white/20 px-1">⬇</a>
                            </div>
                        ))}
                        {wybrany.wymiary && <a href={plik(wybrany, 'WYMIARY-DRUKU.txt')} target="_blank" rel="noreferrer" className="text-sky-300 underline">📄 WYMIARY-DRUKU.txt</a>}
                        <p className="text-[11px] text-white/40">Pliki strefa-*.png i arkusz.png to robocze podglądy — nie wgrywaj ich ani do sklepu, ani do drukarni.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
