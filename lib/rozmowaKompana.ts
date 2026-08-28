/**
 * 🗣️ Rozmowa z kompanem — JEDNA logika dla Sfery i dla Orbity.
 *
 * Powitanie aktywnego TeOgochi, nasłuch mikrofonu, transkrypcja lokalnym
 * Whisperem i odpowiedź gatunku jego własnym rdzeniem — to samo w obu miejscach.
 *
 * ⚠️ DLACZEGO OSOBNY MODUŁ, A NIE KOPIA: Sfera (`TeO_Orb`) miała tę logikę
 * wpisaną u siebie. Przepisanie jej do Orbity dałoby dwie kopie, które
 * rozjechałyby się przy pierwszej poprawce — a wtedy „ta sama rozmowa" byłaby
 * już tylko w nazwie. Obie powierzchnie wołają teraz ten sam kod.
 *
 * Odpowiedź idzie przez `zapytajAgenta` — czyli tą samą szyną, co rozmowy
 * między agentami. To celowe: pytanie Suwerena zostawia ślad tak samo jak
 * pytanie Klatki do Joanny, więc questy i osiągnięcia liczą fakt, nie deklarację.
 */
import { useCallback, useRef, useState } from 'react';
import { aktywnyGatunek, stanGatunku } from './teogochiStado';
import { gatunekPo, GATUNKI, type Gatunek } from './teogochiGatunki';
import { zapytajAgenta } from './szyna';
import { speak } from '../services/voiceService';

const MOST = 'http://127.0.0.1:3001';

/** Gdzie jesteśmy w rozmowie. `cisza` = nic się nie dzieje. */
export type FazaRozmowy = 'cisza' | 'wita' | 'slucha' | 'przepisuje' | 'mysli' | 'mowi';

export const OPIS_FAZY: Record<FazaRozmowy, string> = {
    cisza: '',
    wita: 'wita się',
    slucha: 'słucha — kliknij, gdy skończysz',
    przepisuje: 'przepisuje, co powiedziałeś',
    mysli: 'myśli',
    mowi: 'mówi',
};

/** Głos gatunku: żeński dla tych, którzy go mają, męski dla reszty. */
function rodzajGlosu(g: Gatunek): 'zenski' | 'meski' {
    return (g.glos?.includes('female') || g.id === 'joanna' || g.id === 'paleta') ? 'zenski' : 'meski';
}

export function powitanieKompana(id: string): { gatunek: Gatunek; tekst: string } {
    const gatunek = gatunekPo(id) || GATUNKI[0];
    const stan = stanGatunku(gatunek.id);
    return {
        gatunek,
        tekst: `Cześć! Jestem ${stan.name || gatunek.imie}, Twój kompan Katedry w dziedzinie: ${gatunek.dziedzina}. Słucham Cię!`,
    };
}

/** Powiedz powitanie aktywnego kompana. Używa tego Sfera i Orbita. */
export async function powitajKompana(id?: string): Promise<Gatunek> {
    const { gatunek, tekst } = powitanieKompana(id ?? aktywnyGatunek());
    try {
        await speak(tekst, { voiceId: gatunek.id, rodzaj: rodzajGlosu(gatunek), przewod: 'piper-pl' });
    } catch (err) {
        // Głos to nie rdzeń rozmowy — brak Pipera nie może uciszyć całej Katedry.
        console.warn('[Rozmowa] Powitanie bez głosu:', err);
    }
    return gatunek;
}

/**
 * Hook rozmowy. Zwraca fazę, tekst do pokazania i jedną akcję `dotknij()`:
 * pierwszy dotyk wita i zaczyna nasłuch, drugi kończy nasłuch i wysyła.
 */
