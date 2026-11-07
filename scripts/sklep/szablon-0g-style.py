"""
🎨 Szablon Shopify „0.00G Style” z eksportu Dawn (2026-11-07).

Bierze rozpakowany eksport Dawn z _OtakOs_Wymiar/sklep-shopify/theme_export__*/ (oryginał zostaje nietknięty),
kopiuje go do katalogu roboczego, przerabia i pakuje do _OtakOs_Wymiar/sklep-shopify/0.00G-Style-Dawn-Theme.zip
(w korzeniu archiwum: assets/ config/ layout/ locales/ sections/ snippets/ templates/).

Zmiany:
  • config/settings_data.json — schematy kolorów 0.00G: tło #0b0c10, tekst #f4f1ea, przyciski złoto #d4a853
  • assets/base.css — dopisany blok „0.00G Style” (akcenty złota, linki, odstępy liter nagłówków)
  • sections/header-group.json — pasek ogłoszeń: QR na metce → prywatny taniec 3D + bonus GRV
  • sections/0g-hero.liquid (NOWA) — baner z obrazem z assets/ (image-banner Dawn przyjmuje tylko obraz z plików
    sklepu, nie z szablonu), tytuł, podtytuł, przyciski
  • templates/index.json — 0g-hero → multicolumn „3 kroki metki QR” → featured-collection (zostaje)
  • sections/footer-group.json — blok tekstu Cor-TeO · 0.00G Style + linki teo.center, teostory.studio
Użycie: python scripts/sklep/szablon-0g-style.py <katalog-eksportu> <obraz-banera.png> [wyjście.zip]
"""
import json, re, shutil, subprocess, sys, zipfile
from pathlib import Path

ZLOTO, TLO, TLO2, TEKST = '#d4a853', '#0b0c10', '#14161c', '#f4f1ea'
KATALOGI = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates']

def wczytaj(p):
    # pliki JSON szablonu Shopify mogą mieć na górze komentarz /* … */ — zachowujemy go
    t = p.read_text(encoding='utf-8')
    m = re.match(r'\s*(/\*.*?\*/)\s*', t, re.S)
    return (m.group(1) if m else ''), json.loads(t[m.end():] if m else t)

def zapisz(p, glowa, dane):
    p.write_text((glowa + '\n' if glowa else '') + json.dumps(dane, ensure_ascii=False, indent=2), encoding='utf-8')

def schemat(tlo, tekst, przycisk, etykieta, drugi):
    return {'settings': {'background': tlo, 'background_gradient': '', 'text': tekst, 'button': przycisk, 'button_label': etykieta, 'secondary_button_label': drugi, 'shadow': '#000000'}}

HERO = r'''{%- comment -%} 0.00G Style — baner z obrazem z assets/ szablonu (image-banner Dawn przyjmuje tylko obraz z plików sklepu). {%- endcomment -%}
<div class="og-hero color-{{ section.settings.color_scheme }} gradient">
  <div class="og-hero__inner page-width">
    <div class="og-hero__text">
      {%- if section.settings.kicker != blank -%}<p class="og-hero__kicker">{{ section.settings.kicker | escape }}</p>{%- endif -%}
      <h1 class="og-hero__title h0">{{ section.settings.heading | escape }}</h1>
      {%- if section.settings.subheading != blank -%}<p class="og-hero__sub">{{ section.settings.subheading | escape }}</p>{%- endif -%}
      <div class="og-hero__buttons">
        {%- if section.settings.button_label != blank -%}<a class="button" href="{{ section.settings.button_link | default: routes.all_products_collection_url }}">{{ section.settings.button_label | escape }}</a>{%- endif -%}
        {%- if section.settings.button_label_2 != blank -%}<a class="button button--secondary" href="{{ section.settings.button_link_2 }}">{{ section.settings.button_label_2 | escape }}</a>{%- endif -%}
      </div>
    </div>
    <div class="og-hero__media">
      {%- if section.settings.image != blank -%}
        {{ section.settings.image | image_url: width: 1400 | image_tag: loading: 'eager', class: 'og-hero__img', alt: section.settings.heading }}
      {%- elsif section.settings.asset_image != blank -%}
        <img class="og-hero__img" src="{{ section.settings.asset_image | asset_url }}" alt="{{ section.settings.heading | escape }}" width="1200" height="1200" loading="eager">
      {%- endif -%}
    </div>
  </div>
</div>
{% schema %}
{
  "name": "0.00G Hero",
  "tag": "section",
  "class": "section",
  "settings": [
    { "type": "text", "id": "kicker", "label": "Kicker", "default": "Cor-TeO · 0.00G Style" },
    { "type": "text", "id": "heading", "label": "Heading", "default": "0.00G STYLE — From 0 & 1 to Infinity" },
    { "type": "text", "id": "subheading", "label": "Subheading", "default": "Wearable Stories, High-Precision Embroidery & Private Avatar Dance on Every Tag" },
    { "type": "image_picker", "id": "image", "label": "Image (from Files — overrides the theme asset)" },
    { "type": "text", "id": "asset_image", "label": "Theme asset image file name", "default": "0g-hero-borowik.jpg" },
    { "type": "text", "id": "button_label", "label": "Button label", "default": "Shop the collection" },
    { "type": "url", "id": "button_link", "label": "Button link" },
    { "type": "text", "id": "button_label_2", "label": "Second button label", "default": "How the QR tag works" },
    { "type": "url", "id": "button_link_2", "label": "Second button link" },
    { "type": "color_scheme", "id": "color_scheme", "label": "t:sections.all.colors.label", "default": "scheme-3" }
  ],
  "presets": [{ "name": "0.00G Hero" }]
}
{% endschema %}
'''

