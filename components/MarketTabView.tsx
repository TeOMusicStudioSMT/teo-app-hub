import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as marketClient from '../lib/market/client';
import { MarketListing } from '../lib/market/types';
import { MarketItemCard } from './MarketItemCard';

export const MarketTabView: React.FC = () => {
    const [listings, setListings] = useState<MarketListing[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchListings = async () => {
            setIsLoading(true);
            try {
                const items = await marketClient.listListings();
                setListings(items);
            } catch (error) {
                toast.error("Could not fetch market listings.");
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchListings();
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-48">
                <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-2 overflow-y-auto max-h-[calc(100vh-22rem)]">
            {listings.map(item => <MarketItemCard key={item.id} item={item} />)}
        </div>
    );
};
