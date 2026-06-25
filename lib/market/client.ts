
import { mockFetch } from '../identity/client';
import { MarketListing, CreateListingRequest } from './types';
import { v4 as uuidv4 } from 'uuid';

const mockMarketItems: MarketListing[] = [
    { id: 'item1', sellerDid: 'did:teo:seller1', itemName: 'Genesis Music Key', price: 250, imageUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80', description: 'Unlocks exclusive soundscapes in teomusic.studio.' },
    { id: 'item2', sellerDid: 'did:teo:seller2', itemName: 'Decentralized ID Slot', price: 1500, imageUrl: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?w=400&q=80', description: 'Reserve a premium name for your Essence.' },
    { id: 'item3', sellerDid: 'did:teo:seller3', itemName: 'Story Weaver Pass', price: 120, imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&q=80', description: 'Grants voting rights on narrative branches in teostory.studio.' },
    { id: 'item4', sellerDid: 'did:teo:seller4', itemName: 'Quantum Node Voucher', price: 5000, imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80', description: 'A voucher for future staking on the GRV mainnet.' },
];

const BRIDGE = 'http://127.0.0.1:3001';
const BUYER = 'Mistrz Arkadiusz'; // suwerenny węzeł-nabywca (księga GRV = portfel prawdy)
const FALLBACK_IMAGES = mockMarketItems.map(m => m.imageUrl);

// Realne produkty z naszego sklepu (Marketplace 0.00G) — ładne karty, prawdziwe dane.
// Most offline → atrapy (mockMarketItems) jako fallback.
export const listListings = async (): Promise<MarketListing[]> => {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2000);
        const r = await fetch(`${BRIDGE}/api/market/products`, { signal: ctrl.signal });
        clearTimeout(t);
        const d = await r.json();
        if (d.success && Array.isArray(d.products) && d.products.length) {
            return d.products.map((p: any, i: number): MarketListing => ({
                id: p.id,
                sellerDid: `did:teo:${String(p.creator || 'anon').toLowerCase().replace(/\s+/g, '')}`,
                itemName: p.name,
                price: p.priceGrvDyn ?? p.priceGrv ?? 0,   // cena dynamiczna (popyt)
                imageUrl: FALLBACK_IMAGES[i % FALLBACK_IMAGES.length],
                description: p.desc || 'Asset Katedry OtakOS.',
            }));
        }
    } catch { /* most offline → atrapy */ }
    return mockFetch(mockMarketItems, 300);
};

export const createListing = async (data: CreateListingRequest): Promise<MarketListing> => {
    const newListing: MarketListing = {
        id: `item-${uuidv4().substring(0,4)}`,
        sellerDid: 'did:key:z6MkpTHR8VNsj1wV1bY51qzjA2j3e5Q6q8C2pX9b7Z8dY3aN', // Current user's DID
        itemName: data.itemName,
        price: data.price,
        description: data.description || 'A new item on the TeO Market.',
        imageUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&q=80', // Default image
    };
    mockMarketItems.unshift(newListing);
    return mockFetch(newListing);
};

// Realny zakup: przelew GRV z portfela Suwerena do twórcy (księga = portfel prawdy).
// Atrapy (mock) lub produkty za 0 GRV / własne → przejście bez przelewu.
export const createOrder = async (listingId: string): Promise<{success: boolean}> => {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);
        const d = await (await fetch(`${BRIDGE}/api/market/products`, { signal: ctrl.signal })).json();
        clearTimeout(t);
        const p = (d.products || []).find((x: any) => x.id === listingId);
        if (!p) return { success: true };                       // atrapa — brak realnego twórcy
        const price = p.priceGrvDyn ?? p.priceGrv ?? 0;
        if (price <= 0 || p.creator === BUYER) return { success: true };
        const g = await (await fetch(`${BRIDGE}/api/grv/grant`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: BUYER, to: p.creator, amount: price }),
        })).json();
        if (!g.success) throw new Error(g.message || 'Brak GRV / zakup odrzucony');
        return { success: true };
    } catch (e: any) {
        throw new Error(e?.message || 'Most offline — transakcja GRV nieudana');
    }
};

export const confirmOrder = async (orderId: string): Promise<{success: boolean}> => {
    console.log(`Confirming order ${orderId}`);
    return mockFetch({ success: true });
}