CSS = f'''
/* ── 0.00G Style (Cor-TeO) — dopisane do Dawn ───────────────────────────── */
:root {{ --og-zloto: {ZLOTO}; --og-tlo: {TLO}; --og-krem: {TEKST}; }}
.h0, h1, h2, .h1, .h2 {{ letter-spacing: 0.04em; }}
a:not(.button):hover {{ color: var(--og-zloto); }}
.button:not(.button--secondary) {{ box-shadow: 0 0 0 1px var(--og-zloto), 0 8px 30px rgba(212, 168, 83, 0.15); }}
.announcement-bar__message {{ letter-spacing: 0.08em; }}
.og-hero {{ padding: 5rem 0 4rem; background: radial-gradient(1200px 600px at 70% 40%, rgba(212,168,83,0.10), transparent 60%), var(--og-tlo); }}
.og-hero__inner {{ display: grid; gap: 3rem; align-items: center; grid-template-columns: 1fr; }}
@media screen and (min-width: 990px) {{ .og-hero__inner {{ grid-template-columns: 1.1fr 0.9fr; }} }}
.og-hero__kicker {{ color: var(--og-zloto); text-transform: uppercase; letter-spacing: 0.3em; font-size: 1.2rem; margin: 0 0 1.2rem; }}
.og-hero__title {{ margin: 0 0 1.6rem; color: var(--og-krem); }}
.og-hero__sub {{ font-size: 1.7rem; line-height: 1.6; color: rgba(244, 241, 234, 0.75); max-width: 52rem; margin: 0 0 2.6rem; }}
.og-hero__buttons {{ display: flex; flex-wrap: wrap; gap: 1rem; }}
.og-hero__img {{ width: 100%; height: auto; border-radius: 2rem; box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,83,0.25); }}
.multicolumn-card__info .inline-richtext a, .rich-text a {{ color: var(--og-zloto); }}
'''

