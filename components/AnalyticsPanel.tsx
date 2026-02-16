import React from 'react';
import { useAtomValue } from 'jotai';
import { userStatsAtom } from '../store/userStatsAtom';
// FIX: Replace missing icons with existing or newly created ones.
import { BookIcon, FaCheckCircle, ClockIcon, GemIcon, HeartIcon } from './icons';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <div className={`p-4 rounded-xl flex items-center justify-between text-white ${color}`}>
    <div>
      <p className="text-sm opacity-80">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
    </div>
    <div className="text-4xl opacity-50">{icon}</div>
  </div>
);

export const AnalyticsPanel: React.FC = () => {
  const userStats = useAtomValue(userStatsAtom);

  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
      <StatCard
        title="Wszystkie Historie"
        value={userStats.totalStories}
        icon={<BookIcon />}
        color="bg-purple-600/80"
      />
      <StatCard
        title="Ukończone Historie"
        value={userStats.completedTales}
        icon={<FaCheckCircle />}
        color="bg-green-600/80"
      />
      <StatCard
        title="Czas Czytania"
        value={`${Math.floor(userStats.readingTime / 60)}h ${userStats.readingTime % 60}m`}
        icon={<ClockIcon />}
        color="bg-amber-600/80"
      />
      <StatCard
        title="Magiczne Punkty"
        value={userStats.magicPoints}
        icon={<GemIcon />}
        color="bg-sky-600/80"
      />
      <StatCard
        title="Ulubione Historie"
        value={userStats.favoriteStories}
        icon={<HeartIcon />}
        color="bg-rose-600/80"
      />
    </div>
  );
};
