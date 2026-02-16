
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { UserProfileModal } from './UserProfileModal';

const nearbyTeonauts = [
  { id: '007', name: 'TeOnaut #007', pos: { x: '30%', y: '40%' }, status: 'online' },
  { id: '042', name: 'TeOnaut #042', pos: { x: '70%', y: '60%' }, status: 'online' },
  { id: '1337', name: 'TeOnaut #1337', pos: { x: '55%', y: '20%' }, status: 'idle' },
];

const statusColors = {
    online: 'bg-green-500',
    idle: 'bg-amber-500',
};

export const CommunityMapView: React.FC = () => {
    const [selectedUser, setSelectedUser] = useState<typeof nearbyTeonauts[0] | null>(null);

    const handleTransaction = (amount: number) => {
        if (!selectedUser) return;
        const promise = new Promise((resolve) => setTimeout(() => resolve(null), 2500));
        toast.promise(promise, {
            loading: `Establishing secure P2P link with ${selectedUser.name}...`,
            success: `Successfully sent ${amount} GRV to ${selectedUser.name}!`,
            error: 'Transaction failed.'
        });
    };

    return (
        <div className="h-full flex flex-col relative">
            <AnimatePresence>
                {selectedUser && (
                    <UserProfileModal 
                        user={selectedUser} 
                        onClose={() => setSelectedUser(null)} 
                        onTransfer={handleTransaction} 
                    />
                )}
            </AnimatePresence>

            {/* Holographic Map */}
            <div className="relative h-48 bg-slate-800/50 rounded-lg overflow-hidden border border-cyan-500/10 mb-4">
                {/* Map Gridlines */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                
                {/* User's Position & Range */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-6 h-6 rounded-full bg-cyan-300 border-2 border-white shadow-[0_0_10px_theme(colors.cyan.300)]"></div>
                    <div className="absolute inset-0 -m-8 w-20 h-20 rounded-full border-2 border-dashed border-cyan-400/50 animate-[spin_20s_linear_infinite]"></div>
                    <div className="absolute inset-0 -m-16 w-36 h-36 rounded-full border border-cyan-400/20 animate-[pulse_3s_ease-in-out_infinite]"></div>
                </div>

                {/* Other Teonauts */}
                {nearbyTeonauts.map(t => (
                    <motion.div
                        key={t.id}
                        className="absolute w-4 h-4 rounded-full border-2 border-white cursor-pointer"
                        style={{ top: t.pos.y, left: t.pos.x }}
                        initial={{ scale: 0.8, opacity: 0.7 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                        whileHover={{ scale: 1.5, zIndex: 10 }}
                        onClick={() => setSelectedUser(t)}
                    >
                         <div className={`w-full h-full rounded-full ${statusColors[t.status as keyof typeof statusColors]}`}></div>
                    </motion.div>
                ))}
            </div>

            {/* User List */}
            <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                 {nearbyTeonauts.map(t => (
                     <div key={t.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-md hover:bg-slate-700/50 cursor-pointer transition-colors" onClick={() => setSelectedUser(t)}>
                         <div className="flex items-center gap-2">
                             <div className={`w-3 h-3 rounded-full ${statusColors[t.status as keyof typeof statusColors]}`}></div>
                             <span className="text-sm font-semibold">{t.name}</span>
                         </div>
                         <button className="capsule-button capsule-cyan py-1 px-3 text-xs">
                             View
                         </button>
                     </div>
                 ))}
            </div>
        </div>
    );
};