def main():
    zrodlo = Path(sys.argv[1]); obraz = Path(sys.argv[2])
    wyjscie = Path(sys.argv[3]) if len(sys.argv) > 3 else zrodlo.parent / '0.00G-Style-Dawn-Theme.zip'
    for k in KATALOGI:
        if not (zrodlo / k).is_dir(): raise SystemExit(f'To nie jest eksport szablonu Shopify — brak {k}/ w {zrodlo}')
    robocze = wyjscie.with_suffix('')  # katalog roboczy obok zipa
    if robocze.exists(): shutil.rmtree(robocze)
    shutil.copytree(zrodlo, robocze)

    # kolory
    glowa, d = wczytaj(robocze / 'config/settings_data.json')
    cel = d['presets'][d['current']] if isinstance(d['current'], str) else d['current']
    cel['color_schemes'] = {
        'scheme-1': schemat(TLO, TEKST, ZLOTO, TLO, ZLOTO),
        'scheme-2': schemat(TLO2, TEKST, ZLOTO, TLO, ZLOTO),
        'scheme-3': schemat('#07080b', TEKST, ZLOTO, TLO, TEKST),
        'scheme-4': schemat(ZLOTO, TLO, TLO, ZLOTO, TLO),
        'scheme-5': schemat('#1b1a17', TEKST, ZLOTO, TLO, ZLOTO),
    }
    zapisz(robocze / 'config/settings_data.json', glowa, d)

    # pasek ogłoszeń
    glowa, h = wczytaj(robocze / 'sections/header-group.json')
    bar = h['sections']['announcement-bar']
    for b in bar['blocks'].values():
        if b.get('type') == 'announcement':
            b['settings']['text'] = '0.00G STYLE · Scan the QR tag inside your garment for a private 3D dance & +GRV bonus'
            b['settings']['link'] = ''
    bar['settings']['color_scheme'] = 'scheme-4'
    zapisz(robocze / 'sections/header-group.json', glowa, h)

    # baner + 3 kroki
    (robocze / 'sections/0g-hero.liquid').write_text(HERO, encoding='utf-8')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(obraz), '-vf', 'scale=1200:-2', '-q:v', '3', str(robocze / 'assets/0g-hero-borowik.jpg')], check=True)
    glowa, ix = wczytaj(robocze / 'templates/index.json')
    s = ix['sections']
    s.pop('image_banner', None)
    s['og_hero'] = {'type': '0g-hero', 'settings': {'kicker': 'Cor-TeO · 0.00G Style', 'heading': '0.00G STYLE — From 0 & 1 to Infinity',
        'subheading': 'Wearable Stories, High-Precision Embroidery & Private Avatar Dance on Every Tag', 'asset_image': '0g-hero-borowik.jpg',
        'button_label': 'Shop the collection', 'button_link': 'shopify://collections/all', 'button_label_2': 'How the QR tag works', 'button_link_2': '#og-qr', 'color_scheme': 'scheme-3'}}
    s['og_qr'] = {'type': 'multicolumn', 'blocks': {
        'krok1': {'type': 'column', 'settings': {'title': '1. Wear the Story', 'text': '<p>Every 0.00G piece carries a character and a story from the TeOgochi Mini series — embroidered and printed with high precision.</p>', 'link_label': '', 'link': ''}},
        'krok2': {'type': 'column', 'settings': {'title': '2. Scan Your Unique QR Tag', 'text': '<p>Inside your garment there is a one-time QR tag. Scan it — it opens <a href="https://qr.teo.center" target="_blank">qr.teo.center</a> just for you.</p>', 'link_label': '', 'link': ''}},
        'krok3': {'type': 'column', 'settings': {'title': '3. Unlock Your Private Dance & +GRV', 'text': '<p>Choose your dancer: a private 3D dance is recorded only for your tag — plus a GRV bonus for your own Cathedral.</p>', 'link_label': '', 'link': ''}},
    }, 'block_order': ['krok1', 'krok2', 'krok3'], 'settings': {'title': 'The magic of the QR tag', 'heading_size': 'h1', 'image_width': 'third', 'image_ratio': 'adapt',
        'columns_desktop': 3, 'column_alignment': 'center', 'background_style': 'none', 'button_label': '', 'button_link': '', 'color_scheme': 'scheme-2', 'columns_mobile': '1',
        'swipe_on_mobile': False, 'padding_top': 56, 'padding_bottom': 56}}
    ix['order'] = ['og_hero', 'og_qr'] + [k for k in ix['order'] if k not in ('image_banner', 'og_hero', 'og_qr')]
    zapisz(robocze / 'templates/index.json', glowa, ix)

    # stopka
    glowa, f = wczytaj(robocze / 'sections/footer-group.json')
    st = f['sections']['footer']
    st.setdefault('blocks', {})['og_marka'] = {'type': 'text', 'settings': {'heading': 'Cor-TeO · 0.00G Style',
        'subtext': '<p>Wearable stories from the OtakOS Cathedral. <a href="https://teo.center" target="_blank">teo.center</a> · <a href="https://teostory.studio" target="_blank">teostory.studio</a> · <a href="https://qr.teo.center" target="_blank">qr.teo.center</a></p>'}}
    st['block_order'] = ['og_marka'] + [k for k in st.get('block_order', []) if k != 'og_marka']
    st['settings']['newsletter_heading'] = 'Stories, drops & new characters — straight to your inbox'
    zapisz(robocze / 'sections/footer-group.json', glowa, f)

    # CSS
    with open(robocze / 'assets/base.css', 'a', encoding='utf-8') as c: c.write(CSS)

    # zip: katalogi szablonu w korzeniu, ukośniki „/”
    if wyjscie.exists(): wyjscie.unlink()
    with zipfile.ZipFile(wyjscie, 'w', zipfile.ZIP_DEFLATED) as z:
        for k in KATALOGI:
            for p in sorted((robocze / k).rglob('*')):
                if p.is_file(): z.write(p, p.relative_to(robocze).as_posix())
    shutil.rmtree(robocze)
    print(json.dumps({'zip': str(wyjscie), 'bajtow': wyjscie.stat().st_size, 'plikow': len(zipfile.ZipFile(wyjscie).namelist())}, ensure_ascii=False))

if __name__ == '__main__':
    main()
