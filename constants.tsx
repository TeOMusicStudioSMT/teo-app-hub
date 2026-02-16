

import React from 'react';
import { Project, CosmicVenture } from './types';
import { 
    AnimatedBankTeoMusic,
    AnimatedBankTeoApp,
    AnimatedBankTeoBlockchain,
    AnimatedBankTeoStory,
    AnimatedBankGraviton,
    AnimatedBankTeoIdea,
    AnimatedBankSuperMaster,
    AnimatedBankMarket
} from './components/icons';

export const PROJECTS: Project[] = [
    {
        id: 'teomusic.studio',
        name: 'teomusic.studio',
        description: 'An immersive platform for avant-garde music creation and collaboration, powered by generative AI soundscapes.',
        color: 'cyan',
        icon: <AnimatedBankTeoMusic />,
        isSubscribed: true,
        isFavorite: true,
        tags: ['music', 'ai', 'creative', 'collaboration'],
        currency: 'GRV',
        media: [
            { type: 'image', url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80', title: 'Generative Soundscape UI' },
            { type: 'image', url: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80', title: 'Live Collaboration View' },
        ],
        documents: [
            { title: 'Whitepaper', url: '#' },
            { title: 'Litepaper', url: '#' },
        ]
    },
    {
        id: 'teo.market',
        name: 'TeO Market',
        description: 'A decentralized marketplace for digital assets, services, and unique experiences, powered by the Graviton token.',
        color: 'green',
        icon: <AnimatedBankMarket />,
        isSubscribed: true,
        isFavorite: false,
        tags: ['market', 'nft', 'trade', 'p2p'],
        currency: 'GRV',
    },
    {
        id: 'teoapp.studio',
        name: 'teoapp.studio',
        description: 'A suite of decentralized applications changing the way we interact with digital content and ownership.',
        color: 'fuchsia',
        icon: <AnimatedBankTeoApp />,
        isSubscribed: false,
        isFavorite: false,
        tags: ['dapp', 'web3', 'utility', 'decentralized'],
        currency: 'USD',
        media: [
            { type: 'image', url: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?w=800&q=80', title: 'dApp Interface' },
            { type: 'image', url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80', title: 'Analytics Dashboard' },
        ],
        documents: [
            { title: 'Technical Documentation', url: '#' },
        ]
    },
    {
        id: 'teoblockchain.studio',
        name: 'teoblockchain.studio',
        description: 'Developing the core quantum-resistant blockchain protocol, Graviton (GRV), for secure, next-generation transactions.',
        color: 'amber',
        icon: <AnimatedBankTeoBlockchain />,
        isSubscribed: true,
        isFavorite: false,
        tags: ['blockchain', 'security', 'protocol', 'quantum-resistant'],
        currency: 'GRV',
    },
    {
        id: 'teostory.studio',
        name: 'teostory.studio',
        description: 'A collaborative storytelling platform where narratives evolve through collective imagination, creating ever-expanding universes.',
        color: 'lime',
        icon: <AnimatedBankTeoStory />,
        isSubscribed: true,
        isFavorite: true,
        tags: ['storytelling', 'creative', 'collaboration', 'narrative'],
        narratorAvailable: true,
        currency: 'GRV',
    },
    {
        id: 'graviton.wif',
        name: 'graviton.wif',
        description: 'The official hub for the Graviton (GRV) token, a community-driven digital asset fueling the TeO ecosystem.',
        color: 'rose',
        icon: <AnimatedBankGraviton />,
        isSubscribed: true,
        isFavorite: false,
        tags: ['token', 'community', 'finance', 'web3'],
        currency: 'GRV',
    },
    {
        id: 'graviton.dream',
        name: 'graviton.dream',
        description: 'An incubator for decentralized ideas and projects, where concepts are nurtured by the community and brought to life on the Graviton network.',
        color: 'violet',
        icon: <AnimatedBankTeoIdea />,
        isSubscribed: false,
        isFavorite: false,
        tags: ['incubator', 'community', 'decentralized', 'ideas'],
        currency: 'GRV',
    },
    {
        id: 'supermaster.ai',
        name: 'SuperMaster',
        description: 'An advanced AI banking assistant system that combines quantum-resistant security protocols with behavioral biometrics and hyper-personalization. Created to protect and simplify finances.',
        icon: <AnimatedBankSuperMaster />,
        color: 'sky',
        isSubscribed: true,
        isFavorite: false,
        tags: ['ai', 'security', 'finance', 'biometrics'],
        currency: 'USD',
        docs: [
          {
            name: 'Technical Documentation',
            url: '#',
          },
          {
            name: 'Behavioral Biometrics Report',
            url: '#',
          },
          {
            name: 'MLOps Deployment Plan',
            url: '#',
          },
          {
            name: 'Enterprise Deployment Plan',
            url: '#',
          },
        ],
    },
];

export const COSMIC_VENTURES: CosmicVenture[] = [
    {
        id: 'venture_hotel',
        name: 'Orbital Hotel "Aether"',
        description: 'A luxury habitat in low-earth orbit, offering unparalleled views and zero-gravity experiences. Funded entirely by the TeO community.',
        imageUrl: 'https://images.unsplash.com/photo-1628096461933-09851e4439a3?w=800&q=80',
        goalGRV: 5000000,
        currentGRV: 1875000,
        detailedDescription: "The 'Aether' is more than a hotel; it's a testament to humanity's collaborative spirit. Situated in a stable low-earth orbit, this rotating torus habitat will provide artificial gravity, luxurious accommodations, and breathtaking panoramic views of Earth and the cosmos. Contributions will fund the final stages of construction, including the installation of the panoramic observation dome and the zero-gravity recreational sphere.",
        gallery: [
            { type: 'image', url: 'https://images.unsplash.com/photo-1614728263952-84ea256ec676?w=800&q=80', title: 'Observation Deck Concept' },
            { type: 'image', url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80', title: 'Zero-G Hydroponics Bay' },
        ],
        downloads: [
            { name: 'Architectural Blueprints', url: '#' },
            { name: 'Phase 4 Funding Proposal', url: '#' },
        ]
    },
    {
        id: 'venture_arcology',
        name: 'Arcology Habitat "Veridia"',
        description: 'A self-sustaining, eco-friendly city complex designed for harmonious living with nature and technology. A blueprint for future cities.',
        imageUrl: 'https://images.unsplash.com/photo-1534233753683-11b01783515f?w=800&q=80',
        goalGRV: 12000000,
        currentGRV: 4500000,
        detailedDescription: "'Veridia' represents a new paradigm in urban development. This self-contained arcology integrates advanced renewable energy sources, closed-loop water recycling systems, and vertical farming to create a city that lives in symbiosis with its environment. The structure is designed to house 50,000 residents, with residential, commercial, and agricultural zones vertically stacked to minimize its ecological footprint. Funding will secure land rights and begin foundational construction.",
        gallery: [
            { type: 'image', url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80', title: 'Vertical Farm Renders' },
            { type: 'image', url: 'https://images.unsplash.com/photo-1612543380487-d467a26ff2aa?w=800&q=80', title: 'Energy Core Schematic' },
        ],
        downloads: [
            { name: 'Environmental Impact Report', url: '#' },
            { name: 'Structural Engineering Plans', url: '#' },
        ]
    },
    {
        id: 'venture_festival',
        name: 'Resonance Festival',
        description: 'An annual decentralized festival of art, music, and technology celebrating the TeO ethos. A global gathering of minds and spirits.',
        imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
        goalGRV: 750000,
        currentGRV: 620000,
        detailedDescription: "The Resonance Festival is a celebration of the creativity and innovation that the TeO ecosystem fosters. Held annually in a location chosen by the community, it features immersive art installations powered by GRV, performances from artists on teomusic.studio, and workshops on decentralized technologies. Contributions ensure the event remains accessible and allows for the commissioning of large-scale, interactive art pieces.",
        gallery: [
            { type: 'image', url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80', title: 'Main Stage Concept' },
            { type: 'image', url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&q=80', title: 'Interactive Light Forest' },
        ],
        downloads: [
            { name: 'Previous Year Recap Video', url: '#' },
        ]
    },
    {
        id: 'venture_travel',
        name: 'TeO Travel: Multiverse Expeditions',
        description: 'Access exclusive Hyper-Dimensional travel experiences, purchasable only with high-frequency GraviTON (GRV).',
        imageUrl: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&q=80',
        goalGRV: 25000000,
        currentGRV: 3125000,
        requiredFrequencyTier: 'High',
        detailedDescription: "Push the boundaries of reality with TeO Travel. This exclusive venture leverages theoretical physics and the Graviton network to offer simulated expeditions into alternate dimensions and conceptual realities. Access is restricted to Teonauts whose GRV resonates at the highest frequencies. This project funds the development of the quantum entanglement servers and the neural interface technology required for these unique, mind-bending journeys.",
        gallery: [
            { type: 'image', url: 'https://images.unsplash.com/photo-1618022035342-82a138e4742a?w=800&q=80', title: 'Conceptual Reality Render' },
            { type: 'image', url: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=800&q=80', title: 'The Quantum Gateway' },
        ],
        downloads: [
            { name: 'Whitepaper: Theoretical Framework', url: '#' },
            { name: 'Project Roadmap', url: '#' },
        ]
    },
];