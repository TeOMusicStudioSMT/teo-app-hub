
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MarketListing } from '../lib/market/types';
import { AssetType, PricingParameters, calculateAssetPrice, calculateRevenueSplit } from '../lib/graviton/economics';
import { FaCheckCircle, ShieldCheckIcon, StarIcon } from './icons';

interface ProductDetailModalProps {
    item: MarketListing;
    mockParams: { type: AssetType, params: PricingParameters };
    onClose: () => void;
    onPurchase: (finalPrice: number) => void;
    isPurchased: boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ item, mockParams, onClose, onPurchase, isPurchased }) => {
    const { type, params } = mockParams;
    const price = calculateAssetPrice(type, params);
    const revenueSplit = calculateRevenueSplit(price);

    const [confirmMode, setConfirmMode] = useState(false);

    const handleAcquire = () => {
        if (!confirmMode) {
            setConfirmMode(true);
        } else {
            onPurchase(price);
        }
    };

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row m-4 h-[80vh] md:h-auto"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Image Section */}
                <div className="w-full md:w-1/2 h-48 md:h-auto bg-slate-800 relative">
                    <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-cover" />
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white font-mono border border-white/20">
                        {type}
                    </div>
                </div>

                {/* Info Section */}
                <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">{item.itemName}</h2>
                            <p className="text-slate-400 text-sm">Creator: {item.sellerDid.substring(0, 12)}...</p>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none">&times;</button>
                    </div>

                    <div className="space-y-6 flex-grow overflow-y-auto pr-2">
                        <div>
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Origin Story</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                {item.description} Generated within the TeO ecosystem, this asset carries a unique cryptographic signature verifying its authenticity and energy matrix.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800/50 p-3 rounded-lg">
                                <p className="text-xs text-slate-500">Entropy Level</p>
                                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1 mb-1">
                                    <div className="bg-green-400 h-1.5 rounded-full" style={{ width: '15%' }}></div>
                                </div>
                                <p className="text-xs text-green-400">Stable (Low Decay)</p>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-lg">
                                <p className="text-xs text-slate-500">Complexity</p>
                                <div className="flex text-amber-400 text-xs mt-1">
                                    {'★'.repeat(Math.min(5, params.complexity || 3))}
                                    <span className="text-slate-600">{'★'.repeat(5 - Math.min(5, params.complexity || 3))}</span>
                                </div>
                            </div>
                        </div>

                        {confirmMode && (
                            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-600 animate-[fade-in_0.3s]">
                                <h4 className="text-sm font-bold text-white mb-2">Smart Contract Split</h4>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Total Price</span>
                                        <span className="text-white font-mono">{price.toFixed(2)} GRV</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-green-400">Creator Share (95%)</span>
                                        <span className="text-slate-300 font-mono">{revenueSplit.formatted.creator} GRV</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-rose-400">Platform Fee (5%)</span>
                                        <span className="text-slate-300 font-mono">{revenueSplit.formatted.platform} GRV</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-700/50">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-slate-400 text-sm">Energy Value</span>
                            <span className="text-2xl font-bold font-mono text-cyan-300">{price.toFixed(2)} GRV</span>
                        </div>
                        
                        {isPurchased ? (
                            <button disabled className="w-full capsule-button capsule-light py-3 flex items-center justify-center gap-2 cursor-default">
                                <FaCheckCircle /> Resource Acquired
                            </button>
                        ) : (
                            <div className="flex gap-3">
                                {confirmMode && (
                                    <button 
                                        onClick={() => setConfirmMode(false)}
                                        className="flex-1 text-slate-400 hover:text-white font-semibold"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button 
                                    onClick={handleAcquire}
                                    className="flex-grow capsule-button capsule-green py-3 flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                                >
                                    {confirmMode ? 'Confirm Quantum Transfer' : 'Acquire Resource'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
