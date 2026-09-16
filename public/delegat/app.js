/**
 * 📱🕊️ Delegat Mobilny — logika strony telefonu (bez builda, czysty JS).
 *
 * TORY:
 *  mowa → tekst:  MediaRecorder → base64 → POST /api/voice/transcribe (Whisper w Katedrze).
 *                 Gdy Katedra nie ma Whispera (424) albo mikrofon MediaRecorder nie działa,
 *                 tor zapasowy: SpeechRecognition przeglądarki (Chrome na Androidzie ma).
 *  tekst → tekst: POST /api/delegat/rozmowa {strumien:true} — SSE czytane przez fetch,
 *                 bo EventSource nie umie dołożyć nagłówka z kluczem Straży.
 *  tekst → mowa:  POST /api/voice/speak (tor Katedry: klon/Piper/Kokoro/ElevenLabs);
 *                 424 → speechSynthesis pl-PL w przeglądarce.
 *  szyna:         GET /api/szyna/strumien — pasek „co robi Katedra" (agenci Delegat·*, Artemis).
 *
 * KLUCZ: z fragmentu adresu (#k=…) do localStorage, fragment natychmiast czyszczony.
 * Wszystko jedzie na TEN SAM origin — czyli przez tunel na most, ze Strażą po drodze.
 */
