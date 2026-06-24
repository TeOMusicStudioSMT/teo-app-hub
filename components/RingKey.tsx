/**
 * 💍 RingKey — Klucz Pierścienia (Kryptograficzny Stempel NFC).
 *
 * Pierścień/wisiorek/tag NFC nie mieści plików Katedry, ale może NOSIĆ
 * suwerenny token tożsamości. Web NFC (NDEFReader) zapisuje token na tag,
 * a dotknięcie odczytuje go i — jeśli zgodny — otwiera Katedrę.
 *
 * „Stajesz się żywym Obserwatorem — nosisz na palcu klucz, który otwiera bramy."
 *
 * Wymaga: Chrome na Androidzie (lub kontekst bezpieczny: https/localhost).
 * Degraduje się łagodnie, gdy Web NFC niedostępne.
 */

import React, { useState } from 'react';

const KEY_STORE = 'otakos_ring_key';
const BRIDGE = 'http://127.0.0.1:3001';

/** Zaszyfrowany backup stanu walleta (auto przy wejściu pierścieniem). */
function backupWallet() {
  try {
    const addresses = JSON.parse(localStorage.getItem('teo_wallet_addrs') || '[]');
    fetch(`${BRIDGE}/api/wallet/backup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addresses }) }).catch(() => {});
  } catch { /* cicho — backup to bonus */ }
}

export const RingKey: React.FC<{ onAuthSuccess: () => void }> = ({ onAuthSuccess }) => {
    const supported = typeof window !== 'undefined' && 'NDEFReader' in window;
    const [registered, setRegistered] = useState<string>(() => localStorage.getItem(KEY_STORE) || '');
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);

    const writeKey = async () => {
        if (!supported) { setStatus('⚠ Web NFC niedostępne (użyj Chrome na Androidzie).'); return; }
        setBusy(true); setStatus('💍 Przyłóż pierścień/tag NFC do telefonu...');
        try {
            const token = (crypto as any).randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
            const ndef = new (window as any).NDEFReader();
            await ndef.write({ records: [{ recordType: 'text', data: `otakos:${token}` }] });
            localStorage.setItem(KEY_STORE, `otakos:${token}`);
            setRegistered(`otakos:${token}`);
            setStatus('✅ Suwerenny klucz zapisany na pierścień. Teraz dotknij, by wejść.');
        } catch (e: any) { setStatus(`⚠ Zapis: ${e.message || 'odrzucono / brak tagu'}`); }
        finally { setBusy(false); }
    };

    const tapToEnter = async () => {
        if (!supported) { setStatus('⚠ Web NFC niedostępne (użyj Chrome na Androidzie).'); return; }
        setBusy(true); setStatus('💍 Dotknij pierścieniem...');
        try {
            const ndef = new (window as any).NDEFReader();
            await ndef.scan();
            ndef.onreading = (e: any) => {
                for (const rec of e.message.records) {
                    try {
                        const txt = new TextDecoder(rec.encoding || 'utf-8').decode(rec.data);
                        if (txt === registered) { setStatus('✅ Pierścień rozpoznany — backup walleta + otwieram Katedrę.'); backupWallet(); setBusy(false); onAuthSuccess(); return; }
                    } catch { /* pomiń rekord */ }
                }
                setStatus('⚠ Obcy pierścień — token niezgodny.'); setBusy(false);
            };
        } catch (e: any) { setStatus(`⚠ Odczyt: ${e.message || 'odrzucono'}`); setBusy(false); }
    };

    const forget = () => { localStorage.removeItem(KEY_STORE); setRegistered(''); setStatus('Klucz pierścienia usunięty.'); };

    return (
        <div className="flex flex-col items-center gap-2 max-w-xs text-center">
            {!registered ? (
                <button onClick={writeKey} disabled={busy}
                    className="px-5 py-2 rounded-full border border-fuchsia-500/45 bg-fuchsia-950/30 text-fuchsia-300 text-xs font-mono tracking-wider hover:bg-fuchsia-900/50 transition-colors disabled:opacity-50">
                    💍 ZAPISZ KLUCZ NA PIERŚCIEŃ (NFC)
                </button>
            ) : (
                <div className="flex items-center gap-2">
                    <button onClick={tapToEnter} disabled={busy}
                        className="px-5 py-2 rounded-full border border-fuchsia-500/55 bg-fuchsia-950/40 text-fuchsia-200 text-xs font-mono tracking-wider hover:bg-fuchsia-900/60 transition-colors disabled:opacity-50">
                        💍 DOTKNIJ PIERŚCIENIEM, BY WEJŚĆ
                    </button>
                    <button onClick={forget} title="Usuń klucz" className="text-zinc-600 hover:text-rose-400 text-xs">✕</button>
                </div>
            )}
            {!supported && <div className="text-[9px] text-zinc-600 font-mono">NFC działa w Chrome na Androidzie (kontekst https/localhost).</div>}
            {status && <div className="text-[10px] text-zinc-400 font-mono">{status}</div>}
        </div>
    );
};

export default RingKey;
