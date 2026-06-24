/**
 * 🛒 Marketplace 0.00G — sklep produktów za GRV + głosowanie.
 * Pokazuje TOP 10 /moduł (wg głosów). Twórz produkty, głosuj. Reszta co miesiąc
 * spalana → GRV wraca twórcom (/api/market/burn, cron). Personalizacja Katedry.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const BRIDGE = 'http://127.0.0.1:3001';

interface Product { id: string; module: string; type: string; name: string; desc: string; priceGrv: number; creator: string; votes: number; }

export const Marketplace: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<'shop' | 'vote' | 'create'>('shop');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ module: 'katedra-chat', name: '', desc: '', priceGrv: '100', creator: 'Mistrz Arkadiusz' });

  const load = useCallback(async () => {
    try { const d = await (await fetch(`${BRIDGE}/api/market/products`)).json(); if (d.success) setProducts(d.products); }
    catch { setStatus('⚠ Most offline (:3001)'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const vote = async (id: string) => {
    try { await fetch(`${BRIDGE}/api/market/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); load(); }
    catch { setStatus('⚠ Most offline'); }
  };
  const create = async () => {
    if (!form.name.trim()) { setStatus('⚠ Podaj nazwę'); return; }
    try {
      const d = await (await fetch(`${BRIDGE}/api/market/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, priceGrv: Number(form.priceGrv) }) })).json();
      if (!d.success) throw new Error(d.message);
      setStatus(`✅ Produkt dodany: ${d.product.name}`); setForm({ ...form, name: '', desc: '' }); load(); setTab('shop');
    } catch (e: any) { setStatus(`⚠ ${e.message}`); }
  };

  const tabBtn = (id: typeof tab, label: string) => (
    <button onClick={() => setTab(id)} className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${tab === id ? 'border-amber-500 text-amber-300 bg-amber-950/40' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>{label}</button>
  );

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-[#0a0804]/70 p-5 font-mono">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-amber-500/60">∴ KATEDRA OTAKOS ∴</div>
          <h3 className="text-lg font-bold text-amber-300">🛒 MARKETPLACE 0.00G</h3>
          <p className="text-[11px] text-zinc-400">Personalizuj Katedrę za GRV. TOP 10/moduł wg głosów — reszta co miesiąc spalana, GRV wraca twórcom.</p>
        </div>
        <div className="flex gap-2">{tabBtn('shop', '🛒 Sklep')}{tabBtn('vote', '🗳️ Głosowanie')}{tabBtn('create', '➕ Dodaj')}</div>
      </div>

      {tab === 'create' ? (
        <div className="space-y-2 max-w-md">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nazwa produktu"
            className="w-full bg-black/40 border border-amber-500/20 rounded px-2 py-1.5 text-sm text-amber-100 outline-none focus:border-amber-500" />
          <input value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder="Opis"
            className="w-full bg-black/40 border border-amber-500/20 rounded px-2 py-1.5 text-xs text-amber-100/80 outline-none focus:border-amber-500" />
          <div className="flex gap-2">
            <input value={form.module} onChange={e => setForm({ ...form, module: e.target.value })} placeholder="moduł"
              className="flex-1 bg-black/40 border border-amber-500/20 rounded px-2 py-1.5 text-xs text-amber-100/80 outline-none" />
            <input value={form.priceGrv} onChange={e => setForm({ ...form, priceGrv: e.target.value })} placeholder="cena GRV" type="number"
              className="w-28 bg-black/40 border border-amber-500/20 rounded px-2 py-1.5 text-xs text-amber-100/80 outline-none" />
          </div>
          <button onClick={create} className="px-4 py-1.5 rounded border border-amber-500/50 bg-amber-950/40 text-amber-300 text-xs font-bold hover:bg-amber-900/50">➕ WYSTAW ZA GRV</button>
        </div>
      ) : (
        <div className="space-y-2">
          {products.length === 0 ? <p className="text-zinc-500 text-sm text-center py-6">Brak produktów (lub most offline).</p> : products.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-black/30 p-3 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-amber-500/50 text-sm font-bold w-5">{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-amber-200 truncate">{p.name} <span className="text-[9px] text-zinc-500">· {p.module}</span></div>
                  <div className="text-[11px] text-zinc-400 truncate">{p.desc}</div>
                  <div className="text-[9px] text-zinc-600">twórca: {p.creator} · {p.priceGrv > 0 ? `${p.priceGrv.toLocaleString('pl-PL')} GRV` : 'FREE'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-amber-400 font-bold">▲ {p.votes}</span>
                <button onClick={() => vote(p.id)} title="Zagłosuj"
                  className="px-3 py-1 rounded border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-950/40">
                  {tab === 'vote' ? '🗳️ Głosuj' : '▲'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {status && <div className="text-[10px] text-zinc-400 mt-3">{status}</div>}
    </div>
  );
};

export default Marketplace;
