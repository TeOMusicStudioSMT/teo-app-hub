/**
 * 🧪 Kuźnia w Colabie — Katedra składa gotowy notatnik Google Colab (.ipynb) do treningu własnego modelu
 * TeOgochi na dużej karcie (A100/H100 z planu Google AI Pro Suwerena). Lokalna karta 6 GB nie uniesie
 * LoRA na 26B — Colab tak; po treningu GGUF wraca do Katedry przez Kuźnię Modeli.
 *
 * Dane NIE są zbierane od nowa — biorą je istniejące zbieracze:
 *   · `KuzniaSoup.zbierz` — SFT z wkładów stada z oceną Sędziego ≥ 7 + pary DPO (szkic → po pętli, runda niżej → wyżej);
 *   · `JajoMistrza.kurs()` — `kuznia-soup/mistrz/sft-suwerena.jsonl` i `pary-suwerena.jsonl` (styl Suwerena, agent `mistrz`);
 *   · `kuznia-soup/kodeks/pary-kodeksa.jsonl` — rundy Kodeksa „odrzucona → przyjęta” (dopisane jako DPO dla `kodeks`).
 *
 * UCZCIWIE: dane wklejone do notatnika WYJEŻDŻAJĄ do Google na czas sesji Colab — mówi to pierwsza komórka.
 * Zanim trafią do notatnika: klucze z Kibla (`_OtakOs_Wymiar/kibel_*.txt`) i znane wzory kluczy → [SEKRET-USUNIĘTY],
 * ścieżki z dysku → [ŚCIEŻKA]. Notatnik nie niesie żadnej ścieżki Katedry. Czy trening w Colabie się uda — sprawdza
 * dopiero Colab; tutaj sprawdzamy tylko, że notatnik jest poprawny (JSON nbformat 4, kod Pythona się kompiluje).
 * Wykuty model NIE podmienia silnika sam — decyzja Suwerena (Mózg Katedry / Dyrygent).
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import KuzniaSoup from './KuzniaSoup.js';

export const MIN_SFT = KuzniaSoup.MIN_PROBEK;
export const MIN_DPO = 4;
const ID = /^[a-z0-9-]{2,40}$/;

/**
 * Bazy — id HF wpisane w notatniku jako pole do zmiany (Colab: formularz). Nazwy repozytoriów Gemmy 4
 * sprawdź na huggingface.co przed startem; Gemma wymaga akceptacji warunków na karcie modelu.
 */
export const BAZY = {
    'gemma4-e4b': {
        nazwa: 'Gemma 4 E4B', hf: 'google/gemma-4-E4B-it', metody: ['pelny', 'lora'], domyslna: 'pelny',
        vram: 'Pełny fine-tune: A100 80 GB (bf16, optymalizator 8-bit, gradient checkpointing). LoRA: od ~24 GB.',
    },
    'gemma4-26b-a4b': {
        nazwa: 'Gemma 4 26B A4B (MoE)', hf: 'google/gemma-4-26B-A4B-it', metody: ['lora', 'qlora'], domyslna: 'lora',
        vram: 'LoRA bf16: A100/H100 80 GB (wagi ~52 GB). QLoRA 4-bit: od ~24 GB. Scalanie przed GGUF potrzebuje ~60 GB RAM/VRAM.',
    },
    'gemma4-31b': {
        nazwa: 'Gemma 4 31B', hf: 'google/gemma-4-31B-it', metody: ['qlora'], domyslna: 'qlora',
        vram: 'QLoRA 4-bit: A100 80 GB (wagi ~18 GB + aktywacje). Scalanie przed GGUF: bf16 ~62 GB, dysk Colaba ~150 GB na pliki pośrednie.',
    },
};
export const METODY = {
    pelny: 'Pełny fine-tune (wszystkie wagi)',
    lora: 'LoRA (adapter na wagach bf16)',
    qlora: 'QLoRA (adapter na wagach 4-bit)',
};

/** Wersje przypięte — te same, które działają w środowisku Kuźni Soup Katedry (2026-10-12). */
export const WERSJE = {
    transformers: '5.17.0', trl: '0.29.1', peft: '0.21.1', datasets: '5.0.1',
    accelerate: '1.15.0', bitsandbytes: '0.50.2', llamaCpp: 'b11570',
};

