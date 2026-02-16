
import { useAtom } from 'jotai';
import { walletAtom } from '../store/wallet';
import toast from 'react-hot-toast';

export const useAudioMining = () => {
    const [wallet, setWallet] = useAtom(walletAtom);

    // Sync with the global wallet state to ensure God Mode (99,999,999.00) is respected
    const balance = wallet.balance ? parseFloat(wallet.balance) : 0.00;

    const claimHarmonyPoints = (points: number) => {
        // 100 Harmony Points = 1 GRV (Exchange Rate)
        const grvReward = points / 100;
        
        setWallet(prev => {
            const currentBalance = prev.balance ? parseFloat(prev.balance) : 0;
            return {
                ...prev,
                balance: (currentBalance + grvReward).toFixed(2)
            };
        });

        toast.success(`Minted ${grvReward.toFixed(2)} GRV from Harmony Points`, {
            icon: '🎵',
            style: {
                background: '#0f172a',
                color: '#22d3ee',
                border: '1px solid #22d3ee'
            }
        });
    };

    return {
        balance, // Returns the correct global balance
        claimHarmonyPoints
    };
};
