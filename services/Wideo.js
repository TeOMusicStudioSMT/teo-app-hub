/**
 * 🎬 Wideo — prawdziwa generacja scen dla Story V2.
 *
 * ⚠️ CO ZASTĘPUJE. `TeO_Story_V2/src/services/GoogleWorkflowService.ts` był
 * atrapą na wylot: zmienne nazywały się `mockFrameName` i `mockVideoName`,
 * status ustawiał się na SUCCESS bezwarunkowo, a „wygenerowany" plik był
 * NAPISEM zbudowanym z `Date.now()`. Stąd „100% COMPLETED" obok komunikatu
 * „most milczy" — potok nie potrzebował mostu, bo niczego nie robił.
 *
 * ⚠️ SPRAWDZAMY, ZANIM OBIECAMY. Model wideo sam z siebie nie policzy nic:
 * MiniMax H3 potrzebuje SWOJEGO enkodera tekstu (CLIP typu `minimax`) i SWOJEGO
 * VAE. Jak długo ich nie ma, ta trasa ODMAWIA z listą braków — zamiast oddać
 * nazwę pliku, którego nie ma.
 *
 * Graf `_OtakOs_AI/workflows/minimax_h3_t2v.json` napisany jest z PRAWDZIWYCH
 * schematów nodów (`/object_info`), nie z pamięci: `MiniMaxH3ImageToVideo`,
 * `MiniMaxH3SigmaShift`, `EmptyMiniMaxH3LatentAV` istnieją w tej instalacji.
 */
import fs from 'fs/promises';
import path from 'path';

const KATALOG_WF = () => path.join(process.cwd(), '_OtakOs_AI', 'workflows');
const GRAF = 'minimax_h3_t2v.json';

/** Co ComfyUI naprawdę widzi w danym polu danego noda. */
async function listaPola(base, nod, pole) {
    try {
        const r = await fetch(`${base}/object_info/${nod}`);
        if (!r.ok) return null;
        const d = await r.json();
        const k = Object.keys(d)[0];
        const v = d[k]?.input?.required?.[pole];
        return Array.isArray(v?.[0]) ? v[0] : null;
    } catch { return null; }
}

/**
 * Czy da się w ogóle generować. Zwraca listę BRAKÓW, a nie samo „nie".
 * Bez tego Suweren dostawałby „nie wyszło" bez informacji, czego dokupić.
 */
export async function stanWideo(comfyBase) {
    const braki = [];
    let comfy = false;
    try { comfy = (await fetch(`${comfyBase}/object_info/UNETLoader`)).ok; } catch { comfy = false; }
    if (!comfy) {
        return {
            gotowe: false, comfy: false, modele: [], enkodery: [], vae: [],
            braki: ['ComfyUI nie odpowiada na :8188 — obudź go (POST /api/comfy/ensure).'],
        };
    }

    const modele = (await listaPola(comfyBase, 'UNETLoader', 'unet_name')) ?? [];
    const enkodery = (await listaPola(comfyBase, 'CLIPLoader', 'clip_name')) ?? [];
    const vae = (await listaPola(comfyBase, 'VAELoader', 'vae_name')) ?? [];

    // Model wideo H3 — po nazwie pliku, bo tak go widzi ComfyUI.
    const modeleH3 = modele.filter(m => /h3|minimax/i.test(m) && !/music/i.test(m));
    if (!modeleH3.length) braki.push('Brak modelu wideo MiniMax H3 w ComfyUI (UNETLoader).');

    // ⚠️ Enkoder MUSI być dla WIDEO. `minimax_music3_text_encoder` jest muzyczny
    // i podstawienie go tutaj skończyłoby się błędem po kilkunastu minutach liczenia.
    const enkoderyH3 = enkodery.filter(e => /h3/i.test(e) && !/music/i.test(e));
    if (!enkoderyH3.length) {
        braki.push(
            'Brak enkodera tekstu dla MiniMax H3 (CLIPLoader, type "minimax"). '
            + `Widzę tylko: ${enkodery.join(', ') || '—'} — to enkodery MUZYCZNE, nie wideo.`,
        );
    }

    const vaeH3 = vae.filter(v => /h3/i.test(v) && !/music/i.test(v));
    if (!vaeH3.length) {
        braki.push(
            'Brak VAE dla MiniMax H3 (VAELoader). '
            + `Widzę tylko: ${vae.join(', ') || '—'}.`,
        );
    }

    let grafJest = true;
    try { await fs.access(path.join(KATALOG_WF(), GRAF)); } catch { grafJest = false; }
    if (!grafJest) braki.push(`Brak grafu ${GRAF} w _OtakOs_AI/workflows/.`);

    return {
        gotowe: braki.length === 0,
        comfy: true,
        modele: modeleH3, enkodery: enkoderyH3, vae: vaeH3,
        wszystkieEnkodery: enkodery, wszystkieVae: vae,
        graf: grafJest ? GRAF : null,
        braki,
    };
}

