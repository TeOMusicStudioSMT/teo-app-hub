
import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import toast from 'react-hot-toast';
import * as marketClient from '../lib/market/client';
import { MarketListing } from '../lib/market/types';
import { MarketItemCard } from './MarketItemCard';

interface MarketViewProps {
    project: Project;
}

export const MarketView: React.FC<MarketViewProps> = ({ project }) => {
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

    return (
        <div className="p-6 overflow-y-auto h-full flex flex-col gap-6 pt-16">
            <header>
                <div className={`w-16 h-16 mb-4 text-green-300`}>{project.icon}</div>
                <h3 className={`text-3xl font-bold text-green-300`}>{project.name}</h3>
                <p className="text-slate-400">Decentralized asset and service exchange.</p>
            </header>
            
            <div className="grid grid-cols-1 gap-4">
                {isLoading ? (
                     <div className="flex justify-center items-center h-48">
                        <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    listings.map(item => <MarketItemCard key={item.id} item={item} />)
                )}
            </div>
        </div>
    );
};