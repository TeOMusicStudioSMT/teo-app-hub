/**
 * 🌐 ApiLayerService — Free-Only Network Client (APILayer Marketplace)
 *
 * Lekki klient zapytań do api.apilayer.com z TWARDYM zabezpieczeniem darmowego planu:
 * monitoruje nagłówki X-RateLimit-Limit / X-RateLimit-Remaining i — gdy pula
 * darmowych zapytań spadnie do zera (lub przyjdzie 429) — automatycznie BLOKUJE
 * dalszy ruch, chroniąc system przed lawiną Too Many Requests.
 *
 * Klucz (apilayer_free_key) pobierany WYŁĄCZNIE ze Skarbca 0.00G (VaultService,
 * AES-256-GCM). Lekki cache TTL ogranicza zużycie limitu. resetNetwork() (ETAP 5
 * TeO-Kibla) zeruje cache + liczniki + odblokowuje ruch.
 *
 * Standard ESM · Singleton.
 */

import VaultService from './VaultService.js';

const BASE_URL       = 'https://api.apilayer.com';
const VAULT_SERVICE  = 'apilayer_gateway';
const VAULT_KEY      = 'apilayer_free_key';
const DEFAULT_TTL_MS = 60_000;
const REQUEST_TIMEOUT = 20_000;

class ApiLayerServiceClass {
    constructor() {
        this._cache   = new Map();   // cacheKey → { ts, data }
        this._blocked = false;       // true → limit wyczerpany, ruch wstrzymany
        this._rate    = { limit: null, remaining: null, checkedAt: null, reason: null };
        this._stats   = { requests: 0, served: 0, blocked: 0, cacheHits: 0 };
        console.log('[ApiLayerService] 🌐 Free-Only Network Client aktywny.');
    }

    async _getKey() {
        return VaultService.getInstance().getSecret(VAULT_SERVICE, VAULT_KEY);
    }

    /** Aktualizuj liczniki z nagłówków odpowiedzi; auto-blokada przy 0. */
    _absorbRateLimit(headers) {
        const pick = (...names) => {
            for (const n of names) {
                const v = headers.get(n);
                if (v != null) return Number(v);
            }
            return null;
        };
        const limit     = pick('x-ratelimit-limit', 'x-ratelimit-limit-month', 'x-ratelimit-limit-day');
        const remaining = pick('x-ratelimit-remaining', 'x-ratelimit-remaining-month', 'x-ratelimit-remaining-day');

        if (limit     != null) this._rate.limit = limit;
        if (remaining != null) {
            this._rate.remaining = remaining;
            if (remaining <= 0) {
                this._blocked = true;
                this._rate.reason = 'Wyczerpano pulę darmowych zapytań (remaining=0).';
                console.warn('[ApiLayerService] 🛑 FREE-PLAN limit = 0 → ruch ZABLOKOWANY (ochrona przed 429).');
            }
        }
        this._rate.checkedAt = new Date().toISOString();
    }

    /**
     * Wykonaj zapytanie do APILayer (z guardem free-plan + cache).
     * @param {string} endpoint  np. '/exchangerates_data/latest'
     * @param {{ method?, query?, headers?, ttlMs? }} [opts]
     */
    async request(endpoint, opts = {}) {
        this._stats.requests++;

        if (this._blocked) {
            this._stats.blocked++;
            throw new Error(`APILayer FREE-PLAN: ruch zablokowany — ${this._rate.reason || 'limit wyczerpany'}. ` +
                'Użyj FLUSH (TeO-Kibel) aby zresetować liczniki.');
        }

        const key = await this._getKey();
        if (!key) throw new Error('Brak klucza apilayer_free_key w Skarbcu 0.00G.');

        const method = (opts.method || 'GET').toUpperCase();
        const query  = opts.query || {};
        const ttlMs  = Number.isFinite(opts.ttlMs) ? opts.ttlMs : DEFAULT_TTL_MS;
        const cacheKey = `${method}:${endpoint}:${JSON.stringify(query)}`;

        // Cache (oszczędza limit)
        const cached = this._cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < ttlMs) {
            this._stats.cacheHits++;
            return { status: 200, data: cached.data, cached: true, rateLimit: this._rate };
        }

        const url = new URL(BASE_URL + (endpoint.startsWith('/') ? endpoint : `/${endpoint}`));
        for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        try {
            const resp = await fetch(url.toString(), {
                method,
                headers: { apikey: key, ...(opts.headers || {}) },
                signal:  controller.signal,
            });
            this._absorbRateLimit(resp.headers);

            if (resp.status === 429) {
                this._blocked = true;
                this._rate.reason = 'HTTP 429 Too Many Requests.';
                this._stats.blocked++;
                throw new Error('APILayer 429 — Too Many Requests. Ruch zablokowany do czasu FLUSH.');
            }

            const data = await resp.json().catch(() => ({}));
            this._cache.set(cacheKey, { ts: Date.now(), data });
            this._stats.served++;
            return { status: resp.status, data, cached: false, rateLimit: this._rate };

        } catch (e) {
            if (e.name === 'AbortError') throw new Error(`APILayer timeout (${REQUEST_TIMEOUT / 1000}s) @ ${endpoint}`);
            throw e;
        } finally {
            clearTimeout(timer);
        }
    }

    /** Status dla kokpitu / endpointu. */
    async getStatus() {
        const key = await this._getKey().catch(() => null);
        return {
            configured: !!key,
            blocked:    this._blocked,
            rateLimit:  this._rate,
            cacheSize:  this._cache.size,
            stats:      this._stats,
        };
    }

    /**
     * ETAP 5 TeO-Kibla: pełna sterylność połączeń sieciowych.
     * Czyści cache, zeruje liczniki limitu i ODBLOKOWUJE ruch.
     */
    resetNetwork() {
        const cacheCleared = this._cache.size;
        this._cache.clear();
        this._blocked = false;
        this._rate    = { limit: null, remaining: null, checkedAt: null, reason: null };
        const prevStats = { ...this._stats };
        this._stats = { requests: 0, served: 0, blocked: 0, cacheHits: 0 };
        console.log(`[ApiLayerService] 🧯 Reset sieci: cache(${cacheCleared}) wyczyszczony, liczniki wyzerowane, ruch odblokowany.`);
        return { cacheCleared, unblocked: true, prevStats };
    }
}

let _instance = null;
export default {
    getInstance() {
        if (!_instance) _instance = new ApiLayerServiceClass();
        return _instance;
    },
};
