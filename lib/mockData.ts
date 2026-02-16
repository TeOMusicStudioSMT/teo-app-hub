
// --- Mock Data for Portfolio Dashboard ---

/**
 * Simulates historical GRV value over the last month.
 * Used by the LineChart in the PortfolioDashboard.
 * Each object contains a date and the portfolio value at that date.
 */
export const portfolioHistoryData = [
    { date: '2024-07-01', value: 3200 },
    { date: '2024-07-03', value: 3350 },
    { date: '2024-07-05', value: 3400 },
    { date: '2024-07-08', value: 3550 },
    { date: '2024-07-10', value: 3500 },
    { date: '2024-07-12', value: 3600 },
    { date: '2024-07-15', value: 3750 },
    { date: '2024-07-18', value: 3650 },
    { date: '2024-07-21', value: 3800 },
    { date: '2024-07-24', value: 3820 },
    { date: '2024-07-26', value: 3900 },
    { date: '2024-07-28', value: 4100 },
    { date: '2024-07-29', value: 3975.78 },
];

/**
 * Simulates spending distribution across different TeO projects.
 * Used by the PieChart in the PortfolioDashboard.
 * Each object contains the category name, the amount spent, and a corresponding color.
 */
export const spendingDistributionData = [
    { name: 'graviton.wif Stake', value: 1000, color: '#f43f5e' }, // rose
    { name: 'teoapp.studio Fuel', value: 100, color: '#d946ef' }, // fuchsia
    { name: 'Subscription Renewal', value: 50, color: '#06b6d4' }, // cyan
    { name: 'teostory.studio', value: 75, color: '#84cc16' }, // lime
];

// --- New Asset Data for Portfolio 2.0 ---

export const assetAllocationData = [
    { name: 'Liquid (GRV)', value: 0, color: '#22d3ee' }, // cyan-400 (Will be updated with real balance)
    { name: 'Solid (Assets)', value: 3500, color: '#a855f7' }, // purple-500
    { name: 'Yielding (Staked)', value: 500, color: '#f59e0b' }, // amber-500
];

export const topAssetsList = [
    { 
        id: 'asset_01',
        name: "Aethelgard's Echo",
        type: "RPG World Genesis",
        value: 2500,
        trend: 'up',
        trendValue: '12%',
        icon: '🐉',
        color: 'text-lime-400'
    },
    { 
        id: 'asset_02',
        name: "Neon Pulse Stream",
        type: "Music License",
        value: 450,
        trend: 'neutral',
        trendValue: '0%',
        icon: '🎵',
        color: 'text-cyan-400'
    },
    { 
        id: 'asset_03',
        name: "Genesis Node Stake",
        type: "Network Yield",
        value: 500,
        trend: 'up',
        trendValue: '15% APY',
        icon: '⚡',
        color: 'text-amber-400'
    }
];
