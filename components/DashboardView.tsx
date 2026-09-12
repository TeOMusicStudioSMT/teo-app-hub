import React from 'react';
import { PortfolioDashboard } from './PortfolioDashboard';
import { CreativeZoneCard } from './dashboard/CreativeZoneCard';
import { AssistantLogCard } from './dashboard/AssistantLogCard';
import { UniverseCard } from './dashboard/UniverseCard';
import { FiMusic, FiPackage, FiFeather, FiScissors, FiCpu, FiShield } from 'react-icons/fi';
import { ManifestHistoryCard } from './dashboard/ManifestHistoryCard';
import { Biblioteka } from './special/Biblioteka';
import DashboardCard from './DashboardCard';
import { Library } from 'lucide-react';
import KatedraNeuralMap from './special/KatedraNeuralMap';
import { useT } from '../lib/i18n';
import LanguageToggle from './LanguageToggle';
import { STUDIA, odpalStudio, type IdStudia } from '../lib/wrota';
import { PulsMaszyny } from './dashboard/PulsMaszyny';
import { NocnaZmianaCard } from './dashboard/NocnaZmianaCard';

interface DashboardViewProps {
    onVisualAssistantOpen: () => void;
    behavioralData: any;
    onTriggerAnomaly: () => void;
}

/**
 * ⚠️ Ikony osobno od danych: lib/wrota.ts nie importuje Reacta, bo tę samą
 * listę STUDIA czyta też Universes (ProjectsView) — a ikona to sprawa widoku.
 */
const IKONA: Record<IdStudia, React.ReactNode> = {
    story: <FiFeather className="w-8 h-8" />,
    music: <FiMusic className="w-8 h-8" />,
    app: <FiPackage className="w-8 h-8" />,
    games: <FiCpu className="w-8 h-8" />,
    fashion: <FiScissors className="w-8 h-8" />,
    lab: <FiShield className="w-8 h-8" />,
};

export const DashboardView: React.FC<DashboardViewProps> = ({ onVisualAssistantOpen }) => {
    const { t, lang } = useT();
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

            {/* 3. PULS MASZYNY — RAM / VRAM / temperatura karty na żywo (liveline, MIT).
                Tu stała ValueClarityCard: „Transfer 1000 GRV to @jano · 45% · High Risk"
                wpisane na sztywno. Usunięta 2026-09-11; jej miejsce zajmują liczby,
                które naprawdę się mierzą — bo noc wcześniej nikt nie widział, jak
                RAM spada do 3,7 GB, dopóki most nie padł. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <PulsMaszyny />
                {/* 🌙 Nocna Zmiana obok Pulsu — bo to Puls decyduje, czy Zmiana ma prawo ruszyć. */}
                <NocnaZmianaCard />
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

            {/* 6. STUDIA — TA SAMA lista co w Universes (lib/wrota.ts), w NOWEJ KARCIE.
                Dwie osobne listy rozjechały się: dashboard nie znał Games i LaB,
                Universes nie znało Fashion. */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {STUDIA.map((s) => (
                    <UniverseCard
                        key={s.id}
                        title={s.tytul}
                        subtitle={s.podtytul}
                        onClick={() => void odpalStudio(s)}
                        icon={IKONA[s.id]}
                        colorTheme={s.kolor}
                        isLocked={false}
                    />
                ))}
            </div>

            {/* 7. SIEĆ KATEDR — żywa mapa AGI (LIVE z mostu, same-origin) */}
            <div className="w-full">
                <h2 className="text-lg font-bold text-emerald-300 mb-3 font-mono">🧠 {t('dash.network')}</h2>
                <KatedraNeuralMap lang={lang} />
            </div>
        </div>
    );
};
