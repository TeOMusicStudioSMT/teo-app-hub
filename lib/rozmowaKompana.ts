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
import { zapytajAgenta, ZAKAZ_FORMULEK } from './szyna';
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

/**
 * Przedstawienie ma STAŁY, trzypunktowy kształt:
 *   1. Imię i domena,
 *   2. w czym służy (jedno-dwa zdania),
 *   3. wolny impuls — świeża myśl skierowana do Suwerena.
 *
 * ⚠️ Punkty 1 i 2 liczy KOD, nie model. Gdyby cała formułka szła z modelu, przy
 * każdym uruchomieniu brzmiałaby inaczej, a przy okazji dokleiłby do niej
 * zastrzeżenia prawne — dokładnie ten szum, który mamy stąd wyciąć. Modelowi
 * zostawiamy wyłącznie punkt 3, bo tam świeżość jest wartością, nie usterką.
 */
export function powitanieKompana(id: string): { gatunek: Gatunek; tekst: string } {
    const gatunek = gatunekPo(id) || GATUNKI[0];
    const stan = stanGatunku(gatunek.id);
    const imie = stan.name || gatunek.imie;
    // Punkt 2 z opisu gatunku, przycięty do dwóch zdań — bez rozlewania się.
    const sluzba = gatunek.opis.split(/(?<=\.)\s+/).slice(0, 2).join(' ').trim();
    return {
        gatunek,
        tekst: `${imie} — domena: ${gatunek.dziedzina}. ${sluzba}`,
    };
}

/** Zdania z prawniczym szumem wycinamy z odpowiedzi modelu — na wszelki wypadek. */
/** Odmiana polska jest bogata — `znak\w*` łapie „znaki", „znakami", „znakach". */
const SZUM = /(znak\w*\s+towarow\w*|trademark|™|®|praw\w*\s+autorsk\w*|copyright|licencj\w*|regulamin\w*|jako\s+(?:model|sztuczna\s+inteligencja|AI)|nie\s+jestem\s+(?:prawnikiem|lekarzem|doradc)|zastrzeżon\w*\s+(?:znak|praw)\w*)/i;

export function bezFormulek(tekst: string): string {
    const zdania = String(tekst || '').split(/(?<=[.!?])\s+/);
    const czyste = zdania.filter(z => !SZUM.test(z));
    // Gdyby filtr zjadł wszystko, oddajemy oryginał — lepiej szum niż pustka.
    return (czyste.length ? czyste.join(' ') : String(tekst || '')).trim();
}

/**
 * Punkt 3: wolny start. Krótka, świeża myśl od gatunku — z jego rdzenia.
 * Gdy most albo model milczy, po prostu jej nie ma. Podstawianie „inspiracji"
 * z listy w kodzie byłoby udawaniem świeżości, której nikt nie policzył.
 */
export async function iskraKompana(gatunek: Gatunek): Promise<string | null> {
    try {
        const odp = await zapytajAgenta('Suweren', gatunek.id,
            'Przywitaj się jednym zdaniem: rzuć Suwerenowi świeżą myśl, spostrzeżenie albo iskrę '
            + `ze swojej dziedziny (${gatunek.dziedzina}). Jedno zdanie, bez powtarzania swojego imienia `
            + `i bez opisywania, czym się zajmujesz — to już powiedziano. ${ZAKAZ_FORMULEK}`);
        const czysta = bezFormulek(odp);
        return czysta || null;
    } catch {
        return null;
    }
}

/** Powiedz powitanie aktywnego kompana. Używa tego Sfera i Orbita. */
export async function powitajKompana(id?: string, zIskra = true): Promise<Gatunek> {
    const { gatunek, tekst } = powitanieKompana(id ?? aktywnyGatunek());
    const iskra = zIskra ? await iskraKompana(gatunek) : null;
    const pelne = iskra ? `${tekst} ${iskra}` : tekst;
    try {
        await speak(pelne, { voiceId: gatunek.id, rodzaj: rodzajGlosu(gatunek), przewod: 'piper-pl' });
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
                const odpowiedz = bezFormulek(await zapytajAgenta('Suweren', gatunek.id, d.transcript));
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