/**
 * Zleć scenę. Zwraca id zlecenia ComfyUI albo POWÓD odmowy.
 * ⚠️ Nie ma tu ścieżki „udało się mimo braków" — jeśli czegoś nie ma, mówimy to.
 */
export async function generujScene({ comfyBase, prompt, szerokosc, wysokosc, klatek, kroki, ziarno }) {
    if (!prompt?.trim()) return { ok: false, powod: 'Pusty opis sceny — nie ma czego generować.' };

    const stan = await stanWideo(comfyBase);
    if (!stan.gotowe) return { ok: false, powod: stan.braki.join(' | '), braki: stan.braki };

    const graf = JSON.parse(await fs.readFile(path.join(KATALOG_WF(), GRAF), 'utf8'));
    // Podstawiamy REALNE nazwy z ComfyUI — nie te z pliku, bo plik jest szablonem.
    graf['1'].inputs.unet_name = stan.modele[0];
    graf['2'].inputs.clip_name = stan.enkodery[0];
    graf['3'].inputs.vae_name = stan.vae[0];
    graf['5'].inputs.prompt = prompt;
    graf['5'].inputs.width = Number(szerokosc) || 720;
    graf['5'].inputs.height = Number(wysokosc) || 480;
    graf['5'].inputs.length = Number(klatek) || 49;
    graf['7'].inputs.steps = Number(kroki) || 20;
    graf['7'].inputs.seed = Number.isFinite(Number(ziarno)) ? Number(ziarno) : Math.floor(Math.random() * 1e9);

    try {
        const r = await fetch(`${comfyBase}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: graf }),
        });
        const d = await r.json();
        if (!r.ok || d?.error) {
            return { ok: false, powod: `ComfyUI odrzucił graf: ${JSON.stringify(d?.error ?? d).slice(0, 300)}` };
        }
        return { ok: true, zlecenie: d.prompt_id, model: stan.modele[0] };
    } catch (e) {
        return { ok: false, powod: `Nie dowiozłem grafu do ComfyUI: ${e.message}` };
    }
}

/** Stan zlecenia. `gotowe:false` bez pliku to NIE jest sukces. */
export async function stanZlecenia(comfyBase, id) {
    try {
        const r = await fetch(`${comfyBase}/history/${encodeURIComponent(id)}`);
        if (!r.ok) return { ok: false, powod: `ComfyUI HTTP ${r.status}` };
        const d = await r.json();
        const wpis = d?.[id];
        if (!wpis) return { ok: true, gotowe: false, stan: 'w kolejce albo liczy' };

        const pliki = [];
        for (const out of Object.values(wpis.outputs ?? {})) {
            for (const klucz of ['videos', 'gifs', 'images']) {
                for (const p of out?.[klucz] ?? []) pliki.push(p.filename);
            }
        }
        const blad = wpis.status?.status_str === 'error' ? wpis.status : null;
        return { ok: true, gotowe: !blad && pliki.length > 0, pliki, blad };
    } catch (e) {
        return { ok: false, powod: e.message };
    }
}

export default { stanWideo, generujScene, stanZlecenia };
