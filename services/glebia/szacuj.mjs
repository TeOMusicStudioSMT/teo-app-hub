/**
 * 🧊 Liczenie głębi w OSOBNYM procesie (services/GlebiaKadru.js → szacujModelem).
 *
 * Suweren 2026-10-05: most „padł”, gdy ruszyło ożywianie ujęcia. ONNX Runtime to kod natywny — jego twardy błąd
 * (dostęp do pamięci, brak RAM) zabija proces bez wyjątku w JS. W osobnym procesie zabija tylko ten proces,
 * a most dostaje kod wyjścia i ogon stderr i mówi to wprost.
 *
 * Wejście (argv[2] = JSON): { model, rgb, szer, wys, wyjscie } — `rgb` = plik surowych bajtów RGB (HWC) w rozmiarze
 * wejścia modelu (przygotował ffmpeg w moście). Wyjście: `wyjscie` = surowe bajty głębi 0–255, stdout = {szer, wys}.
 */
import fs from 'fs';
import { tensorObrazu, bajtyGlebi } from '../GlebiaKadru.js';

const { model, rgb, szer, wys, wyjscie } = JSON.parse(process.argv[2] ?? '{}');
const modul = await import('onnxruntime-node');
const ort = modul.default ?? modul;
const sesja = await ort.InferenceSession.create(model);
const piksele = fs.readFileSync(rgb);
if (piksele.length < szer * wys * 3) throw new Error(`za mało pikseli obrazu (${piksele.length} < ${szer * wys * 3})`);
const wej = new ort.Tensor('float32', tensorObrazu(piksele, szer, wys), [1, 3, wys, szer]);
const wyj = (await sesja.run({ [sesja.inputNames[0]]: wej }))[sesja.outputNames[0]];
const [h, w] = wyj.dims.slice(-2);
fs.writeFileSync(wyjscie, Buffer.from(bajtyGlebi(wyj.data)));
process.stdout.write(JSON.stringify({ szer: w, wys: h }));
