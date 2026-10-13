/**
 * 🐾🛒 Sklep Mini — zakładka Marketplace (most: services/SklepMini.js + services/Stripe.js, /api/sklep-mini, /api/stripe).
 * 💳 Stripe: stan klucza ze Skarbca 0.00G, darowizny (Payment Link na otakos.wtf).
 * 🌅 Propozycje dnia od stada (3 nowe Mini, obrazy) → ✓ z rzadkością i zgodą na kredyty Meshy → produkcja aż do pakietu.
 * 📋 Plan zasobów każdego Mini (Meshy, ruch, akcje, 3 obrazy) → 📦 pakiet → ✓ wystaw na stronie.
 */
import React, { useCallback, useEffect, useState } from 'react';

const MOST = 'http://127.0.0.1:3001';
type Rz = 'pospolity' | 'rzadki' | 'epicki' | 'legendarny' | 'mityczny';
interface Propozycja { id: string; dzien: string; nazwa: string; rzadkosc: Rz; opis: string; stan: string; obraz: string | null; blad?: string | null; wydano: number; budzet: number; pakiet?: string; historia?: { kiedy: string; tekst: string }[] }
interface Plan { klucz: string; nazwa: string; opis: string; meshy: boolean; ruch: boolean; akcje: boolean; obrazy: number; braki: string[]; gotowy: boolean; rzadkosc: Rz; zrodlo: string; cena: number; wariantyRysowane: boolean; pakiet: { id: string; stan: string } | null; wersji: number }
interface Pakiet { id: string; nazwa: string; rzadkosc: Rz; cena: number; waluta: string; stan: string; klipow: number; obrazow: number; bajtow: number; utworzono: string; okladka: boolean }
interface StanStripe { maKlucz: boolean; tryb: 'test' | 'live' | null; kluczRozpoznany: boolean; darowizny: { link: string; waluta: string; sugerowana: number } | null; sprzedanych: number; przychod: Record<string, number>; blad?: string }
interface Stan { ceny: Record<Rz, number>; rzadkosci: Rz[]; budzet: number; godzinaDnia: number; dzien: { data: string; propozycje: { ok: boolean; ile?: number; powod?: string }; pakiet: { ok: boolean; mini?: string; powod?: string } } | null; propozycje: Propozycja[]; pakiety: Pakiet[]; gpu: { trwa: { rodzaj: string } | null; kolejka: number }; plany: Plan[]; stripe: StanStripe | null }

