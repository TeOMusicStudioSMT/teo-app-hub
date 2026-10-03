/**
 * 🪪 Wizytówka w sieci otakos.wtf — profil (nick, motto, opis) i meldunek tej Katedry.
 *
 * Treść wizytówki to Wystawa bez ukrytych pozycji (services/Wizytowka.js). Tu Suweren ustala,
 * jak się nazywa w sieci i czy Katedra ma się meldować w rejestrze otakos.wtf (tylko przy
 * działającym Kwantowym Tunelu). Na stronie pojawia się dopiero po zatwierdzeniu nicka
 * z kluczem publicznym — klucz pokazujemy tu do skopiowania.
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const MOST = 'http://127.0.0.1:3001';

interface Profil {
    nick: string; motto: string; opis: string; meldunek: boolean; klucz: string; rejestr: string;
    kanal: string; linki: { nazwa: string; url: string }[];
    ostatniMeldunek: { kiedy: string; ok: boolean; status: number; wiadomosc: string; adres: string | null } | null;
}

async function zMostu<T>(s: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${MOST}${s}`, { headers: { 'Content-Type': 'application/json' }, ...init });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `HTTP ${r.status}`);
    return d as T;
}

export const WizytowkaPanel: React.FC = () => {
    const [p, setP] = useState<Profil | null>(null);
    const [blad, setBlad] = useState<string | null>(null);
    const [form, setForm] = useState({ nick: '', motto: '', opis: '', kanal: '', linki: '' });
    const [kanal, setKanal] = useState<{ id?: string; nazwa?: string; filmy?: unknown[]; blad?: string } | null>(null);
    const sprawdzKanal = useCallback(async () => { try { setKanal((await zMostu<{ kanal: typeof kanal }>('/api/wizytowka/kanal')).kanal); } catch { setKanal(null); } }, []);

    const odswiez = useCallback(async () => {
        try { const d = await zMostu<Profil>('/api/wizytowka/profil'); setP(d); setForm({ nick: d.nick, motto: d.motto, opis: d.opis, kanal: d.kanal ?? '', linki: (d.linki ?? []).map((l) => l.url).join('\n') }); setBlad(null); if (d.kanal) void sprawdzKanal(); }
        catch (e) { setBlad(/HTTP 404/.test(String(e)) ? 'Most sprzed restartu — nie zna jeszcze wizytówki. Zrestartuj Katedrę.' : String(e instanceof Error ? e.message : e)); }
    }, [sprawdzKanal]);
    useEffect(() => { void odswiez(); }, [odswiez]);

    const zapisz = async (zmiana: Partial<Omit<Profil, 'linki'>> & { linki?: string }) => {
        try { const d = await zMostu<Profil>('/api/wizytowka/profil', { method: 'PUT', body: JSON.stringify(zmiana) }); setP(d); setForm((f) => ({ ...f, kanal: d.kanal ?? f.kanal, linki: (d.linki ?? []).map((l) => l.url).join('\n') })); toast.success('Wizytówka zapisana.'); if (d.kanal) void sprawdzKanal(); else setKanal(null); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e), { duration: 8000 }); }
    };
    const zamelduj = async () => {
        try { await zMostu('/api/wizytowka/meldunek', { method: 'POST', body: '{}' }); await odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    };

    if (blad) return <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-200">🪪 {blad}</div>;
    if (!p) return null;
    const m = p.ostatniMeldunek;
    return (
        <details className="rounded-lg border border-cyan-500/25 p-2" open={!p.nick}>
            <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-cyan-300">🪪 Wizytówka w sieci otakos.wtf {p.nick ? `· ${p.nick}` : '· bez nicka'}</summary>
            <div className="mt-2 flex flex-col gap-2 text-[11px]">
                <p className="text-[10px] leading-relaxed text-slate-500">Wizytówka = ta wystawa (bez ukrytych) + nick, motto, kanał YouTube i linki. Na otakos.wtf widać tylko nick — nie imię. Pokazuje się, gdy Katedra jest online (Kwantowy Tunel) i nick jest zatwierdzony.</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_1fr]">
                    <label className="text-slate-400">Nick</label>
                    <input value={form.nick} onChange={(e) => setForm((f) => ({ ...f, nick: e.target.value.toLowerCase() }))} placeholder="np. teo-center (a–z, 0–9, -)" className="rounded border border-slate-700 bg-black/40 px-2 py-1 font-mono text-slate-200" />
                    <label className="text-slate-400">Motto</label>
                    <input value={form.motto} maxLength={140} onChange={(e) => setForm((f) => ({ ...f, motto: e.target.value }))} placeholder="jedno zdanie pod nickiem" className="rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                    <label className="text-slate-400">Opis</label>
                    <textarea value={form.opis} maxLength={600} rows={2} onChange={(e) => setForm((f) => ({ ...f, opis: e.target.value }))} placeholder="kilka słów o tej Katedrze" className="rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200" />
                    <label className="text-slate-400">📺 Kanał YouTube</label>
                    <div className="flex flex-col gap-0.5">
                        <input value={form.kanal} onChange={(e) => setForm((f) => ({ ...f, kanal: e.target.value }))} placeholder="https://www.youtube.com/@ArtOfSoulTV" className="rounded border border-slate-700 bg-black/40 px-2 py-1 font-mono text-slate-200" />
                        {kanal && <span className={`text-[10px] ${kanal.id ? 'text-emerald-300' : 'text-amber-300'}`}>{kanal.id ? `✓ ${kanal.nazwa || 'kanał'} · ${kanal.filmy?.length ?? 0} najnowszych filmów — cała ramka kanału pójdzie na wizytówkę` : `⚠ ${kanal.blad}`}</span>}
                    </div>
                    <label className="text-slate-400">🌐 Linki</label>
                    <textarea value={form.linki} rows={2} onChange={(e) => setForm((f) => ({ ...f, linki: e.target.value }))} placeholder={'Instagram, TikTok, Spotify… — jeden link na linię'} className="rounded border border-slate-700 bg-black/40 px-2 py-1 font-mono text-[10px] text-slate-200" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => void zapisz(form)} className="rounded bg-cyan-500/30 px-3 py-1 font-bold text-cyan-100">Zapisz wizytówkę</button>
                    {p.nick && <a href={`${MOST}/api/wizytowka`} target="_blank" rel="noreferrer" className="text-cyan-400 underline">podgląd JSON</a>}
                    <label className={`ml-auto flex items-center gap-1.5 ${p.nick ? 'text-slate-300' : 'text-slate-600'}`}>
                        <input type="checkbox" disabled={!p.nick} checked={p.meldunek} onChange={(e) => void zapisz({ meldunek: e.target.checked })} />
                        Melduj w sieci otakos.wtf (co minutę, gdy tunel działa)
                    </label>
                </div>
                {p.meldunek && (
                    <div className={`rounded border px-2 py-1.5 text-[10px] ${m?.ok ? 'border-emerald-500/30 text-emerald-300' : 'border-amber-500/30 text-amber-200'}`}>
                        {m ? <>{m.ok ? '✓' : '⚠'} {m.wiadomosc} <span className="text-slate-500">· {new Date(m.kiedy).toLocaleTimeString('pl-PL')}{m.adres ? ` · ${m.adres}` : ''}</span></> : 'Pierwszy meldunek za chwilę…'}
                        <button onClick={() => void zamelduj()} className="ml-2 underline">zamelduj teraz</button>
                    </div>
                )}
                <ZatwierdzanieKatedr />
                {p.nick && (
                    <div className="text-[10px] text-slate-500">
                        Nowa Katedra po włączeniu tunelu i meldunku sama czeka na zatwierdzenie u zarządcy rejestru (Stół). Twój klucz publiczny — gdyby zarządca chciał go porównać (prywatny nie opuszcza maszyny):
                        <div className="mt-1 flex items-center gap-1.5">
                            <code className="flex-1 truncate rounded bg-black/40 px-1.5 py-0.5 font-mono text-slate-300" title={p.klucz}>{p.nick} · {p.klucz}</code>
                            <button onClick={() => { void navigator.clipboard.writeText(JSON.stringify({ nick: p.nick, klucz: p.klucz })); toast.success('Skopiowano nick i klucz.'); }} className="rounded bg-slate-700/60 px-2 py-0.5 text-slate-200">kopiuj</button>
                        </div>
                    </div>
                )}
            </div>
        </details>
    );
};

/**
 * 🏛️ Zatwierdzanie Katedr — tylko w Katedrze zarządcy rejestru otakos.wtf (services/ZarzadcaRejestru.js).
 * Ta sama kolejka jest w StoL (Izba Akceptacji). Inne Katedry widzą tu tylko, kto jest zarządcą.
 */