(() => {
    const $ = (id) => document.getElementById(id);
    const BAZA = location.origin;
    const NAGLOWEK = 'x-teo-klucz';

    // ── klucz i profil z fragmentu ──
    let klucz = '', delegatZUrl = '';
    try {
        const hp = new URLSearchParams(location.hash.replace(/^#/, ''));
        if (hp.get('k')) { klucz = hp.get('k'); localStorage.setItem('teo_delegat_klucz', klucz); }
        if (hp.get('delegat')) delegatZUrl = hp.get('delegat');
        if (location.hash) history.replaceState({}, '', location.pathname);
        klucz = klucz || localStorage.getItem('teo_delegat_klucz') || '';
    } catch { /* storage zablokowany — klucz tylko na tę sesję */ }

    const naglowki = (dod = {}) => ({ 'Content-Type': 'application/json', ...(klucz ? { [NAGLOWEK]: klucz } : {}), ...dod });
    const api = async (sciezka, body, metoda) => {
        const r = await fetch(`${BAZA}${sciezka}`, { method: metoda || (body ? 'POST' : 'GET'), headers: naglowki(), body: body ? JSON.stringify(body) : undefined });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(d.message || `HTTP ${r.status}`), { status: r.status, dane: d });
        return d;
    };

    // ── stan ──
    let profile = [], profil = null, rozmowaId = null, wyciszony = false, audio = null, mowi = false;
    const stan = (t, zle) => { $('stan').textContent = t; $('stan').classList.toggle('zle', !!zle); };

    const dymek = (klasa, tekst) => {
        const d = document.createElement('div');
        d.className = `dymek ${klasa}`; d.textContent = tekst;
        $('log').appendChild(d); $('log').scrollTop = $('log').scrollHeight;
        return d;
    };

    // ── profile ──
    async function wczytajProfile() {
        try {
            const d = await api('/api/delegat/profile');
            profile = d.profile;
            $('profil').innerHTML = profile.map((p) => `<option value="${p.id}">${p.emoji} ${p.imie}</option>`).join('');
            const chce = delegatZUrl || localStorage.getItem('teo_delegat_profil') || 'joanna';
            ustawProfil(profile.find((p) => p.id === chce) ? chce : profile[0].id);
            stan(d.lokalne ? 'Na maszynie Suwerena — pełne narzędzia.' : `Przez tunel — narzędzia: ${profil.narzedziaZdalne.join(', ')}`);
        } catch (e) {
            stan(e.status === 401 ? 'Brak klucza Straży — otwórz stronę z kodu QR w Katedrze.' : `Katedra nie odpowiada: ${e.message}`, true);
        }
    }
    function ustawProfil(id) {
        profil = profile.find((p) => p.id === id) || profile[0];
        $('profil').value = profil.id;
        $('emoji').textContent = profil.emoji; $('imie').textContent = profil.imie; $('dziedzina').textContent = profil.dziedzina;
        document.documentElement.style.setProperty('--akcent', profil.kolor);
        try { localStorage.setItem('teo_delegat_profil', profil.id); } catch {}
    }
    $('profil').addEventListener('change', (e) => { ustawProfil(e.target.value); nowaRozmowa(); });

    function nowaRozmowa() {
        rozmowaId = null; $('log').innerHTML = ''; $('fakty').hidden = true;
        dymek('system', `Nowa rozmowa z ${profil ? profil.imie : 'Delegatem'}. Mów albo pisz.`);
    }
    $('nowa').addEventListener('click', nowaRozmowa);

    // ── rozmowa (SSE przez fetch) ──
    async function wyslij(tekst) {
        const t = String(tekst || '').trim();
        if (!t || !profil) return;
        zatrzymajGlos();
        dymek('suweren', t);
        $('tekst').value = '';
        const odp = dymek('delegat', '…');
        let calosc = '';
        try {
            const r = await fetch(`${BAZA}/api/delegat/rozmowa`, { method: 'POST', headers: naglowki(), body: JSON.stringify({ delegat: profil.id, tekst: t, rozmowaId, strumien: true }) });
            if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || `HTTP ${r.status}`); }
            const czytnik = r.body.getReader(); const dek = new TextDecoder(); let bufor = '';
            for (;;) {
                const { value, done } = await czytnik.read();
                if (done) break;
                bufor += dek.decode(value, { stream: true });
                let i;
                while ((i = bufor.indexOf('\n\n')) >= 0) {
                    const blok = bufor.slice(0, i); bufor = bufor.slice(i + 2);
                    const linia = blok.split('\n').find((l) => l.startsWith('data: '));
                    if (!linia) continue;
                    let z; try { z = JSON.parse(linia.slice(6)); } catch { continue; }
                    if (z.typ === 'token') { calosc += z.tekst; odp.textContent = calosc; $('log').scrollTop = $('log').scrollHeight; }
                    else if (z.typ === 'narzedzie') { odp.before(Object.assign(document.createElement('div'), { className: 'dymek narzedzie', textContent: `⚙️ ${z.narzedzie} ${JSON.stringify(z.argumenty)}` })); }
                    else if (z.typ === 'wynik') { const el = $('log').querySelector('.dymek.narzedzie:last-of-type'); if (el) { el.classList.add(z.ok ? 'ok' : 'blad'); el.textContent += z.ok ? ' ✓' : ` ✗ ${z.wynik?.blad || ''}`; } }
                    else if (z.typ === 'koniec') { rozmowaId = z.rozmowaId; calosc = z.odpowiedz; odp.textContent = calosc; await powiedz(calosc, z.glos); }
                    else if (z.typ === 'blad') { odp.textContent = `⚠️ ${z.message}`; odp.classList.add('narzedzie', 'blad'); }
                }
            }
            if (!calosc) odp.textContent = '(bez odpowiedzi)';
        } catch (e) { odp.textContent = `⚠️ ${e.message}`; }
    }
    $('wyslij').addEventListener('click', () => wyslij($('tekst').value));
    $('tekst').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); wyslij($('tekst').value); } });

    // ── głos: Katedra → przeglądarka ──
    function zatrzymajGlos() {
        if (audio) { try { audio.pause(); } catch {} audio = null; }
        try { speechSynthesis.cancel(); } catch {}
        mowi = false;
    }
    async function powiedz(tekst, glos) {
        if (wyciszony || !tekst) return;
        zatrzymajGlos(); mowi = true;
        try {
            const r = await fetch(`${BAZA}/api/voice/speak`, { method: 'POST', headers: naglowki(), body: JSON.stringify({ text: tekst, voiceId: glos || undefined }) });
            if (r.ok) {
                const blob = await r.blob();
                audio = new Audio(URL.createObjectURL(blob));
                audio.onended = () => { mowi = false; };
                await audio.play();
                return;
            }
        } catch { /* tor Katedry padł — przeglądarka */ }
        try {
            const u = new SpeechSynthesisUtterance(tekst); u.lang = 'pl-PL';
            const pl = speechSynthesis.getVoices().find((v) => /^pl/i.test(v.lang)); if (pl) u.voice = pl;
            u.onend = () => { mowi = false; };
            speechSynthesis.speak(u);
        } catch { mowi = false; }
    }
    $('cisza').addEventListener('click', () => { wyciszony = !wyciszony; $('cisza').textContent = wyciszony ? 'Odcisz' : 'Wycisz'; if (wyciszony) zatrzymajGlos(); });

    // ── mowa: mikrofon → Whisper w Katedrze, zapasowo SpeechRecognition ──
    let rec = null, kawalki = [], nagrywa = false, rozpoznawanie = null;
    const Rozp = window.SpeechRecognition || window.webkitSpeechRecognition;

    async function startNagrania() {
        if (nagrywa) return;
        zatrzymajGlos();
        try {
            const strumien = await navigator.mediaDevices.getUserMedia({ audio: true });
            kawalki = [];
            rec = new MediaRecorder(strumien);
            rec.ondataavailable = (e) => { if (e.data.size) kawalki.push(e.data); };
            rec.onstop = async () => {
                strumien.getTracks().forEach((t) => t.stop());
                const blob = new Blob(kawalki, { type: rec.mimeType || 'audio/webm' });
                await przepisz(blob);
            };
            rec.start();
            nagrywa = true; $('mik').classList.add('nagrywa'); stan('Słucham… puść, żeby wysłać.');
        } catch (e) {
            // Brak MediaRecorder/mikrofonu — próbujemy rozpoznawania w przeglądarce.
            if (Rozp) return rozpoznawajWPrzegladarce();
            stan(`Mikrofon niedostępny: ${e.message}`, true);
        }
    }
    function stopNagrania() {
        if (!nagrywa) return;
        nagrywa = false; $('mik').classList.remove('nagrywa');
        try { rec && rec.state !== 'inactive' && rec.stop(); } catch {}
    }
    async function przepisz(blob) {
        stan('Przepisuję (Whisper w Katedrze)…');
        try {
            const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
            const d = await api('/api/voice/transcribe', { sample: b64, model: 'small' });
            stan(`Usłyszałem: ${d.transcript.slice(0, 80)}`);
            if (d.transcript) await wyslij(d.transcript);
        } catch (e) {
            if ((e.status === 424 || e.status === 500) && Rozp) { stan('Katedra bez Whispera — rozpoznaję w telefonie.'); return rozpoznawajWPrzegladarce(); }
            stan(`Nie udało się przepisać: ${e.message}`, true);
        }
    }
    function rozpoznawajWPrzegladarce() {
        try {
            rozpoznawanie = new Rozp(); rozpoznawanie.lang = 'pl-PL'; rozpoznawanie.interimResults = true;
            $('mik').classList.add('nagrywa'); stan('Słucham (rozpoznawanie w telefonie)…');
            let koncowy = '';
            rozpoznawanie.onresult = (e) => { let t = ''; for (const r of e.results) { t += r[0].transcript; if (r.isFinal) koncowy = t; } $('tekst').value = t; };
            rozpoznawanie.onend = () => { $('mik').classList.remove('nagrywa'); if (koncowy || $('tekst').value) wyslij(koncowy || $('tekst').value); };
            rozpoznawanie.onerror = (e) => { $('mik').classList.remove('nagrywa'); stan(`Rozpoznawanie: ${e.error}`, true); };
            rozpoznawanie.start();
        } catch (e) { stan(`Rozpoznawanie niedostępne: ${e.message}`, true); }
    }
    // Przytrzymanie = push-to-talk; krótkie dotknięcie = start, drugie = stop.
    let dotkniecie = 0;
    $('mik').addEventListener('pointerdown', (e) => { e.preventDefault(); dotkniecie = Date.now(); if (nagrywa) stopNagrania(); else startNagrania(); });
    $('mik').addEventListener('pointerup', () => { if (nagrywa && Date.now() - dotkniecie > 600) stopNagrania(); });
    $('mik').addEventListener('pointerleave', () => { if (nagrywa && Date.now() - dotkniecie > 600) stopNagrania(); });

    // ── podsumowanie → fakty na szynę ──
    $('podsumuj').addEventListener('click', async () => {
        if (!rozmowaId) return stan('Nie ma jeszcze czego zapisywać.');
        $('podsumuj').disabled = true; stan('Streszczam i zapisuję fakty na szynę…');
        try {
            const d = await api(`/api/delegat/rozmowa/${rozmowaId}/podsumuj`, {});
            $('fakty').hidden = false;
            $('fakty').innerHTML = `<b>Zapisane:</b> ${d.streszczenie || '(bez streszczenia)'}<ul>${(d.fakty || []).map((f) => `<li>${f}</li>`).join('') || '<li>(bez faktów)</li>'}</ul>`;
            stan(`Zapisano ${d.fakty?.length || 0} faktów — Mózg Orbity je widzi.`);
            await powiedz(d.streszczenie || 'Zapisane.');
        } catch (e) { stan(`Nie udało się podsumować: ${e.message}`, true); }
        finally { $('podsumuj').disabled = false; }
    });

    // ── pasek szyny: co robi Katedra ──
    async function sluchajSzyny() {
        try {
            const r = await fetch(`${BAZA}/api/szyna/strumien`, { headers: naglowki() });
            if (!r.ok) return;
            const czytnik = r.body.getReader(); const dek = new TextDecoder(); let bufor = '';
            for (;;) {
                const { value, done } = await czytnik.read();
                if (done) break;
                bufor += dek.decode(value, { stream: true });
                let i;
                while ((i = bufor.indexOf('\n\n')) >= 0) {
                    const blok = bufor.slice(0, i); bufor = bufor.slice(i + 2);
                    const linia = blok.split('\n').find((l) => l.startsWith('data: '));
                    if (!linia) continue;
                    try {
                        const z = JSON.parse(linia.slice(6));
                        if (z.agent && !/^Delegat·/.test(z.agent) && !mowi) stan(`${z.agent}: ${z.tresc.slice(0, 90)}`);
                    } catch {}
                }
            }
        } catch { /* strumień zerwany — pasek po prostu stoi */ }
        setTimeout(sluchajSzyny, 15000);
    }

    wczytajProfile().then(() => { nowaRozmowa(); sluchajSzyny(); });
})();
