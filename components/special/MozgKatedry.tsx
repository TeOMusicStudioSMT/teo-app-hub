/**
 * 🧠 Mózg Katedry — JEDNO miejsce na modele (TeO-Sim → zakładka 🧠). Suweren 2026-10-11: „potrzebujemy jednego
 * miejsca na te rzeczy… dał bym to do menu lewego z TeO-Sim, i tam też te ważne podobne rzeczy związane z mózgiem”.
 *
 * Wszystko tu zapisuje do mostu (prawda dla zadań Katedry), a Hub dostaje to samo przez lib/mozgKatedry.ts:
 *  · Rdzeń Katedry: domyślny lokalny (dawny „gemma4:e2b na sztywno” w moście), lokalny ciężki, chmura lekka/ciężka,
 *    tryb pracy czatu (lokal / chmura / hybryda) i Tryb Katedry w moście (CLOUD/JusT, licznik tokenów).
 *  · Silniki TeOgochi: przydział każdej roli (Reżyser, Joanna, Kronikarz…) — tu trafia „rura” trasy mostu tej roli;
 *    ostrzeżenia: model mały (≤ 4B) do roli piszącej długo, model, którego Ollama nie ma, zastępstwo Straży Modeli.
 *  · Kodeks (Mechanik) i Modele zadań (oczy). Dyrygent, Zwiadowca i Kuźnia — zakładka 🎼 obok.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ustawMozg, type MozgMostu } from '../../lib/mozgKatedry';
import { getTryb, setTryb, OPIS_TRYBU, type TrybPracy } from '../../lib/router/trybPracy';

const MOST = 'http://127.0.0.1:3001';
interface ModelOllamy { nazwa: string; gb: number; parametry: string; kwant: string }
interface Delegat { id: string; imie: string; emoji: string; dziedzina: string }
interface Stan {
  mozg: MozgMostu; agenci: Record<string, string>; zastepstwa: Record<string, { oryginal?: string; zastepca?: string; powod?: string }>;
  mechanik: string; ollama: ModelOllamy[] | null; ollamaOnline: boolean;
  zadania: Record<string, { nazwa: string; opis: string; wybrany: string | null; zrodlo: string | null; reczny: string | null }> | null;
  tryb: { tryb: string; dostawca: string; dzis?: { tokeny: number }; limitTokenow?: number; powod?: string | null } | null;
}

/** Role, które piszą długo i scalają — mały model psuje im pracę (Reżyser na e2b zgubił listę ujęć). */
const ROLE_DLUGIE = new Set(['rezyser', 'kronikarz', 'kodeks', 'dyrygent', 'pionek', 'wektor']);
/** Rozmiar w mld parametrów z nazwy / szczegółów Ollamy (e2b = 2, 26B-A4B = 26). */
export function miliardy(nazwa: string, parametry = ''): number | null {
  const e = /[:\-_]e(\d+)b/i.exec(nazwa); if (e) return Number(e[1]);   // gemma4:e2b — Ollama podaje 5,1B (z osadzeniami), liczy się 2 mld efektywnie
  const p = /(\d+(?:\.\d+)?)\s*B/i.exec(parametry);
  if (p) return Number(p[1]);
  const n = /(\d+(?:\.\d+)?)b(?![a-z])/i.exec(nazwa.replace(/a\d+(\.\d+)?b/i, ''));
  return n ? Number(n[1]) : null;
}

const pole: React.CSSProperties = { background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '4px 6px', fontSize: 12, maxWidth: '100%' };
const karta: React.CSSProperties = { background: 'rgba(15,23,42,.7)', border: '1px solid rgba(52,211,153,.25)', borderRadius: 14, padding: 12, marginBottom: 12 };
const tytul: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#a7f3d0', marginBottom: 6, letterSpacing: '.03em' };