interface Oczekujaca { nick: string; klucz: string; kiedy: string; powod?: string; domena?: string | null }
interface Przeglad { ja: string | null; zarzadca: string | null; jestZarzadca: boolean; oczekujace: Oczekujaca[]; zatwierdzone: { nick: string; klucz: string; kiedy: string; domena?: string }[]; ostatniaWysylka: { kiedy: string; ok: boolean; wiadomosc: string } | null; blad?: string }

export const ZatwierdzanieKatedr: React.FC = () => {
    const [p, setP] = useState<Przeglad | null>(null);
    const [pracuje, setPracuje] = useState(false);
    const odswiez = useCallback(async () => { try { setP(await zMostu<Przeglad>('/api/rejestr/stan')); } catch { setP(null); } }, []);
    useEffect(() => { void odswiez(); const t = setInterval(odswiez, 30_000); return () => clearInterval(t); }, [odswiez]);
    const akcja = async (sciezka: string, cialo: object, ok: string) => {
        setPracuje(true);
        try { await zMostu(sciezka, { method: 'POST', body: JSON.stringify(cialo) }); toast.success(ok); await odswiez(); }
        catch (e) { toast.error(e instanceof Error ? e.message : String(e), { duration: 8000 }); }
        finally { setPracuje(false); }
    };
    if (!p) return null;
    if (!p.jestZarzadca) return p.zarzadca ? <p className="text-[10px] text-slate-600">Zarządca rejestru otakos.wtf: <b className="text-slate-400">{p.zarzadca}</b> — zatwierdza nowe Katedry na swoim Stole.</p> : null;
    return (
        <div className="rounded border border-amber-500/30 bg-amber-950/10 p-2 text-[11px]">
            <div className="mb-1 font-bold text-amber-200">🏛️ Zatwierdzanie Katedr — jesteś zarządcą rejestru</div>
            {p.blad && <div className="text-[10px] text-amber-300">⚠ {p.blad}</div>}
            {!p.oczekujace.length && <div className="text-[10px] text-slate-500">Nikt nie czeka. Nowa Katedra pojawi się tu, gdy włączy tunel i meldunek.</div>}
            {p.oczekujace.map((o) => (
                <div key={o.nick + o.klucz + (o.domena ?? '')} className="flex flex-wrap items-center gap-2 py-1">
                    <b className="font-mono text-slate-100">{o.nick}</b>
                    <span className="text-[10px] text-slate-500">{o.powod ?? 'nowa Katedra'} · {new Date(o.kiedy).toLocaleString('pl-PL')}</span>
                    <span className="max-w-[10rem] truncate font-mono text-[9px] text-slate-600" title={o.klucz}>{o.klucz}</span>
                    <button disabled={pracuje} onClick={() => void akcja('/api/rejestr/zatwierdz', { nick: o.nick, klucz: o.klucz, domena: o.domena ?? null }, `„${o.nick}”${o.domena ? ` (${o.domena})` : ''} zatwierdzona — pojawi się na otakos.wtf.`)} className="ml-auto rounded bg-emerald-600/40 px-2 py-0.5 text-emerald-100">✓ Zatwierdź</button>
                    <button disabled={pracuje} onClick={() => void akcja('/api/rejestr/odrzuc', { nick: o.nick, klucz: o.klucz, domena: o.domena ?? null }, `„${o.nick}” odrzucona.`)} className="rounded bg-rose-600/30 px-2 py-0.5 text-rose-100">✕</button>
                </div>
            ))}
            {p.zatwierdzone.length > 0 && (
                <details className="mt-1"><summary className="cursor-pointer text-[10px] text-slate-400">Zatwierdzone ({p.zatwierdzone.length})</summary>
                    {p.zatwierdzone.map((z) => (
                        <div key={z.nick} className="flex items-center gap-2 py-0.5 text-[10px]">
                            <span className="font-mono text-slate-300">{z.nick}</span>{z.domena && <span className="font-mono text-slate-500">{z.domena}</span>}
                            <button disabled={pracuje} onClick={() => { if (confirm(`Zdjąć „${z.nick}” z otakos.wtf?`)) void akcja('/api/rejestr/cofnij', { nick: z.nick }, `„${z.nick}” zdjęta ze strony.`); }} className="ml-auto text-rose-300 underline">cofnij</button>
                        </div>
                    ))}
                </details>
            )}
            {p.ostatniaWysylka && <div className={`mt-1 text-[9px] ${p.ostatniaWysylka.ok ? 'text-slate-600' : 'text-amber-300'}`}>lista → otakos.wtf: {p.ostatniaWysylka.wiadomosc} · {new Date(p.ostatniaWysylka.kiedy).toLocaleTimeString('pl-PL')}</div>}
        </div>
    );
};

export default WizytowkaPanel;
