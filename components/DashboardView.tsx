import React from 'react';
import { PortfolioDashboard } from './PortfolioDashboard';
import { CreativeZoneCard } from './dashboard/CreativeZoneCard';
import { AssistantLogCard } from './dashboard/AssistantLogCard';
import { UniverseCard } from './dashboard/UniverseCard';
import { FiMusic, FiPackage, FiFeather, FiScissors } from 'react-icons/fi';
import { ManifestHistoryCard } from './dashboard/ManifestHistoryCard';
import { Biblioteka } from './special/Biblioteka';
import DashboardCard from './DashboardCard';
import { Library } from 'lucide-react';
import KatedraNeuralMap from './special/KatedraNeuralMap';
import { useT } from '../lib/i18n';
import LanguageToggle from './LanguageToggle';

interface DashboardViewProps {
    onVisualAssistantOpen: () => void;
    behavioralData: any;
    onTriggerAnomaly: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onVisualAssistantOpen }) => {
    const { t, lang } = useT();
    // Automat: odpala lokalne studio (jeśli nie działa) i przekierowuje.
    const launchStudio = async (app: 'music' | 'story' | 'app' | 'fashion', port: number) => {
        const fallback = `http://localhost:${port}`;
        try {
            const r = await fetch('http://127.0.0.1:3001/api/launch', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app }),
            });
            const d = await r.json();
            setTimeout(() => window.open(d.url || fallback, '_blank'), d.started ? 3500 : 200);
        } catch { window.open(fallback, '_blank'); }
    };
    return (
        <div className="flex flex-col gap-10 pb-20">
            {/* 0. Przełącznik języka (i18n) */}
            <div className="w-full flex justify-end">
                <LanguageToggle />
            </div>
            {/* 1. TOP: CREATIVE PORTAL */}
            <div className="w-full">
                <CreativeZoneCard onVisualAssistantOpen={onVisualAssistantOpen} />
            </div>

            {/* 2. MIDDLE: KRONIKI + LOGI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AssistantLogCard />
                <ManifestHistoryCard />
            </div>

            {/* ⚠️ Tu stała ValueClarityCard — „Transfer 1000 GRV to @jano · 45% · High Risk"
                wpisane na sztywno, ocena ryzyka, której żaden moduł nie liczy. Usunięta
                2026-09-11: atrapa na ekranie startowym uczy, że liczbom nie wolno wierzyć. */}

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

            {/* 6. UNIVERSES — cztery studia w CZTERECH kolumnach. Siatka 3-kolumnowa
                zrzucała Fashion samotnie do drugiego rzędu. */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                <UniverseCard title={t('studio.story')} subtitle={t('studio.storySub')} onClick={() => launchStudio('story', 5174)} icon={<FiFeather className="w-8 h-8" />} colorTheme="purple" isLocked={false} />
                <UniverseCard title={t('studio.music')} subtitle={t('studio.musicSub')} onClick={() => launchStudio('music', 5173)} icon={<FiMusic className="w-8 h-8" />} colorTheme="pink" isLocked={false} />
                <UniverseCard title={t('studio.app')} subtitle={t('studio.appSub')} onClick={() => launchStudio('app', 5175)} icon={<FiPackage className="w-8 h-8" />} colorTheme="cyan" isLocked={false} />
                {/* ⚠️ Dział mody chodzi na Expressie (port 3000), nie na Vite jak pozostałe —
                    dlatego numer portu jest inny i most odpala go bez `--port`. */}
                <UniverseCard title="OtakOS Fashion" subtitle="Kreacje z kadrów Katedry" onClick={() => launchStudio('fashion', 3000)} icon={<FiScissors className="w-8 h-8" />} colorTheme="pink" isLocked={false} />
            </div>

            {/* 7. SIEĆ KATEDR — żywa mapa AGI (LIVE z mostu, same-origin) */}
            <div className="w-full">
                <h2 className="text-lg font-bold text-emerald-300 mb-3 font-mono">🧠 {t('dash.network')}</h2>
                <KatedraNeuralMap lang={lang} />
            </div>
        </div>
    );
};