async function zMostu<T>(sciezka: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${sciezka}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d as T;
}
const post = <T,>(s: string, body: unknown = {}) => zMostu<T>(s, { method: 'POST', body: JSON.stringify(body) });
const KOLOR: Record<Rz, string> = { pospolity: '#9ca3af', rzadki: '#38bdf8', epicki: '#a78bfa', legendarny: '#f59e0b', mityczny: '#f472b6' };
const STAN_PROP: Record<string, string> = { rysuje: '🎨 rysuje się', czeka: '⏳ czeka na wybór', 'w-produkcji': '🏭 w produkcji', utknela: '⛔ utknęła', gotowa: '✅ produkt gotowy', blad: '⛔ błąd' };
const STAN_PAK: Record<string, string> = { wystawiony: '🟢 na stronie', 'do-akceptacji': '⏳ czeka na ✓', wycofany: '⚪ wycofany' };
const znak = (b: boolean) => (b ? '✅' : '❌');
const karta: React.CSSProperties = { padding: 12, borderRadius: 12, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(15,23,42,0.6)' };
const przycisk = (kolor = '#7c3aed'): React.CSSProperties => ({ padding: '4px 10px', borderRadius: 8, background: kolor, color: 'white', border: 'none', cursor: 'pointer', fontSize: 12 });

export default function SklepMini() {
    const [stan, setStan] = useState<Stan | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [praca, setPraca] = useState<string | null>(null);
    const [rzadkosc, setRzadkosc] = useState<Record<string, Rz>>({});
    const [dar, setDar] = useState({ waluta: 'usd', sugerowana: 5 });

    const wczytaj = useCallback(async () => {
        try { setStan(await zMostu<Stan>('/api/sklep-mini')); setBlad(null); } catch (e) { setBlad(`Most śpi albo odmówił: ${(e as Error).message}`); }
    }, []);
    useEffect(() => { void wczytaj(); const t = setInterval(() => void wczytaj(), 15_000); return () => clearInterval(t); }, [wczytaj]);

    const zrob = async (klucz: string, fn: () => Promise<unknown>, ok?: string) => {
        setPraca(klucz); setInfo(null);
        try { await fn(); if (ok) setInfo(ok); setBlad(null); await wczytaj(); } catch (e) { setBlad((e as Error).message); } finally { setPraca(null); }
    };
    const zgodaMeshy = (co: string) => !!stan && window.confirm(`${co}\n\nProdukcja w Meshy: do ${stan.budzet} kredytów (≈ $${(stan.budzet * 0.02).toFixed(2)}) — Image-to-3D, rig z chodem i biegiem, paczka akcji. Obraz Mini wychodzi z Katedry do Meshy.\n\nPotwierdzasz?`);

    if (!stan) return <div style={{ color: blad ? '#f87171' : '#94a3b8', padding: 16 }}>{blad ?? 'Wczytuję Sklep Mini…'}</div>;
    const s = stan.stripe;
    const propozycje = stan.propozycje.filter((p) => p.stan !== 'odrzucona');

    return (
        <div style={{ display: 'grid', gap: 14, color: '#cbd5e1', fontSize: 13 }}>
            {blad && <div style={{ color: '#f87171' }}>{blad}</div>}
            {info && <div style={{ color: '#4ade80' }}>{info}</div>}

            {/* 💳 Stripe */}
            <div style={karta}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>💳 Stripe — płatności na otakos.wtf</div>
                {!s?.maKlucz ? (
                    <div style={{ color: '#fbbf24' }}>Brak klucza. Hub → 🔐 Skarbiec 0.00G → 💳 Stripe → <code>secret_key</code> (sk_live_… albo sk_test_… z dashboard.stripe.com → Developers → API keys). Bez klucza strona nie pokazuje ani darowizn, ani sklepu.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                        <div>Klucz w Skarbcu · tryb <b style={{ color: s.tryb === 'live' ? '#4ade80' : '#fbbf24' }}>{s.tryb === 'live' ? 'LIVE (prawdziwe pieniądze)' : s.tryb === 'test' ? 'TEST (karty testowe)' : 'nierozpoznany'}</b> · sprzedanych pakietów: {s.sprzedanych}{Object.entries(s.przychod).map(([w, k]) => ` · ${k.toFixed(2)} ${w.toUpperCase()}`).join('')}</div>
                        {!s.kluczRozpoznany && <div style={{ color: '#f87171' }}>To nie wygląda na klucz tajny Stripe (sk_… / rk_…) — klucz publiczny pk_… tu nie działa.</div>}
                        {s.darowizny ? (
                            <div>🎁 Darowizny włączone: <a href={s.darowizny.link} target="_blank" rel="noreferrer" style={{ color: '#c4b5fd' }}>{s.darowizny.link}</a> (sugerowana {s.darowizny.sugerowana} {s.darowizny.waluta.toUpperCase()}) <button style={przycisk('#475569')} disabled={!!praca} onClick={() => void zrob('dar', () => post('/api/stripe/darowizny', { wlacz: false }), 'Darowizny wyłączone — link zniknie ze strony przy następnym meldunku.')}>wyłącz</button></div>
                        ) : (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                🎁 Darowizny: waluta <select value={dar.waluta} onChange={(e) => setDar({ ...dar, waluta: e.target.value })}>{['usd', 'eur', 'pln'].map((w) => <option key={w}>{w}</option>)}</select>
                                sugerowana <input type="number" min={1} value={dar.sugerowana} onChange={(e) => setDar({ ...dar, sugerowana: Number(e.target.value) })} style={{ width: 60 }} />
                                <button style={przycisk()} disabled={!!praca} onClick={() => void zrob('dar', () => post('/api/stripe/darowizny', { wlacz: true, ...dar, minimum: 1 }), 'Link darowizn gotowy — trafi na otakos.wtf z wizytówką.')}>{praca === 'dar' ? '…' : '🎁 Włącz darowizny'}</button>
                            </div>
                        )}
                        <div style={{ color: '#94a3b8' }}>Zakup pakietu działa, gdy Katedra jest w sieci (Kwantowy Tunel) — sesję płatności zakłada most, plik wydaje tylko po opłacie.</div>
                    </div>
                )}
            </div>

            {/* 🌅 Propozycje dnia */}
            <div style={karta}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                    <b>🌅 Propozycje stada — 3 nowe Mini dziennie (od {stan.godzinaDnia}:00)</b>
                    <span>{stan.gpu.trwa ? `🎨 GPU: ${stan.gpu.trwa.rodzaj}` : ''}{stan.gpu.kolejka ? ` · w kolejce ${stan.gpu.kolejka}` : ''} <button style={przycisk('#475569')} disabled={!!praca} onClick={() => void zrob('dzien', () => post('/api/sklep-mini/dzien', { wymus: true }), 'Stado dostało zlecenie dnia.')}>{praca === 'dzien' ? '…' : '↻ zlecenie dnia teraz'}</button></span>
                </div>
                {stan.dzien && <div style={{ color: '#94a3b8', marginBottom: 6 }}>{stan.dzien.data}: {stan.dzien.propozycje.ok ? `${stan.dzien.propozycje.ile} propozycje` : `propozycje — ${stan.dzien.propozycje.powod}`} · {stan.dzien.pakiet.ok ? `pakiet dnia: ${stan.dzien.pakiet.mini}` : `pakiet dnia — ${stan.dzien.pakiet.powod}`}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {propozycje.map((p) => (
                        <div key={p.id} style={{ ...karta, borderColor: KOLOR[p.rzadkosc] }}>
                            {p.obraz ? <img src={`${MOST}/api/sklep-mini/propozycje/${p.id}/obraz`} alt={p.nazwa} style={{ width: '100%', borderRadius: 8, background: 'white' }} /> : <div style={{ height: 120, display: 'grid', placeItems: 'center', color: '#64748b' }}>{p.stan === 'rysuje' ? '🎨 rysuje się…' : 'bez obrazu'}</div>}
                            <div style={{ fontWeight: 700, marginTop: 6 }}>{p.nazwa} <span style={{ color: KOLOR[p.rzadkosc] }}>· {p.rzadkosc}</span></div>
                            <div style={{ color: '#94a3b8', fontSize: 12 }}>{p.opis}</div>
                            <div style={{ marginTop: 4 }}>{STAN_PROP[p.stan] ?? p.stan}{p.stan === 'w-produkcji' || p.stan === 'gotowa' ? ` · Meshy ${p.wydano}/${p.budzet} kr.` : ''}</div>
                            {p.blad && <div style={{ color: '#f87171', fontSize: 12 }}>{p.blad}</div>}
                            {p.historia?.length ? <div style={{ color: '#64748b', fontSize: 11 }}>{p.historia.at(-1)?.tekst}</div> : null}
                            {p.stan === 'czeka' && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <select value={rzadkosc[p.id] ?? p.rzadkosc} onChange={(e) => setRzadkosc({ ...rzadkosc, [p.id]: e.target.value as Rz })}>{stan.rzadkosci.map((r) => <option key={r} value={r}>{r} · {stan.ceny[r]} $</option>)}</select>
                                    <button style={przycisk('#16a34a')} disabled={!!praca} onClick={() => { if (zgodaMeshy(`Przyjmujesz „${p.nazwa}” (${rzadkosc[p.id] ?? p.rzadkosc}).`)) void zrob(p.id, () => post(`/api/sklep-mini/propozycje/${p.id}/przyjmij`, { rzadkosc: rzadkosc[p.id] ?? p.rzadkosc, zgodaKredyty: stan.budzet }), `„${p.nazwa}” idzie do produkcji.`); }}>✓ do produkcji</button>
                                    <button style={przycisk('#475569')} disabled={!!praca} onClick={() => void zrob(p.id, () => post(`/api/sklep-mini/propozycje/${p.id}/odrzuc`))}>✖</button>
                                </div>
                            )}
                            {p.stan === 'utknela' && <button style={{ ...przycisk('#b45309'), marginTop: 6 }} disabled={!!praca} onClick={() => { if (zgodaMeshy(`Wznawiasz „${p.nazwa}”. Najpierw sprawdź w Assetach 3D, czy przerwany krok nie dał już wersji.`)) void zrob(p.id, () => post(`/api/sklep-mini/propozycje/${p.id}/wznow`, { zgodaKredyty: stan.budzet })); }}>↻ Wznów (nowa zgoda)</button>}
                            {(p.stan === 'blad' || p.stan === 'utknela') && <button style={{ ...przycisk('#475569'), marginTop: 6, marginLeft: 6 }} disabled={!!praca} onClick={() => void zrob(p.id, () => post(`/api/sklep-mini/propozycje/${p.id}/odrzuc`))}>✖ odrzuć</button>}
                        </div>
                    ))}
                    {!propozycje.length && <div style={{ color: '#64748b' }}>Jeszcze nic — stado zaproponuje 3 Mini przy najbliższym zleceniu dnia.</div>}
                </div>
            </div>

            {/* 📋 Plan zasobów */}
            <div style={karta}>
                <b>📋 Plan zasobów Mini</b> <span style={{ color: '#94a3b8' }}>(Meshy · ruch · akcje · 3 obrazy wariantów → pakiet)</span>
                <div style={{ overflowX: 'auto', marginTop: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead><tr style={{ color: '#94a3b8', textAlign: 'left' }}><th>Mini</th><th>rzadkość</th><th>Meshy</th><th>ruch</th><th>akcje</th><th>obrazy</th><th>pakiet</th></tr></thead>
                        <tbody>
                            {stan.plany.map((m) => (
                                <tr key={m.klucz} style={{ borderTop: '1px solid rgba(148,163,184,0.15)' }}>
                                    <td title={m.opis}>{m.nazwa}<div style={{ color: '#64748b' }}>{m.braki.length ? `brak: ${m.braki.join(', ')}` : 'komplet'}</div></td>
                                    <td><select value={m.rzadkosc} onChange={(e) => void zrob(m.klucz, () => zMostu('/api/sklep-mini/rzadkosc', { method: 'PUT', body: JSON.stringify({ klucz: m.klucz, rzadkosc: e.target.value }) }))}>{stan.rzadkosci.map((r) => <option key={r} value={r}>{r} · {stan.ceny[r]} $</option>)}</select><div style={{ color: '#64748b' }}>{m.zrodlo}</div></td>
                                    <td>{znak(m.meshy)}</td><td>{znak(m.ruch)}</td><td>{znak(m.akcje)}</td><td>{m.obrazy}/3</td>
                                    <td>{m.pakiet ? STAN_PAK[m.pakiet.stan] ?? m.pakiet.stan : m.wariantyRysowane ? '🎨 rysuje warianty' : m.meshy && m.ruch && m.akcje ? <button style={przycisk()} disabled={!!praca} onClick={() => void zrob(m.klucz, () => post('/api/sklep-mini/pakiet', { klucz: m.klucz }), 'Stado rysuje brakujące warianty — pakiet zrobi się sam.')}>📦 zrób pakiet</button> : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!stan.plany.length && <div style={{ color: '#64748b' }}>Nie widzę Mini (gałąź „mini-teogochi” w Pracowni albo „stworek / Mini-TeOgochi” w opisie bryły).</div>}
                </div>
            </div>

            {/* 📦 Pakiety */}
            <div style={karta}>
                <b>📦 Pakiety</b>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 6 }}>
                    {stan.pakiety.map((p) => (
                        <div key={p.id} style={{ ...karta, borderColor: KOLOR[p.rzadkosc] }}>
                            {p.okladka && <img src={`${MOST}/api/sklep-mini/pakiety/${p.id}/okladka`} alt={p.nazwa} style={{ width: '100%', borderRadius: 8, background: 'white' }} />}
                            <div style={{ fontWeight: 700 }}>{p.nazwa} <span style={{ color: KOLOR[p.rzadkosc] }}>· {p.rzadkosc}</span></div>
                            <div>{p.cena} {p.waluta.toUpperCase()} · {p.klipow} klipów · {p.obrazow} obrazy · {(p.bajtow / 1e6).toFixed(1)} MB</div>
                            <div>{STAN_PAK[p.stan] ?? p.stan}</div>
                            {p.stan !== 'wystawiony'
                                ? <button style={{ ...przycisk('#16a34a'), marginTop: 6 }} disabled={!!praca} onClick={() => void zrob(p.id, () => post(`/api/sklep-mini/pakiety/${p.id}/wystaw`), `„${p.nazwa}” na stronie (gdy jest klucz Stripe).`)}>✓ wystaw na stronie</button>
                                : <button style={{ ...przycisk('#475569'), marginTop: 6 }} disabled={!!praca} onClick={() => void zrob(p.id, () => post(`/api/sklep-mini/pakiety/${p.id}/wycofaj`))}>wycofaj</button>}
                        </div>
                    ))}
                    {!stan.pakiety.length && <div style={{ color: '#64748b' }}>Jeszcze żaden — pakiet powstaje, gdy Mini ma komplet zasobów.</div>}
                </div>
            </div>
        </div>
    );
}
