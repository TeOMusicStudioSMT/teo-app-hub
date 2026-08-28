
import React, { useState, useEffect } from 'react';
import { MarketListing } from '../lib/market/types';
import toast from 'react-hot-toast';
import * as marketClient from '../lib/market/client';
import { pobierzPosiadane } from '../lib/market/client';
import { useSetAtom, useAtomValue } from 'jotai';
import { purchaseAssetAtom } from '../store/wallet';
import { calculateAssetPrice, AssetType } from '../lib/graviton/economics';
import { walletAtom } from '../store/wallet';
import { AnimatePresence } from 'framer-motion';
import { ProductDetailModal } from './ProductDetailModal';

// Generate stable mock parameters based on the item ID to simulate diverse assets
const getMockParams = (item: MarketListing) => {
    // Deterministic "random" based on char code sum
    const seed = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    let type: AssetType = 'Standard';
    if (item.itemName.includes('Music') || item.itemName.includes('Audio')) type = 'Music Stream';
    if (item.itemName.includes('World') || item.itemName.includes('Land') || item.itemName.includes('Key')) type = 'RPG World';

    return {
        type,
        params: {
            baseOverride: item.price, // Fallback
            complexity: (seed % 10) + 1,
            npcCount: (seed % 50) + 10,
            uniquenessScore: (seed % 10) + 1,
            lengthMinutes: (seed % 5) + 2
        }
    };
};

export const MarketItemCard: React.FC<{ item: MarketListing }> = ({ item }) => {
    const purchaseAsset = useSetAtom(purchaseAssetAtom);
    const wallet = useAtomValue(walletAtom);
    
    const mockParams = getMockParams(item);
    const { type, params } = mockParams;
    const [currentPrice, setCurrentPrice] = useState(item.price);
    const [isFluxing, setIsFluxing] = useState(false);
    // ⚠️ BYŁO: `useState(false)` i NIC WIĘCEJ — posiadanie żyło tylko w pamięci
    // karty. Po odświeżeniu strony wracało na „niekupione", więc ten sam produkt
    // dawało się kupić w kółko, a GRV znikało za każdym razem. Prawda o posiadaniu
    // mieszka teraz w moście; karta ją CZYTA, a nie wymyśla.
    const [isPurchased, setIsPurchased] = useState(false);

    useEffect(() => {
        let zywy = true;
        void pobierzPosiadane().then(({ aktywa }) => {
            if (zywy) setIsPurchased(aktywa.some(a => a.produktId === item.id));
        });
        return () => { zywy = false; };
    }, [item.id]);
    const [showDetails, setShowDetails] = useState(false);

    // Kinetic Flux Simulation
    useEffect(() => {
        const updatePrice = () => {
            setIsFluxing(true);
            const newPrice = calculateAssetPrice(type, params);
            setCurrentPrice(newPrice);
            
            // Reset flux animation state
            setTimeout(() => setIsFluxing(false), 1000);
        };

        // Initial Calculation
        updatePrice();

        // Random flux interval (between 5s and 10s)
        const intervalTime = Math.random() * 5000 + 5000;
        const interval = setInterval(updatePrice, intervalTime);

        return () => clearInterval(interval);
    }, [item.id, type]);

    const handlePurchase = async (finalPrice: number) => {
        try {
            // 1. REALNY przelew GRV (księga = portfel prawdy) — najpierw, by sprawdzić saldo.
            await toast.promise(
                marketClient.createOrder(item.id),
                {
                    loading: 'Executing Smart Contract (GRV)...',
                    success: 'Asset acquired! GRV przelane twórcy.',
                    error: (e: any) => e?.message || 'Transaction failed.',
                }
            );
            // 2. Sukces → odznacz w lokalnym portfelu UI + stan karty.
            purchaseAsset(finalPrice);
            setIsPurchased(true);
            setShowDetails(false);
        } catch (error: any) {
            toast.error(error.message || "Transaction failed");
        }
    };

    return (
        <>
            <div 
                onClick={() => setShowDetails(true)}
                className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50 hover:border-cyan-500/30 hover:bg-slate-800/70 transition-all flex flex-col sm:flex-row gap-4 group relative overflow-hidden cursor-pointer"
            >
                <img src={item.imageUrl} alt={item.itemName} className="w-full sm:w-24 h-24 object-cover rounded-lg flex-shrink-0" />
                
                <div className="flex flex-col flex-grow">
                    <div className="flex justify-between items-start">
                        <h4 className="font-bold text-white group-hover:text-cyan-300 transition-colors">{item.itemName}</h4>
                        <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${isFluxing ? 'text-cyan-300 border-cyan-500/50 bg-cyan-900/20' : 'text-slate-500 border-slate-700'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isFluxing ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`}></div>
                            Flux
                        </div>
                    </div>

                    <p className="text-xs text-slate-400 flex-grow my-1">{item.description}</p>
                    
                    <div className="flex justify-between items-end mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Energy Value</span>
                            <p className={`text-xl font-mono font-bold transition-colors duration-500 ${isFluxing ? 'text-cyan-300' : 'text-green-400'}`}>
                                {currentPrice.toFixed(2)} <span className="text-sm font-sans font-light text-slate-400">GRV</span>
                            </p>
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs font-bold text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full bg-cyan-900/20">
                                View Details &rarr;
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showDetails && (
                    <ProductDetailModal 
                        item={item} 
                        mockParams={mockParams}
                        onClose={() => setShowDetails(false)} 
                        onPurchase={handlePurchase}
                        isPurchased={isPurchased}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
