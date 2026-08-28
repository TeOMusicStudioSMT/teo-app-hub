/**
 * 🎞️ KompozytorUI — projekt z App V2 → kompozycja HyperFrames.
 *
 * App V2 oddaje ekran jako JSON (screenColor + elements). Ten moduł zamienia go
 * w gotową kompozycję: każdy element dostaje kafel na ekranie i wejście na
 * osi czasu. Dzięki temu agent, który przed chwilą zaprojektował aplikację,
 * może ją od razu ANIMOWAĆ — bez ręcznego pisania HTML-a.
 *
 * Kontrakt HyperFrames (z szablonu `init --example blank`):
 *  · #root z data-composition-id / data-start / data-duration / data-width / data-height
 *  · elementy z class="clip" i własnym data-start / data-duration
 *  · JEDNA wstrzymana oś czasu GSAP w window.__timelines[id] — render ją przewija,
 *    więc animacja MUSI być deterministyczna i „seekowalna". Żadnych setTimeout.
 *
 * Zero sieci, zero modelu — czysta zamiana danych na tekst.
 */

/** Ucieczka HTML — treść pochodzi od modelu, więc nie ufamy jej bezkrytycznie. */
function esc(x) {
    return String(x ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Kolor przepuszczamy tylko, gdy wygląda jak kolor. Inaczej wartość domyślna. */
function kolor(x, domyslny) {
    const s = String(x ?? '').trim();
    return /^#[0-9a-f]{3,8}$/i.test(s) || /^[a-z]{3,20}$/i.test(s) ? s : domyslny;
}

const AKCENT = '#22d3ee';

/**
 * ZMIERZONE NA RENDERZE, NIE ZGADNIETE: HyperFrames pozycjonuje kazdy `.clip`
 * ABSOLUTNIE wzgledem kompozycji. Pierwsza wersja ukladala kafle przez
 * `display:flex; flex-direction:column` — i wszystkie piec elementow wyladowalo
 * jeden NA DRUGIM w tym samym punkcie. Dlatego `top` liczymy sami.
 */
const WYSOKOSC = { header: 104, text: 66, button: 92, input: 96, card: 168 };
const ODSTEP = 30;
const wysokoscEl = (el) => (WYSOKOSC[el.type] ?? 60) + ODSTEP;

/** Jeden element projektu → kafel HTML. */
function kafel(el, i, start, trwanie, gora, lewa) {
    const wspolne = `class="clip" data-start="${start.toFixed(2)}" data-duration="${trwanie.toFixed(2)}" data-track-index="${i + 1}" id="el-${i}"`;
    const baza = `position:absolute; left:${lewa}px; top:${gora}px; opacity:1;`;
    switch (el.type) {
        case 'header':
            return `<div ${wspolne} style="${baza} font-size:76px; font-weight:800; letter-spacing:-1px; color:#f8fafc;">${esc(el.text)}</div>`;
        case 'button':
            return `<div ${wspolne} style="${baza} display:inline-block; padding:22px 54px; border-radius:16px; font-size:34px; font-weight:600; color:#0a0f1c; background:${kolor(el.color, AKCENT)};">${esc(el.text)}</div>`;
        case 'text':
            return `<div ${wspolne} style="${baza} font-size:36px; line-height:1.45; color:#cbd5e1; max-width:1200px;">${esc(el.content ?? el.text)}</div>`;
        case 'input':
            return `<div ${wspolne} style="${baza} padding:24px 32px; border:2px solid #334155; border-radius:14px; font-size:32px; color:#64748b; background:rgba(0,0,0,.35); max-width:900px;">${esc(el.placeholder)}</div>`;
        case 'card':
            return `<div ${wspolne} style="${baza} padding:36px 44px; border-radius:20px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); max-width:1100px;">
        <div style="font-size:42px; font-weight:700; color:#f1f5f9;">${esc(el.title)}</div>
        <div style="font-size:30px; color:#94a3b8; margin-top:10px;">${esc(el.subtitle)}</div>
      </div>`;
        default:
            // Nieznany typ pokazujemy WPROST, zamiast po cichu połykać element.
            return `<div ${wspolne} style="${baza} font-size:26px; color:#f59e0b; font-family:monospace;">[nieobsłużony typ: ${esc(el.type)}]</div>`;
    }
}

/**
 * Zbuduj kompozycję z projektu App V2.
 * @param {object} projekt  { screenColor, elements[], message }
 * @param {object} opcje    { tytul?, sekundNaElement?, szer?, wys? }
 */
export function zProjektuAppV2(projekt, opcje = {}) {
    const elementy = Array.isArray(projekt?.elements) ? projekt.elements : [];
    const naElement = Number(opcje.sekundNaElement) || 1.2;
    const szer = Number(opcje.szer) || 1920;
    const wys = Number(opcje.wys) || 1080;
    const tlo = kolor(projekt?.screenColor, '#0a0f1c');

    // Ostatni element ma zostać na ekranie do końca — inaczej film kończy się pustką.
    const wejscia = elementy.map((_, i) => 0.6 + i * naElement);
    const calosc = Math.max(4, (wejscia[wejscia.length - 1] ?? 0) + 2.6);

    // Uklad pionowy liczony recznie i wysrodkowany w kadrze.
    const lewa = 140;
    const razem = elementy.reduce((s, el) => s + wysokoscEl(el), 0);
    let kursor = Math.max(80, Math.round((wys - razem) / 2));
    const kafle = elementy
        .map((el, i) => {
            const html = kafel(el, i, wejscia[i], calosc - wejscia[i], kursor, lewa);
            kursor += wysokoscEl(el);
            return html;
        })
        .join('\n      ');

    // Każdy kafel wjeżdża z dołu z przezroczystości — jedna wstrzymana oś czasu.
    const ruchy = elementy
        .map((_, i) => `      tl.from("#el-${i}", { opacity: 0, y: 40, duration: 0.7, ease: "power2.out" }, ${wejscia[i].toFixed(2)});`)
        .join('\n');

    return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${szer}, height=${wys}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      html, body { width:${szer}px; height:${wys}px; overflow:hidden; background:${tlo}; }
      body { font-family:"Segoe UI", system-ui, sans-serif; }
      #root { position:relative; width:100%; height:100%; }
    </style>
  </head>
  <body>
    <div id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${calosc.toFixed(2)}"
      data-width="${szer}"
      data-height="${wys}"
    >
      ${kafle || '<div class="clip" data-start="0" data-duration="4" style="font-size:40px;color:#64748b;">Projekt nie ma elementów.</div>'}
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${ruchy}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

export default { zProjektuAppV2 };
