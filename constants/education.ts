import { Tutorial, Quiz } from '../types';

export const TUTORIALS: Tutorial[] = [
  {
    id: 'TUT01',
    title: 'Intro to Quantum Resistance',
    description: 'Learn the fundamentals of quantum-resistant cryptography and why it\'s essential for the future of blockchain security in this introductory video.',
    videoId: 'gSATt_g_T9o', // Placeholder video ID
    duration: 8,
  },
   {
    id: 'TUT02',
    title: 'Understanding $GRV Tokenomics',
    description: 'A deep dive into the economic model of the Graviton token ($GRV), including supply, distribution, and utility within the TeO ecosystem.',
    videoId: 's-p_Kk5L1sI', // Placeholder video ID
    duration: 12,
  },
  {
    id: 'TUT03',
    title: 'Field Control Ops',
    description: 'Master the TeO Hub Field Control interface. Learn to manage drones, intel, and supply chains from the central dashboard.',
    videoId: 'field_control_intro', // Placeholder
    duration: 15,
  }
];

export const QUIZZES: Quiz[] = [
  {
    id: 'QUIZ01',
    title: 'Graviton (GRV) Basics',
    description: 'Test your foundational knowledge of the Graviton token and its role in the TeO Hub.',
    reward: {
      type: 'badge',
      value: 'GRV Initiate',
    },
    questions: [
      {
        question: 'What is the primary function of the Graviton (GRV) token?',
        options: [
          'A governance token for voting',
          'A utility token to fuel the ecosystem',
          'A stablecoin pegged to USD',
          'A security token representing shares'
        ],
        correctAnswer: 'A utility token to fuel the ecosystem',
      },
      {
        question: 'Which TeO project focuses on developing the core GRV blockchain?',
        options: [
          'teomusic.studio',
          'teostory.studio',
          'teoblockchain.studio',
          'graviton.dream'
        ],
        correctAnswer: 'teoblockchain.studio',
      },
      {
        question: 'The GRV blockchain is designed to be resistant to attacks from what type of technology?',
        options: [
          'Artificial Intelligence',
          '5G Networks',
          'Quantum Computers',
          'Solar Flares'
        ],
        correctAnswer: 'Quantum Computers',
      },
    ],
  },
  {
    id: 'QUIZ02',
    title: 'TeO Hub Architecture',
    description: 'Verify your understanding of the TeO Hub components and the Genessia Protocol.',
    reward: {
        type: 'badge',
        value: 'System Architect',
    },
    questions: [
        {
            question: 'What is the primary purpose of the "Field Control" module?',
            options: [
                'To play video games',
                'To manage physical assets (drones, supply) and intel',
                'To mine cryptocurrencies',
                'To stream music'
            ],
            correctAnswer: 'To manage physical assets (drones, supply) and intel',
        },
        {
            question: 'Which AI model is used for routine, low-energy tasks (Flash Optimization)?',
            options: [
                'Gemini 1.5 Pro',
                'GPT-4',
                'Gemini 1.5 Flash',
                'Gemma 2B'
            ],
            correctAnswer: 'Gemini 1.5 Flash',
        },
        {
            question: 'What does "Genessia Protocol" primarily define?',
            options: [
                'The color scheme of the app',
                'The operational logic and definitions of the Hub ecosystem',
                'A new programming language',
                'A marketing strategy'
            ],
            correctAnswer: 'The operational logic and definitions of the Hub ecosystem',
        }
    ]
  }
];
