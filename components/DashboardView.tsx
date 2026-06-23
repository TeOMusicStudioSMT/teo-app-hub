import React from 'react';
import { PortfolioDashboard } from './PortfolioDashboard';
import { CreativeZoneCard } from './dashboard/CreativeZoneCard';
import { AssistantLogCard } from './dashboard/AssistantLogCard';
import { ValueClarityCard } from './dashboard/ValueClarityCard';
import { UniverseCard } from './dashboard/UniverseCard';
import { FiMusic, FiPackage, FiFeather } from 'react-icons/fi';
import { ManifestHistoryCard } from './dashboard/ManifestHistoryCard';
import { Biblioteka } from './special/Biblioteka';
import DashboardCard from './DashboardCard';
import { Library } from 'lucide-react';
import KatedraNeuralMap from './special/KatedraNeuralMap';
import { detectLang } from '../lib/locale';

interface DashboardViewProps {
    onVisualAssistantOpen: () => void;
    behavioralData: any;
    onTriggerAnomaly: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onVisualAssistantOpen }) => {
    return (
        <div className="flex flex-col gap-10 pb-20">
            {/* 1. TOP: CREATIVE PORTAL */}
            <div className="w-full">
                <CreativeZoneCard onVisualAssistantOpen={onVisualAssistantOpen} />
            </div>

            {/* 2. MIDDLE: KRONIKI + LOGI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AssistantLogCard />
                <ManifestHistoryCard />
            </div>

            {/* 3. VALUE CLARITY */}
            <div className="w-full">
                <ValueClarityCard />
            </div>

            {/* 4. PORTFOLIO */}
            <div className="w-full">
                <PortfolioDashboard />
            </div>

            {/* 5. BIBLIOTEKA ZWOJÓW */}
            <div className="w-full">
                <DashboardCard title="Kwantowa Biblioteka" icon={<Library className="w-full h-full" />}>
                    <Biblioteka />
                </DashboardCard>
            </div>

            {/* 6. UNIVERSES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <UniverseCard title="Story Studio" subtitle="Construct Reality." onClick={() => { }} icon={<FiFeather className="w-8 h-8" />} colorTheme="purple" isLocked={false} />
                <UniverseCard title="Music Studio" subtitle="Audio Synthesis." onClick={() => { }} icon={<FiMusic className="w-8 h-8" />} colorTheme="pink" isLocked={false} />
                <UniverseCard title="App Studio" subtitle="Code Tools." onClick={() => { }} icon={<FiPackage className="w-8 h-8" />} colorTheme="cyan" isLocked={false} />
            </div>

            {/* 7. SIEĆ KATEDR — żywa mapa AGI (LIVE z mostu, same-origin) */}
            <div className="w-full">
                <KatedraNeuralMap lang={detectLang()} />
            </div>
        </div>
    );
};