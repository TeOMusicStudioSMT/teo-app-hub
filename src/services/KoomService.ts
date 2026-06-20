/**
 * 📖 KoomService — Księga Odbioru (KsięgOOdbioreM)
 *
 * Zbiera rozmowy z Rozczytelni (Podcast Twin), DEKODUJE je na konkretne plany/
 * zadania i przekształca w zlecenia dla Mechanika. Miejsce, gdzie agenci zostawiają
 * sugestie planów, a Suweren jednym klikiem wysyła je do realizacji.
 *
 * ⚡ Oszczędność tokenów (limit 1M): ekstrakcja planów to LOKALNA heurystyka (regex,
 * zero tokenów). Multi-modeling korzysta z LOKALNYCH modeli Ollamy (też darmowe).
 * Chmura nie jest tu używana.
 */

const BRIDGE = 'http://127.0.0.1:3001';

export interface KoomPlan {
    id:        string;
    text:      string;
    source:    string;        // ISKRA | ECHO | SUWEREN | model
    status:    'NEW' | 'QUEUED';
    taskId?:   string;        // gdy wysłane do Mechanika
    createdAt: string;
}

export interface ModelTake { model: string; analysis: string; }

// Frazy sygnalizujące plan/sugestię w wypowiedzi gospodarzy.
const PLAN_HINTS = /(powinni[śs]my|trzeba|warto|zbud(ujmy|ować)|dodaj(my)?|doda[ćc]|stwórz(my)?|stworzy[ćc]|zaimplement\w*|wdró[żz]\w*|napraw(my|i[ćc])?|propon\w*|plan(em|y|ie)?|pomys[łl]\w*|mogliby[śs]my|zróbmy|nale[żz]y|kluczowe jest|zaprojekt\w*)/i;

export class KoomService {
    /** Ekstrakcja planów z tur rozmowy — czysta heurystyka, ZERO tokenów. */
    static extractPlans(turns: Array<{ hostA?: string; hostB?: string }>): KoomPlan[] {
        const out: KoomPlan[] = [];
        const seen = new Set<string>();
        turns.forEach((t, ti) => {
            ([['ISKRA', t.hostA], ['ECHO', t.hostB]] as const).forEach(([who, raw]) => {
                String(raw || '')
                    .split(/(?<=[.!?…])\s+/)
                    .map(s => s.trim())
                    .forEach((s, si) => {
                        if (s.length < 14 || !PLAN_HINTS.test(s)) return;
                        const key = s.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
                        if (seen.has(key)) return;
                        seen.add(key);
                        out.push({
                            id: `koom-${ti}-${si}-${Math.random().toString(36).slice(2, 6)}`,
                            text: s, source: who, status: 'NEW',
                            createdAt: new Date().toISOString(),
                        });
                    });
            });
        });
        return out;
    }

    /** Przekształć plan w zadanie Mechanika (lokalny enqueue — darmowy). */
    static async sendToMechanik(plan: KoomPlan): Promise<string | null> {
        const taskId = `koom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
        try {
            const res = await fetch(`${BRIDGE}/api/mechanic/enqueue`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    id:          taskId,
                    title:       `[KOOM] ${plan.text.slice(0, 70)}`,
                    description: `Plan z Księgi Odbioru (źródło: ${plan.source}).\n\n${plan.text}`,
                    priority:    'HIGH',
                    targetFiles: [],
                }),
            });
            const d = await res.json();
            return (res.ok && d.success) ? taskId : null;
        } catch {
            return null;
        }
    }

    /** Lista dostępnych LOKALNYCH modeli (członkowie rady multi-model). */
    static async listLocalModels(max = 2): Promise<string[]> {
        try {
            const res = await fetch(`${BRIDGE}/api/ollama/models`);
            const d = await res.json();
            return (Array.isArray(d.models) ? d.models : []).slice(0, max);
        } catch { return []; }
    }

    /** Multi-modelowanie: każdy LOKALNY model rozkłada plan na kroki (darmowe). */
    static async councilAnalyze(planText: string): Promise<ModelTake[]> {
        const models = await this.listLocalModels(2);
        const list = models.length ? models : [localStorage.getItem('otakos_active_model') || 'gemma4'];
        const takes: ModelTake[] = [];
        for (const model of list) {
            try {
                const analysis = await this.queryLocal(model, planText);
                takes.push({ model, analysis });
            } catch (e: any) {
                takes.push({ model, analysis: `(model milczy: ${e?.message || 'offline'})` });
            }
        }
        return takes;
    }

    /** Pojedyncze zapytanie do lokalnego modelu przez most (SSE → tekst). */
    private static async queryLocal(model: string, planText: string): Promise<string> {
        const system = 'Jesteś inżynierem Katedry. Rozłóż podany plan na 2-4 konkretne, wykonalne kroki ' +
            'techniczne (pliki/akcje). Zwięźle, po polsku, bez wstępów.';
        const res = await fetch(`${BRIDGE}/api/ollama`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ model, system, messages: [{ role: 'user', content: planText }] }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '', full = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const evt = JSON.parse(line.slice(6));
                    if (evt.type === 'text' && evt.text) full += evt.text;
                    if (evt.type === 'error') throw new Error(evt.error);
                } catch (e: any) { if (e?.message && !e.message.includes('JSON')) throw e; }
            }
        }
        return full.trim() || '(brak odpowiedzi)';
    }
}

export default KoomService;
