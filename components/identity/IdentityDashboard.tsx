import React from 'react';
import { useEssenceIdentity } from '../../hooks/useEssenceIdentity';
import DashboardCard from '../DashboardCard';
import { UserCircleIcon, ShieldCheckIcon } from '../icons';
import { GuardiansPanel } from './GuardiansPanel';
import { useSetAtom, useAtomValue } from 'jotai';
import { isAvatarSelectionModalOpenAtom } from '../../store/identity';
import { DigitalSelfAvatar } from './DigitalSelfAvatar';
import { resonanceColorAtom, RESONANCE_THEMES } from '../../store/personalization';
import { QuantumCoreLink } from './QuantumCoreLink';


const DetailItem: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono = false }) => (
    <div className="py-2">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`text-white truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
);

export const IdentityDashboard: React.FC = () => {
    const { identity, isLoading } = useEssenceIdentity();
    const setAvatarModalOpen = useSetAtom(isAvatarSelectionModalOpenAtom);
    const resonanceColor = useAtomValue(resonanceColorAtom);
    const theme = RESONANCE_THEMES[resonanceColor];

    if (isLoading || !identity) {
        return (
             <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Panel: Core Identity Info */}
            <div className="lg:col-span-1">
                <DashboardCard title="Essence Core" icon={<UserCircleIcon />}>
                    <div className="flex flex-col h-full items-center">
                        <div className="my-4">
                            <DigitalSelfAvatar
                                form={identity.avatarForm}
                                color={theme.hex}
                                sizeClass="w-28 h-28"
                            />
                        </div>
                        <div className="flex-grow w-full">
                            <DetailItem label="Username" value={
                                <div className="flex items-center gap-2">
                                    <span>{identity.username ? `@${identity.username}` : 'Not Claimed'}</span>
                                    {identity.username && <QuantumCoreLink />}
                                </div>
                            } />
                            <DetailItem label="Decentralized ID (DID)" value={identity.did} mono />
                            <DetailItem
                                label="Proof of Essence"
                                value={
                                    <span className={identity.vcSummary.essenceProofIssued ? 'text-green-400' : 'text-amber-400'}>
                                        {identity.vcSummary.essenceProofIssued ? `Issued on ${new Date(identity.vcSummary.issueDate!).toLocaleDateString()}` : 'Not Issued'}
                                    </span>
                                }
                            />
                            <DetailItem label="Coherence Index" value={`${identity.coherence.index}% (${identity.coherence.riskLevel})`} />
                        </div>
                        <button onClick={() => setAvatarModalOpen(true)} className="capsule-button capsule-cyan w-full mt-4">
                            Change Avatar Form
                        </button>
                    </div>
                </DashboardCard>
            </div>

            {/* Right Panel: Guardians and Security */}
            <div className="lg:col-span-2">
                 <DashboardCard title="Guardians & Recovery" icon={<ShieldCheckIcon />}>
                    <GuardiansPanel />
                </DashboardCard>
            </div>
        </div>
    );
};