const MozgKatedry: React.FC = () => {
  const [s, setS] = useState<Stan | null>(null);
  const [delegaci, setDelegaci] = useState<Delegat[]>([]);
  const [blad, setBlad] = useState<string | null>(null);
  const [wiesc, setWiesc] = useState<string>('');
  const [tryb, setTrybLok] = useState<TrybPracy>(getTryb());

  const odswiez = useCallback(async () => {
    try {
      const r = await fetch(`${MOST}/api/mozg`, { signal: AbortSignal.timeout(15000) });
      const d = await r.json();
      if (!d?.success) throw new Error(d?.message || `HTTP ${r.status}`);
      setS(d); setBlad(null);
    } catch (e) { setBlad(`Most Katedry milczy (${(e as Error).message}) — Mózg pokazuje się tylko przy działającym moście.`); }
    fetch(`${MOST}/api/delegat/wszyscy`).then((r) => r.json()).then((d) => setDelegaci(d?.delegaci ?? [])).catch(() => {});
  }, []);
  useEffect(() => { void odswiez(); }, [odswiez]);

  const zrob = async (opis: string, f: () => Promise<unknown>) => {
    setWiesc(`⏳ ${opis}…`);
    try { await f(); setWiesc(`✅ ${opis}`); await odswiez(); } catch (e) { setWiesc(`⚠ ${opis}: ${(e as Error).message}`); }
  };
  const post = async (url: string, body: unknown, metoda = 'POST') => {
    const r = await fetch(`${MOST}${url}`, { method: metoda, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.success === false) throw new Error(d?.message || `HTTP ${r.status}`);
    return d;
  };

  if (blad) return <div style={{ ...karta, color: '#fca5a5' }}>{blad} <button onClick={() => void odswiez()} style={{ ...pole, cursor: 'pointer', marginLeft: 6 }}>↻</button></div>;
  if (!s) return <div style={{ ...karta, color: '#94a3b8' }}>🧠 Czytam Mózg Katedry…</div>;

  const nazwy = (s.ollama ?? []).map((m) => m.nazwa);
  const info = (n: string) => s.ollama?.find((m) => m.nazwa === n || m.nazwa === `${n}:latest`);
  const opcje = (obecny: string, zDomyslnym: string | null) => (
    <>
      {zDomyslnym !== null && <option value="">— domyślny Katedry ({zDomyslnym})</option>}
      {obecny && !info(obecny) && !/^(claude|gemini):/.test(obecny) && <option value={obecny}>⚠ {obecny} (Ollama go nie ma)</option>}
      {obecny && /^(claude|gemini):/.test(obecny) && <option value={obecny}>☁️ {obecny}</option>}
      {nazwy.map((n) => { const m = info(n)!; return <option key={n} value={n}>{n}{m.parametry ? ` · ${m.parametry}` : ''}{m.gb ? ` · ${m.gb} GB` : ''}</option>; })}
    </>
  );
  const ostrzezenie = (rola: string, model: string): string | null => {
    if (!model) return null;
    if (!/^(claude|gemini):/.test(model) && s.ollama && !info(model)) return 'Ollama nie ma tego modelu — rola padnie albo Straż podstawi zastępcę.';
    const b = miliardy(model, info(model)?.parametry ?? '');
    if (ROLE_DLUGIE.has(rola) && b !== null && b <= 4.5) return `Mały model (${b} mld) do roli, która pisze długo i scala — gubi wątki (tak Reżyser zgubił listę ujęć).`;
    if (/(IQ1|IQ2|Q2_|TQ\d)/i.test(model)) return 'Mocno zgnieciony kwant (≤ 2 bity) — bywa niestabilny.';
    return null;
  };

  const role = delegaci.length ? delegaci : Object.keys(s.agenci).map((id) => ({ id, imie: id, emoji: '🥚', dziedzina: '' }));
  const zrodlo: Record<string, string> = { mozg: 'ustawiony tutaj', OTAKOS_MODEL: 'zmienna OTAKOS_MODEL', zapas: 'zapas mostu (nic nie ustawiono)' };

  return (
    <div style={{ color: '#e2e8f0', fontSize: 12 }}>
      <div style={{ ...karta, borderColor: 'rgba(250,204,21,.35)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fde68a' }}>🧠 Mózg Katedry — jedno miejsce na modele</div>
        <div style={{ color: '#94a3b8', marginTop: 4 }}>Wszystko stąd zapisuje się w moście, więc dochodzi do każdego zadania Katedry (Reżyser, Joanna, Kronikarz, Kodeks…) i do czatów Huba. Ollama: {s.ollamaOnline ? `${nazwy.length} modeli` : '⚠ nie odpowiada'}.</div>
        {wiesc && <div style={{ marginTop: 6, color: wiesc.startsWith('⚠') ? '#fca5a5' : '#86efac' }}>{wiesc}</div>}
      </div>

      <div style={karta}>
        <div style={tytul}>⚙️ RDZEŃ KATEDRY</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,auto) 1fr', gap: '6px 10px', alignItems: 'center' }}>
          <span>🏠 Domyślny lokalny</span>
          <select value={s.mozg.lokalny ?? ''} onChange={(e) => void zrob('domyślny model Katedry', () => ustawMozg({ lokalny: e.target.value }))} style={pole}>{opcje(s.mozg.lokalny ?? '', null)}{!s.mozg.lokalny && <option value="">{s.mozg.domyslny} ({zrodlo[s.mozg.zrodlo] ?? s.mozg.zrodlo})</option>}</select>
          <span>🏋️ Lokalny ciężki (Adamus)</span>
          <select value={s.mozg.lokalnyCiezki ?? ''} onChange={(e) => void zrob('lokalny ciężki', () => ustawMozg({ lokalnyCiezki: e.target.value }))} style={pole}>{opcje(s.mozg.lokalnyCiezki ?? '', s.mozg.domyslny)}</select>
          <span>☁️ Chmura lekka</span>
          <input defaultValue={s.mozg.chmuraLekki ?? ''} placeholder="np. claude-haiku-4-5" onBlur={(e) => e.target.value !== (s.mozg.chmuraLekki ?? '') && void zrob('chmura lekka', () => ustawMozg({ chmuraLekki: e.target.value }))} style={pole} />
          <span>☁️ Chmura ciężka</span>
          <input defaultValue={s.mozg.chmuraCiezki ?? ''} placeholder="np. claude-opus-5-5" onBlur={(e) => e.target.value !== (s.mozg.chmuraCiezki ?? '') && void zrob('chmura ciężka', () => ustawMozg({ chmuraCiezki: e.target.value }))} style={pole} />
          <span>💬 Tryb czatów Huba</span>
          <select value={tryb} onChange={(e) => { const t = setTryb(e.target.value as TrybPracy); setTrybLok(t); }} style={pole}>{(Object.keys(OPIS_TRYBU) as TrybPracy[]).map((t) => <option key={t} value={t}>{OPIS_TRYBU[t].ikona} {OPIS_TRYBU[t].etykieta}</option>)}</select>
          <span>🌉 Tryb Katedry (most)</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {s.tryb ? <>
              <b style={{ color: s.tryb.tryb === 'chmura' ? '#7dd3fc' : '#86efac' }}>{s.tryb.tryb === 'chmura' ? '☁️ CLOUD' : '🏠 JusT (lokalnie)'}</b>
              <span style={{ color: '#94a3b8' }}>tokeny dziś {s.tryb.dzis?.tokeny ?? 0}/{s.tryb.limitTokenow ?? '—'}</span>
              <button onClick={() => void zrob('Tryb Katedry', () => post('/api/tryb', { tryb: s.tryb!.tryb === 'chmura' ? 'lokalnie' : 'chmura' }, 'PUT'))} style={{ ...pole, cursor: 'pointer' }}>przełącz</button>
              {s.tryb.powod && <span style={{ color: '#fcd34d' }}>{s.tryb.powod}</span>}
            </> : <span style={{ color: '#94a3b8' }}>most nie podał trybu</span>}
          </span>
        </div>
        <div style={{ color: '#64748b', marginTop: 6 }}>{OPIS_TRYBU[tryb].opis}</div>
      </div>

      <div style={karta}>
        <div style={tytul}>🥚 SILNIKI TeOgochi — rura każdej roli</div>
        <div style={{ color: '#94a3b8', marginBottom: 6 }}>Zadania mostu danej roli biorą ten model; puste = domyślny Katedry ({s.mozg.domyslny}).</div>
        {role.map((d) => {
          const model = s.agenci[d.id] ?? '';
          const zast = s.zastepstwa?.[d.id];
          const ost = ostrzezenie(d.id, model || s.mozg.domyslny);
          return (
            <div key={d.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px,auto) 1fr', gap: 8, alignItems: 'center', padding: '4px 0', borderTop: '1px solid rgba(51,65,85,.4)' }}>
              <span title={d.dziedzina}>{d.emoji} {d.imie}</span>
              <span>
                <select value={model} onChange={(e) => void zrob(`silnik ${d.imie}`, () => post('/api/stado/model', { agent: d.id, model: e.target.value }))} style={{ ...pole, width: '100%' }}>{opcje(model, s.mozg.domyslny)}</select>
                {zast?.zastepca && <div style={{ color: '#fcd34d', fontSize: 11 }}>🛡️ Straż: zastępstwo za {zast.oryginal} → {zast.zastepca}{zast.powod ? ` (${zast.powod})` : ''}</div>}
                {ost && <div style={{ color: '#fca5a5', fontSize: 11 }}>⚠ {ost}</div>}
              </span>
            </div>
          );
        })}
      </div>

      <div style={karta}>
        <div style={tytul}>🐙 KODEKS (Mechanik) i 🎯 MODELE ZADAŃ</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,auto) 1fr', gap: '6px 10px', alignItems: 'center' }}>
          <span>🐙 Mechanik / Kodeks (zapas)</span>
          <select value={s.mechanik} onChange={(e) => void zrob('model Mechanika', () => post('/api/mechanic/model', { model: e.target.value }))} style={pole}>{opcje(s.mechanik, null)}</select>
          {Object.entries(s.zadania ?? {}).map(([id, z]) => (
            <React.Fragment key={id}>
              <span title={z.opis}>{z.nazwa}</span>
              <span>
                <select value={z.reczny ?? ''} onChange={(e) => void zrob(z.nazwa, () => post('/api/modele/zadania', { zadanie: id, model: e.target.value || null }, 'PUT'))} style={{ ...pole, width: '100%' }}>
                  <option value="">— sam dobiera (teraz: {z.wybrany ?? 'brak'}, {z.zrodlo})</option>
                  {nazwy.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </span>
            </React.Fragment>
          ))}
        </div>
        <div style={{ color: '#64748b', marginTop: 6 }}>Dyrygent (dobiera modele do zadań), Zwiadowca (nowe modele z HF), Kuźnia Soup i porządki na dysku — zakładka 🎼 obok.</div>
      </div>
    </div>
  );
};

export default MozgKatedry;
