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
interface Wynik { wyslane: { model: string; zdjec: number; plikowDruku: number }[]; pominiete: { model: string; powod: string }[]; csv: { plik: string; produktow: number; wariantow: number }; cel: string }

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

export function StolProduktowy() {
    const [dane, setDane] = useState<{ postacie: Postac[]; cel: string; csv: string | null } | null>(null);
    const [wybrany, setWybrany] = useState<Produkt | null>(null);
    const [praca, setPraca] = useState('');
    const [blad, setBlad] = useState('');
    const [wynik, setWynik] = useState<Wynik | null>(null);
    const [skopiowane, setSkopiowane] = useState('');

    const odswiez = useCallback(async () => {
        try {
            const d = await zMostu<{ postacie: Postac[]; cel: string; csv: string | null }>('/api/stol-produktowy');
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
                <button disabled={!!praca || !dane?.postacie.length} onClick={() => void wyslij({}, 'wysyłam wszystkie produkty…')}
                    className="ml-auto rounded bg-amber-500 px-3 py-1 font-bold text-black disabled:opacity-40">📂 Wyślij WSZYSTKO do sklep-shopify + CSV</button>
            </div>
            {dane && <p className="text-[11px] text-white/50">Cel: <code>{dane.cel}</code>{dane.csv && <> · ✓ <code>shopify-import.csv</code> gotowy (Shopify → Products → Import)</>}</p>}
            {praca && <p className="text-amber-200">⏳ {praca}</p>}
            {blad && <p className="rounded bg-red-950/50 p-2 text-red-300">⚠ {blad}</p>}
            {wynik && (
                <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-2">
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
                                <div className="text-[10px] text-white/60">{x.cenaEur != null ? `${x.cenaEur} €` : 'bez ceny'} {x.gotowy ? '✓' : '⚠'} {x.wyslany ? '📂' : ''}</div>
                            </button>
                        ))}
                    </div>
                </div>
            ))}

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
