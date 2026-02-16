import React, { useState } from 'react';
import { FaCheckCircle, FaExclamationCircle } from './icons';

interface MetricProps {
  label: string;
  value: number;
  threshold: number;
  unit: string;
  isLowerBetter: boolean;
}

const MetricCard: React.FC<MetricProps> = ({ label, value, threshold, unit, isLowerBetter }) => {
  const isHealthy = isLowerBetter ? value < threshold : value > threshold;
  const statusColor = isHealthy ? 'text-green-500' : 'text-red-500';
  const statusIcon = isHealthy ? <FaCheckCircle /> : <FaExclamationCircle />;

  return (
    <div className={`p-4 rounded-xl flex flex-col items-start bg-slate-800/80 border ${isHealthy ? 'border-green-600/50' : 'border-red-600/50'}`}>
      <div className="flex items-center space-x-2">
        <span className={`text-xl ${statusColor}`}>{statusIcon}</span>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{label}</h3>
      </div>
      <p className="text-3xl font-bold text-white mt-2">
        {value}{unit}
      </p>
      <p className="text-xs text-slate-500 mt-1">
        Threshold: {isLowerBetter ? '<' : '>'}{threshold}{unit}
      </p>
    </div>
  );
};

export const QuantumMetricsDashboard: React.FC = () => {
  // Simulate metrics data from Cloud Monitoring
  const [metrics] = useState({
    false_positive_rate: 1.5,
    detection_time: 480,
    ai_human_agreement: 91,
    response_time: 250,
  });

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold text-cyan-300 mb-4 drop-shadow-[0_0_4px_rgba(0,255,255,0.5)]">
        Quantum Metrics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="False Positive Rate"
          value={metrics.false_positive_rate}
          threshold={2}
          unit="%"
          isLowerBetter={true}
        />
        <MetricCard
          label="Detection Time"
          value={metrics.detection_time}
          threshold={500}
          unit="ms"
          isLowerBetter={true}
        />
        <MetricCard
          label="AI-Human Agreement"
          value={metrics.ai_human_agreement}
          threshold={85}
          unit="%"
          isLowerBetter={false}
        />
        <MetricCard
          label="Response Time"
          value={metrics.response_time}
          threshold={300}
          unit="ms"
          isLowerBetter={true}
        />
      </div>
    </div>
  );
};