const ZAMAZ_SEKRET = '[SEKRET-USUNIĘTY]';
const ZAMAZ_SCIEZKE = '[ŚCIEŻKA]';
/** Znane kształty kluczy (Anthropic, Gemini/Google, Meshy, TypeSafe/Jev, HuggingFace, OpenAI, GitHub). */
const WZORY_KLUCZY = [
    /sk-ant-[A-Za-z0-9_-]{16,}/g, /AIza[0-9A-Za-z_-]{30,}/g, /msy_[A-Za-z0-9_-]{16,}/g, /apikey_[A-Za-z0-9_-]{16,}/g,
    /hf_[A-Za-z0-9]{20,}/g, /sk-[A-Za-z0-9_-]{32,}/g, /gh[pousr]_[A-Za-z0-9]{30,}/g,
];
const WZORY_SCIEZEK = [
    /(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s"'<>|`]*/g,                      // C:\…, F:/…
    /\\\\[A-Za-z0-9._-]+\\[^\s"'<>|`]*/g,                               // \\serwer\udział
    /(?<![A-Za-z0-9.])\/(?:home|Users|mnt|root|media|var|opt|srv|tmp)\/[^\s"'<>|`]*/g,
];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Zamazuje sekrety i ścieżki w tekście. `sekrety` = dokładne wartości (klucze z Kibla, zmienne środowiska),
 * `sciezki` = prefiksy Katedry (cwd, katalog domowy) — w obu odmianach ukośnika.
 * @returns {{ tekst: string, sekrety: number, sciezki: number }}
 */
export function oczyscTekst(tekst, { sekrety = [], sciezki = [] } = {}) {
    let t = String(tekst ?? ''), ls = 0, lp = 0;
    for (const s of sekrety) {
        if (!s || s.length < 8) continue;
        const re = new RegExp(escRe(s), 'g');
        t = t.replace(re, () => { ls++; return ZAMAZ_SEKRET; });
    }
    for (const re of WZORY_KLUCZY) t = t.replace(re, () => { ls++; return ZAMAZ_SEKRET; });
    for (const p of sciezki) {
        if (!p || p.length < 4) continue;
        for (const w of new Set([p, p.replace(/\\/g, '/'), p.replace(/\//g, '\\')])) {
            t = t.replace(new RegExp(escRe(w) + '[^\\s"\'<>|`]*', 'gi'), () => { lp++; return ZAMAZ_SCIEZKE; });
        }
    }
    for (const re of WZORY_SCIEZEK) t = t.replace(re, () => { lp++; return ZAMAZ_SCIEZKE; });
    return { tekst: t, sekrety: ls, sciezki: lp };
}

/** Oczyść każdy napis w rekordzie (rekurencyjnie). Liczniki dopisuje do `licz`. */
export function oczyscRekord(r, opcje, licz = { sekrety: 0, sciezki: 0 }) {
    if (typeof r === 'string') {
        const o = oczyscTekst(r, opcje);
        licz.sekrety += o.sekrety; licz.sciezki += o.sciezki;
        return o.tekst;
    }
    if (Array.isArray(r)) return r.map((x) => oczyscRekord(x, opcje, licz));
    if (r && typeof r === 'object') return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, oczyscRekord(v, opcje, licz)]));
    return r;
}

const czytajJsonl = async (plik) => {
    try {
        return (await fs.readFile(plik, 'utf8')).split(/\r?\n/).filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
};
const dobreSft = (x) => Array.isArray(x?.messages) && x.messages.some((m) => m?.role === 'assistant' && String(m.content ?? '').trim());
const dobraPara = (x) => typeof x?.prompt === 'string' && typeof x?.chosen === 'string' && typeof x?.rejected === 'string' && x.chosen.trim() && x.chosen !== x.rejected;

/** Wartości kluczy z `_OtakOs_Wymiar/kibel_*.txt` + zmiennych środowiska o nazwach kluczy (do zamazania). */
export async function sekretyKatedry({ katalogWymiaru, env = process.env } = {}) {
    const wynik = [];
    try {
        for (const f of await fs.readdir(katalogWymiaru)) {
            if (!/^kibel_.*\.txt$/i.test(f)) continue;
            const t = (await fs.readFile(path.join(katalogWymiaru, f), 'utf8').catch(() => '')).trim();
            for (const linia of t.split(/\r?\n/)) if (linia.trim().length >= 8) wynik.push(linia.trim());
        }
    } catch { /* brak katalogu = brak kluczy */ }
    for (const [k, v] of Object.entries(env ?? {})) if (/KEY|TOKEN|SECRET|HASLO|PASSWORD/i.test(k) && typeof v === 'string' && v.length >= 12) wynik.push(v);
    return [...new Set(wynik)];
}

const gz64 = (wiersze) => zlib.gzipSync(Buffer.from(wiersze.map((w) => JSON.stringify(w)).join('\n') + (wiersze.length ? '\n' : ''), 'utf8'), { level: 9 }).toString('base64');
/** Długi base64 w liniach po 100 znaków — notatnik da się czytać i diffować. */
const kawalki = (s, n = 100) => { const out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out; };

const md = (linie) => ({ cell_type: 'markdown', metadata: {}, source: zrodlo(linie) });
const kod = (linie) => ({ cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: zrodlo(linie) });
function zrodlo(linie) {
    const l = (Array.isArray(linie) ? linie : String(linie).split('\n'));
    return l.map((x, i) => (i < l.length - 1 ? `${x}\n` : x));
}
const py = (s) => JSON.stringify(String(s));   // literał napisu Pythona (JSON ⊂ Python dla napisów)

/**
 * Notatnik Colab (obiekt nbformat 4). Czysta funkcja — dane już oczyszczone.
 */
export function zbudujNotatnik({ agent, imie, baza, metoda, sft, dpo, zamazane = { sekrety: 0, sciezki: 0 }, data = new Date().toISOString().slice(0, 10) }) {
    const b = BAZY[baza];
    const nazwaModelu = `teogochi-${agent}-colab`;
    const zDpo = dpo.length >= MIN_DPO && metoda !== 'pelny';
    const powodBezDpo = dpo.length < MIN_DPO
        ? `za mało par (${dpo.length}, potrzeba ${MIN_DPO})`
        : 'po pełnym fine-tune DPO potrzebowałoby drugiej pełnej kopii modelu jako odniesienia — nie mieści się; wybierz LoRA/QLoRA';
    const cells = [];

    cells.push(md([
        `# 🧪 Kuźnia w Colabie — ${imie} (\`${nazwaModelu}\`)`,
        '',
        `Notatnik złożony przez Katedrę OtakOS ${data}. Trenuje własny model TeOgochi **${imie}** na bazie **${b.nazwa}** metodą **${METODY[metoda]}**, eksportuje GGUF \`q4_k_m\` i daje go do pobrania.`,
        '',
        '## ⚠️ Uczciwie, zanim klikniesz „Uruchom wszystko”',
        '- **Dane wyjeżdżają z Katedry do Google** na czas sesji Colab: poniżej, w komórce „Dane”, są wklejone przykłady treningowe (praca stada i poprawki Suwerena). Po zamknięciu sesji maszyna Colaba znika, ale dane były na serwerach Google.',
        `- Przed wklejeniem Katedra zamazała klucze z Kibla i znane wzory kluczy (${zamazane.sekrety}×) oraz ścieżki z dysku (${zamazane.sciezki}×). Nic więcej nie wie o tym, co jest w treści — przejrzyj, jeśli masz wątpliwości.`,
        `- **Karta:** ${b.vram} Wybierz w Colabie *Środowisko wykonawcze → Zmień typ → A100 (albo H100)*. Na T4/L4 ta baza się nie zmieści.`,
        '- **Licencja modelu bazowego:** Gemma ma własne warunki Google — przeczytaj je na karcie modelu na Hugging Face (tam też akceptujesz dostęp) zanim użyjesz modelu komercyjnie. Model wytrenowany na tej bazie podlega tym warunkom.',
        `- **Nazwy repozytoriów** (\`${b.hf}\`) wpisała Katedra — sprawdź na huggingface.co, czy się zgadzają; w komórce ustawień można je zmienić.`,
        '- Telemetria wyłączona tam, gdzie się da (`HF_HUB_DISABLE_TELEMETRY`, `DO_NOT_TRACK`, W&B wyłączone, `report_to="none"`). Sam Colab jest usługą Google — jego zbierania danych notatnik nie wyłączy.',
        '- Ten notatnik **nie był uruchamiany przez Katedrę** — sprawdziła tylko, że jest poprawny. Pierwszy przebieg to próba; błędy pokaże Colab.',
        '',
        '## Dane w notatniku',
        `- SFT (chatml): **${sft.length}** przykładów`,
        `- DPO (prompt / chosen / rejected): **${dpo.length}** par — ${zDpo ? 'trening DPO po SFT włączony' : `DPO wyłączone: ${powodBezDpo}`}`,
        '',
        '## Powrót do Katedry (3 kroki)',
        `1. Pobierz \`${nazwaModelu}-q4_k_m.gguf\` (ostatnia komórka — pobranie albo kopia na Dysk Google).`,
        '2. Połóż plik w katalogu Kuźni Modeli Katedry: `_OtakOs_AI/models/`.',
        '3. Hub → TeO-Sim → 🎼 Dyrygent i Kuźnia → 🧪 Kuźnia w Colabie → **📥 Wczytaj wykuty GGUF** (Ollama dostaje model `' + nazwaModelu + '`). Model **nie** podmienia silnika TeOgochi sam — przydział to Twoja decyzja.',
    ]));

    cells.push(md(['## 1. Ustawienia']));
    cells.push(kod([
        '# Ustawienia — w Colabie to formularz (pola po prawej).',
        `BAZA_HF = ${py(b.hf)}  # @param {type:"string"}`,
        `METODA = ${py(metoda)}  # @param ["pelny", "lora", "qlora"]`,
        `NAZWA_MODELU = ${py(nazwaModelu)}  # @param {type:"string"}`,
        `TRENUJ_DPO = ${zDpo ? 'True' : 'False'}  # @param {type:"boolean"}`,
        'EPOKI_SFT = 3  # @param {type:"integer"}',
        'EPOKI_DPO = 1  # @param {type:"integer"}',
        'MAKS_DLUGOSC = 2048  # @param {type:"integer"}',
        'LORA_R = 16  # @param {type:"integer"}',
        '',
        'import os',
        '# Telemetria wyłączona, zanim cokolwiek się zaimportuje.',
        'os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"',
        'os.environ["DO_NOT_TRACK"] = "1"',
        'os.environ["WANDB_DISABLED"] = "true"',
        'os.environ["WANDB_MODE"] = "disabled"',
        'os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"',
        'os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"',
        '',
        'if METODA == "pelny" and TRENUJ_DPO:',
        '    print("DPO po pełnym fine-tune wyłączone: potrzebowałoby drugiej pełnej kopii modelu jako odniesienia.")',
        '    TRENUJ_DPO = False',
        'PRACA = "/content/kuznia"',
        'os.makedirs(PRACA, exist_ok=True)',
        'print("Baza:", BAZA_HF, "| metoda:", METODA, "| DPO:", TRENUJ_DPO)',
    ]));

    cells.push(md(['## 2. Instalacja (wersje przypięte)', '', 'Te same wersje, na których stoi lokalna Kuźnia Soup Katedry. PyTorch zostaje ten, który daje Colab.']));
    cells.push(kod([
        'import subprocess, sys',
        'PAKIETY = [',
        ...['transformers', 'trl', 'peft', 'datasets', 'accelerate', 'bitsandbytes'].map((p) => `    ${py(`${p}==${WERSJE[p]}`)},`),
        '    "sentencepiece", "protobuf",',
        ']',
        'subprocess.run([sys.executable, "-m", "pip", "install", "-q", *PAKIETY], check=True)',
        '',
        'import torch',
        'if not torch.cuda.is_available():',
        '    raise SystemExit("Brak karty graficznej — zmień typ środowiska wykonawczego na A100/H100.")',
        'nazwa_karty = torch.cuda.get_device_name(0)',
        'vram_gb = torch.cuda.get_device_properties(0).total_memory / 1024**3',
        'print(f"Karta: {nazwa_karty}, {vram_gb:.0f} GB")',
        'POTRZEBA_GB = {"pelny": 75, "lora": 70 if "26B" in BAZA_HF or "31B" in BAZA_HF else 22, "qlora": 22}[METODA]',
        'if vram_gb < POTRZEBA_GB:',
        '    print(f"⚠️ Ta baza i metoda potrzebują ok. {POTRZEBA_GB} GB VRAM, a karta ma {vram_gb:.0f} GB — trening najpewniej padnie na braku pamięci.")',
    ]));

    cells.push(md(['## 3. Dane', '', 'Wklejone przez Katedrę (gzip + base64, bez kluczy i ścieżek). Komórka zapisuje je jako `sft.jsonl` i `dpo.jsonl` w `/content/kuznia`.']));
    cells.push(kod([
        'import base64, gzip, json',
        'SFT_GZ_B64 = (',
        ...kawalki(gz64(sft)).map((k) => `    ${py(k)}`),
        ')',
        'DPO_GZ_B64 = (',
        ...(dpo.length ? kawalki(gz64(dpo)).map((k) => `    ${py(k)}`) : ['    ""']),
        ')',
        '',
        'def rozpakuj(b64):',
        '    if not b64:',
        '        return []',
        '    tekst = gzip.decompress(base64.b64decode(b64)).decode("utf-8")',
        '    return [json.loads(l) for l in tekst.splitlines() if l.strip()]',
        '',
        'sft_wiersze = rozpakuj(SFT_GZ_B64)',
        'dpo_wiersze = rozpakuj(DPO_GZ_B64)',
        'for nazwa, wiersze in (("sft.jsonl", sft_wiersze), ("dpo.jsonl", dpo_wiersze)):',
        '    with open(os.path.join(PRACA, nazwa), "w", encoding="utf-8") as f:',
        '        for w in wiersze:',
        '            f.write(json.dumps(w, ensure_ascii=False) + "\\n")',
        'print(f"SFT: {len(sft_wiersze)} przykładów, DPO: {len(dpo_wiersze)} par")',
        `assert len(sft_wiersze) == ${sft.length}, "dane SFT uszkodzone"`,
    ]));

    cells.push(md([
        '## 4. Dostęp do modelu bazowego',
        '',
        'Gemma jest za zgodą: zaakceptuj warunki na karcie modelu na huggingface.co, potem zaloguj się tokenem HF (*read*). Token wpisujesz w okienku Colaba albo trzymasz w *Sekretach* Colaba jako `HF_TOKEN` — **nie wklejaj go do kodu notatnika**.',
    ]));
    cells.push(kod([
        'from huggingface_hub import login',
        'try:',
        '    from google.colab import userdata',
        '    token = userdata.get("HF_TOKEN")',
        'except Exception:',
        '    token = None',
        'if token:',
        '    login(token=token, add_to_git_credential=False)',
        'else:',
        '    login()  # okienko z polem na token',
    ]));

    cells.push(md(['## 5. Model bazowy i szablon rozmowy']));
    cells.push(kod([
        'from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig',
        '',
        'tokenizer = AutoTokenizer.from_pretrained(BAZA_HF)',
        'if tokenizer.pad_token is None:',
        '    tokenizer.pad_token = tokenizer.eos_token',
        '',
        'def zaladuj_model():',
        '    opcje = dict(torch_dtype=torch.bfloat16, device_map="auto", attn_implementation="sdpa")',
        '    if METODA == "qlora":',
        '        opcje["quantization_config"] = BitsAndBytesConfig(',
        '            load_in_4bit=True, bnb_4bit_quant_type="nf4",',
        '            bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)',
        '    return AutoModelForCausalLM.from_pretrained(BAZA_HF, **opcje)',
        '',
        'model = zaladuj_model()',
        'model.config.use_cache = False',
        '',
        '# Szablon bez roli „system”? Wtedy karta roli idzie na początek pierwszej wiadomości użytkownika.',
        'def bez_systemu(wiadomosci):',
        '    if not wiadomosci or wiadomosci[0].get("role") != "system":',
        '        return wiadomosci',
        '    system, reszta = wiadomosci[0]["content"], [dict(m) for m in wiadomosci[1:]]',
        '    if reszta and reszta[0].get("role") == "user":',
        '        reszta[0]["content"] = system + "\\n\\n" + reszta[0]["content"]',
        '    return reszta',
        '',
        'try:',
        '    tokenizer.apply_chat_template(sft_wiersze[0]["messages"], tokenize=False)',
        '    SYSTEM_W_SZABLONIE = True',
        'except Exception as e:',
        '    print("Szablon nie zna roli system — przenoszę ją do pierwszej wiadomości:", e)',
        '    SYSTEM_W_SZABLONIE = False',
        'if not SYSTEM_W_SZABLONIE:',
        '    sft_wiersze = [{"messages": bez_systemu(w["messages"])} for w in sft_wiersze]',
    ]));

    cells.push(md(['## 6. Trening SFT', '', 'Pełny fine-tune: wszystkie wagi, optymalizator 8-bit. LoRA/QLoRA: adapter na warstwach uwagi i MLP.']));
    cells.push(kod([
        'from datasets import Dataset',
        'from peft import LoraConfig',
        'from trl import SFTConfig, SFTTrainer',
        '',
        'zbior_sft = Dataset.from_list(sft_wiersze)',
        'peft_config = None',
        'if METODA in ("lora", "qlora"):',
        '    peft_config = LoraConfig(r=LORA_R, lora_alpha=LORA_R * 2, lora_dropout=0.05, bias="none",',
        '                             target_modules="all-linear", task_type="CAUSAL_LM")',
        '',
        'konfig_sft = SFTConfig(',
        '    output_dir=os.path.join(PRACA, "sft"),',
        '    num_train_epochs=EPOKI_SFT,',
        '    per_device_train_batch_size=1,',
        '    gradient_accumulation_steps=8,',
        '    learning_rate=1e-5 if METODA == "pelny" else 2e-4,',
        '    lr_scheduler_type="cosine",',
        '    warmup_ratio=0.05,',
        '    max_length=MAKS_DLUGOSC,',
        '    bf16=True,',
        '    gradient_checkpointing=True,',
        '    optim="adamw_8bit" if METODA == "pelny" else "adamw_torch_fused",',
        '    logging_steps=5,',
        '    save_strategy="no",',
        '    report_to="none",',
        ')',
        'trener = SFTTrainer(model=model, args=konfig_sft, train_dataset=zbior_sft,',
        '                    processing_class=tokenizer, peft_config=peft_config)',
        'trener.train()',
        'model = trener.model',
        'KATALOG_SFT = os.path.join(PRACA, "po-sft")',
        'trener.save_model(KATALOG_SFT)',
        'tokenizer.save_pretrained(KATALOG_SFT)',
        'print("SFT gotowe →", KATALOG_SFT)',
    ]));

    cells.push(md([
        '## 7. DPO (opcjonalnie)',
        '',
        'Pary „gorzej → lepiej” z pracy stada i poprawek Suwerena. Tylko dla LoRA/QLoRA — odniesieniem jest model bez adaptera, więc nie trzeba drugiej kopii.',
    ]));
    cells.push(kod([
        'if TRENUJ_DPO and dpo_wiersze:',
        '    from trl import DPOConfig, DPOTrainer',
        '    def rozmowa(w):',
        '        return {"prompt": [{"role": "user", "content": w["prompt"]}],',
        '                "chosen": [{"role": "assistant", "content": w["chosen"]}],',
        '                "rejected": [{"role": "assistant", "content": w["rejected"]}]}',
        '    zbior_dpo = Dataset.from_list([rozmowa(w) for w in dpo_wiersze])',
        '    konfig_dpo = DPOConfig(',
        '        output_dir=os.path.join(PRACA, "dpo"),',
        '        num_train_epochs=EPOKI_DPO,',
        '        per_device_train_batch_size=1,',
        '        gradient_accumulation_steps=8,',
        '        learning_rate=5e-6,',
        '        beta=0.1,',
        '        max_length=MAKS_DLUGOSC,',
        '        bf16=True,',
        '        gradient_checkpointing=True,',
        '        logging_steps=5,',
        '        save_strategy="no",',
        '        report_to="none",',
        '    )',
        '    trener_dpo = DPOTrainer(model=model, ref_model=None, args=konfig_dpo,',
        '                            train_dataset=zbior_dpo, processing_class=tokenizer)',
        '    trener_dpo.train()',
        '    model = trener_dpo.model',
        '    trener_dpo.save_model(KATALOG_SFT)',
        '    print("DPO gotowe →", KATALOG_SFT)',
        'else:',
        `    print(${py(`DPO pominięte: ${zDpo ? 'wyłączone w ustawieniach' : powodBezDpo}.`)})`,
    ]));

    cells.push(md(['## 8. Scalenie wag', '', 'LoRA/QLoRA: adapter łączony z bazą w bf16 (dla QLoRA baza wczytana od nowa w pełnej precyzji — scalanie w 4 bitach psuje wagi). Pełny fine-tune: model już jest kompletny.']));
    cells.push(kod([
        'import gc, shutil',
        'KATALOG_SCALONY = os.path.join(PRACA, "scalony")',
        'if METODA == "pelny":',
        '    model.save_pretrained(KATALOG_SCALONY, safe_serialization=True)',
        'else:',
        '    from peft import PeftModel',
        '    del model, trener',
        '    if "trener_dpo" in globals():',
        '        del trener_dpo',
        '    gc.collect(); torch.cuda.empty_cache()',
        '    baza = AutoModelForCausalLM.from_pretrained(BAZA_HF, torch_dtype=torch.bfloat16, device_map="auto")',
        '    scalony = PeftModel.from_pretrained(baza, KATALOG_SFT).merge_and_unload()',
        '    scalony.save_pretrained(KATALOG_SCALONY, safe_serialization=True)',
        '    del baza, scalony',
        'tokenizer.save_pretrained(KATALOG_SCALONY)',
        'gc.collect(); torch.cuda.empty_cache()',
        'print("Scalony model →", KATALOG_SCALONY)',
    ]));

    cells.push(md(['## 9. Eksport GGUF q4_k_m', '', `llama.cpp przypięty do tagu \`${WERSJE.llamaCpp}\`: konwersja do bf16 GGUF, potem kwantyzacja \`q4_k_m\` (ten sam format, co Kuźnia Soup). Plik pośredni jest kasowany.`]));
    cells.push(kod([
        `LLAMA_REF = ${py(WERSJE.llamaCpp)}`,
        'LLAMA = "/content/llama.cpp"',
        'if not os.path.isdir(LLAMA):',
        '    subprocess.run(["git", "clone", "--depth", "1", "--branch", LLAMA_REF, "https://github.com/ggml-org/llama.cpp", LLAMA], check=True)',
        'subprocess.run([sys.executable, "-m", "pip", "install", "-q", os.path.join(LLAMA, "gguf-py")], check=True)',
        'subprocess.run(["cmake", "-S", LLAMA, "-B", os.path.join(LLAMA, "build"), "-DGGML_CUDA=OFF", "-DLLAMA_CURL=OFF"], check=True)',
        'subprocess.run(["cmake", "--build", os.path.join(LLAMA, "build"), "--target", "llama-quantize", "-j", str(os.cpu_count() or 4)], check=True)',
        '',
        'GGUF_BF16 = os.path.join(PRACA, NAZWA_MODELU + "-bf16.gguf")',
        'GGUF_Q4 = os.path.join(PRACA, NAZWA_MODELU + "-q4_k_m.gguf")',
        'subprocess.run([sys.executable, os.path.join(LLAMA, "convert_hf_to_gguf.py"), KATALOG_SCALONY,',
        '                "--outfile", GGUF_BF16, "--outtype", "bf16"], check=True)',
        'kwantyzator = os.path.join(LLAMA, "build", "bin", "llama-quantize")',
        'subprocess.run([kwantyzator, GGUF_BF16, GGUF_Q4, "Q4_K_M"], check=True)',
        'os.remove(GGUF_BF16)',
        'print(f"GGUF gotowy: {GGUF_Q4} ({os.path.getsize(GGUF_Q4) / 1024**3:.1f} GB)")',
    ]));

    cells.push(md(['## 10. Pobranie', '', 'Pliki kilku GB przeglądarka pobiera kapryśnie — pewniej przez Dysk Google (ustaw `NA_DYSK = True`).']));
    cells.push(kod([
        'NA_DYSK = False  # @param {type:"boolean"}',
        'if NA_DYSK:',
        '    from google.colab import drive',
        '    drive.mount("/content/drive")',
        '    cel = os.path.join("/content/drive/MyDrive", os.path.basename(GGUF_Q4))',
        '    shutil.copy(GGUF_Q4, cel)',
        '    print("Na Dysku Google:", cel)',
        'else:',
        '    from google.colab import files',
        '    files.download(GGUF_Q4)',
        'print("Dalej: plik do _OtakOs_AI/models/ w Katedrze → 🧪 Kuźnia w Colabie → 📥 Wczytaj wykuty GGUF.")',
    ]));

    return {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: {
            accelerator: 'GPU',
            colab: { name: `${nazwaModelu}.ipynb`, provenance: [], machine_shape: 'hm', gpuType: 'A100' },
            kernelspec: { name: 'python3', display_name: 'Python 3', language: 'python' },
            language_info: { name: 'python', file_extension: '.py', mimetype: 'text/x-python' },
            otakos: { agent, baza, metoda, sft: sft.length, dpo: dpo.length, utworzono: data },
        },
        cells: cells.map((c, i) => ({ ...c, id: `kuznia-${String(i).padStart(2, '0')}` })),
    };
}

/**
 * @param {{ katalogKuzni: string, katalogWymiaru: string, projekty: () => Promise<object[]>, karta: (id:string) => Promise<{tresc?:string, imie?:string}|null>,
 *           kursMistrza?: () => Promise<unknown>, sciezki?: string[], env?: object }} o
 */
export function utworzKuznieColab({ katalogKuzni, katalogWymiaru, projekty, karta, kursMistrza = null, sciezki = [process.cwd(), os.homedir()], env = process.env }) {
    /** Dane dla agenta z istniejących zbieraczy. `mistrz` = styl Suwerena z JaJa; reszta = praca stada (+ rundy Kodeksa). */
    async function dane(agent) {
        if (!ID.test(String(agent ?? ''))) throw new Error('Zły identyfikator TeOgochi.');
        const k = await karta(agent).catch(() => null);
        const imie = k?.imie ?? agent;
        let sft = [], dpo = [], zrodla = [], pominiete = null;
        if (agent === 'mistrz') {
            if (kursMistrza) await kursMistrza().catch(() => null);   // odśwież pliki JaJa z obserwacji
            sft = await czytajJsonl(path.join(katalogKuzni, 'mistrz', 'sft-suwerena.jsonl'));
            dpo = await czytajJsonl(path.join(katalogKuzni, 'mistrz', 'pary-suwerena.jsonl'));
            zrodla = ['JaJo Mistrza: poprawki Suwerena'];
        } else {
            const z = KuzniaSoup.zbierz(await projekty(), { agent, kartaRoli: k?.tresc ?? '' });
            sft = z.sft; dpo = z.pary; pominiete = z.pominiete;
            zrodla = ['praca stada (Sędzia ≥ ' + KuzniaSoup.PROG_OCENY + '/10)'];
            if (agent === 'kodeks') {
                if (kursMistrza) await kursMistrza().catch(() => null);
                const pk = await czytajJsonl(path.join(katalogKuzni, 'kodeks', 'pary-kodeksa.jsonl'));
                if (pk.length) { dpo = [...dpo, ...pk]; zrodla.push('rundy Kodeksa (odrzucona → przyjęta)'); }
            }
        }
        return { agent, imie, sft: sft.filter(dobreSft), dpo: dpo.filter(dobraPara), pominiete, zrodla };
    }

    const powodBraku = (d) => d.sft.length >= MIN_SFT ? null
        : d.agent === 'mistrz'
            ? `Za mało poprawek Suwerena do nauki: ${d.sft.length} (potrzeba ${MIN_SFT}). JaJo zbiera je przy każdej Twojej poprawce kwestii i publikacji.`
            : `Za mało dobrej pracy ${d.imie}: ${d.sft.length} wkładów z oceną ≥ ${KuzniaSoup.PROG_OCENY}/10 (potrzeba ${MIN_SFT})` +
              (d.pominiete ? ` — pominięte: ${d.pominiete.bezOceny} bez oceny Sędziego, ${d.pominiete.slabe} słabszych.` : '.') + ' Więcej rund doskonalenia da więcej ocenionej pracy.';

    async function stan(agent = 'mistrz') {
        const d = await dane(agent);
        const powod = powodBraku(d);
        return {
            agent: d.agent, imie: d.imie, sft: d.sft.length, dpo: d.dpo.length, zrodla: d.zrodla, pominiete: d.pominiete,
            wystarczy: !powod, powod, minimum: MIN_SFT, minimumDpo: MIN_DPO,
            dpoPowod: d.dpo.length < MIN_DPO ? `DPO wymaga ${MIN_DPO} par (jest ${d.dpo.length}) — notatnik zrobi samo SFT.` : null,
            bazy: Object.entries(BAZY).map(([id, b]) => ({ id, ...b })), metody: METODY,
            modelPoPowrocie: `teogochi-${d.agent}-colab`,
        };
    }

    async function notatnik({ baza = 'gemma4-e4b', metoda, agent = 'mistrz' } = {}) {
        const b = BAZY[baza];
        if (!b) throw new Error(`Nieznana baza „${baza}”. Do wyboru: ${Object.keys(BAZY).join(', ')}.`);
        const m = metoda || b.domyslna;
        if (!b.metody.includes(m)) throw new Error(`${b.nazwa} w Colabie: metoda ${m} odpada (${b.vram}). Do wyboru: ${b.metody.map((x) => METODY[x]).join(', ')}.`);
        const d = await dane(agent);
        const powod = powodBraku(d);
        if (powod) throw new Error(powod);
        const opcje = { sekrety: await sekretyKatedry({ katalogWymiaru, env }), sciezki: sciezki.filter(Boolean) };
        const licz = { sekrety: 0, sciezki: 0 };
        const sft = d.sft.map((r) => oczyscRekord(r, opcje, licz));
        const dpo = d.dpo.map((r) => oczyscRekord(r, opcje, licz));
        const nb = zbudujNotatnik({ agent: d.agent, imie: d.imie, baza, metoda: m, sft, dpo, zamazane: licz });
        return { nazwa: `kuznia-colab-${d.agent}-${baza}-${m}.ipynb`, notatnik: nb, sft: sft.length, dpo: dpo.length, zamazane: licz };
    }

    return { dane, stan, notatnik };
}

export default { utworzKuznieColab, zbudujNotatnik, oczyscTekst, oczyscRekord, sekretyKatedry, BAZY, METODY, WERSJE, MIN_SFT, MIN_DPO };
