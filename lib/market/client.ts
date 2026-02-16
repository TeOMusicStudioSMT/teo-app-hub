
import { mockFetch } from '../identity/client';
import { MarketListing, CreateListingRequest } from './types';
import { v4 as uuidv4 } from 'uuid';

const mockMarketItems: MarketListing[] = [
    { id: 'item1', sellerDid: 'did:teo:seller1', itemName: 'Genesis Music Key', price: 250, imageUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80', description: 'Unlocks exclusive soundscapes in teomusic.studio.' },
    { id: 'item2', sellerDid: 'did:teo:seller2', itemName: 'Decentralized ID Slot', price: 1500, imageUrl: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?w=400&q=80', description: 'Reserve a premium name for your Essence.' },
    { id: 'item3', sellerDid: 'did:teo:seller3', itemName: 'Story Weaver Pass', price: 120, imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&q=80', description: 'Grants voting rights on narrative branches in teostory.studio.' },
    { id: 'item4', sellerDid: 'did:teo:seller4', itemName: 'Quantum Node Voucher', price: 5000, imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80', description: 'A voucher for future staking on the GRV mainnet.' },
];

export const listListings = async (): Promise<MarketListing[]> => {
    return mockFetch(mockMarketItems, 600);
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

export const createOrder = async (listingId: string): Promise<{success: boolean}> => {
    console.log(`Creating order for listing ${listingId}`);
    return mockFetch({ success: true });
}

export const confirmOrder = async (orderId: string): Promise<{success: boolean}> => {
    console.log(`Confirming order ${orderId}`);
    return mockFetch({ success: true });
}