export function useRozmowaKompana() {
    const [faza, setFaza] = useState<FazaRozmowy>('cisza');
    const [kompanId, setKompanId] = useState<string>(() => {
        try { return aktywnyGatunek(); } catch { return 'joanna'; }
    });
    const [tekst, setTekst] = useState('');
    const [blad, setBlad] = useState('');

    const rekorderRef = useRef<MediaRecorder | null>(null);
    const kawalkiRef = useRef<Blob[]>([]);

    const kompan = gatunekPo(kompanId) || GATUNKI[0];

    const przerwij = useCallback(() => {
        try { rekorderRef.current?.stop(); } catch { /* już zatrzymany */ }
        rekorderRef.current = null;
        setFaza('cisza');
        setTekst('');
    }, []);

    /** Nasłuch → Whisper → odpowiedź gatunku → głos. */
    const zamknijNasluch = useCallback(() => {
        try { rekorderRef.current?.stop(); } catch { /* już zatrzymany */ }
    }, []);

    const zacznijNasluch = useCallback(async (gatunek: Gatunek) => {
        let strumien: MediaStream;
        try {
            strumien = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            setBlad('Brak dostępu do mikrofonu — bez niego nie ma rozmowy.');
            setFaza('cisza');
            return;
        }

        const rekorder = new MediaRecorder(strumien);
        kawalkiRef.current = [];
        rekorder.ondataavailable = (e) => { if (e.data.size > 0) kawalkiRef.current.push(e.data); };

        rekorder.onstop = async () => {
            strumien.getTracks().forEach(t => t.stop());
            rekorderRef.current = null;
            setFaza('przepisuje');
            try {
                const blob = new Blob(kawalkiRef.current, { type: rekorder.mimeType || 'audio/webm' });
                const base64 = await new Promise<string>((ok, zle) => {
                    const r = new FileReader();
                    r.onloadend = () => ok(String(r.result));
                    r.onerror = zle;
                    r.readAsDataURL(blob);
                });

                const res = await fetch(`${MOST}/api/voice/transcribe`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sample: base64 }),
                });
                const d = await res.json();
                if (!d.success) throw new Error(d.message || 'Whisper nie rozpoznał mowy.');
                if (!d.transcript) {
                    setTekst('Nie usłyszałem nic wyraźnego.');
                    setFaza('cisza');
                    return;
                }

                setTekst(d.transcript);
                setFaza('mysli');
                // Odpowiada GATUNEK, swoim rdzeniem i swoją personą — przez szynę,
                // więc rozmowa zostawia ślad w faktach Katedry.
                const odpowiedz = await zapytajAgenta('Suweren', gatunek.id, d.transcript);
                setTekst(odpowiedz);
                setFaza('mowi');
                try {
                    await speak(odpowiedz, {
                        voiceId: gatunek.id, rodzaj: rodzajGlosu(gatunek), przewod: 'piper-pl',
                    });
                } catch { /* bez głosu, ale tekst został */ }
                setFaza('cisza');
            } catch (e) {
                setBlad((e as Error).message);
                setFaza('cisza');
            }
        };

        rekorderRef.current = rekorder;
        rekorder.start();
        setFaza('slucha');
    }, []);

    /**
     * Dotknięcie środka. Pierwszy raz: powitanie + nasłuch. Drugi raz: koniec
     * nasłuchu. W trakcie myślenia i mówienia dotyk nic nie robi — przerywanie
     * w połowie zostawiłoby nagranie bez odpowiedzi.
     */
    const dotknij = useCallback(async () => {
        setBlad('');
        if (faza === 'slucha') { zamknijNasluch(); return; }
        if (faza !== 'cisza') return;

        const id = aktywnyGatunek();
        setKompanId(id);
        const { gatunek, tekst: powitanie } = powitanieKompana(id);
        setTekst(powitanie);
        setFaza('wita');
        await powitajKompana(id);
        await zacznijNasluch(gatunek);
    }, [faza, zacznijNasluch, zamknijNasluch]);

    return { faza, tekst, blad, kompan, kompanId, dotknij, przerwij, opisFazy: OPIS_FAZY[faza] };
}

export default useRozmowaKompana;
