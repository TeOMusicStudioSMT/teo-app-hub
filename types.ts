

import React from 'react';

export interface ProjectMedia {
  type: 'image' | 'video';
  url: string;
  title: string;
}
export interface ProjectDocument {
  title: string;
  url: string;
}
export interface ProjectDoc {
  name: string;
  url: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  isSubscribed?: boolean;
  media?: ProjectMedia[];
  documents?: ProjectDocument[];
  docs?: ProjectDoc[];
  narratorAvailable?: boolean;
  tags?: string[];
  isFavorite?: boolean;
  currency?: 'USD' | 'GRV';
}

export type UserTier = 'observer' | 'voyager' | 'architect' | 'singularity';

export interface WalletState {
  address: string | null;
  balance: string | null;
  tier: UserTier;
  frequencyTier: 'Low' | 'Medium' | 'High' | 'Superposition'; // Deprecated, keeping for now
  isGenesisNode?: boolean;
}

// --- AEGIS-Q & Admin Types ---
export interface TransactionData {
  transactionId: string;
  senderId: string;
  recipientId: string;
  amount: number;
  currency: 'GRV' | 'USD';
}

export interface AegisQReport {
  reportId: string;
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  threatType: 'ANOMALOUS_TRANSACTION';
  details: {
    pseudonymizedUserId: string;
    transactionAmount: number;
    recipientId: string;
    anomalyScore: number;
    context: string;
  };
  recommendedAction: string;
  complianceFlags: string[];
}

export interface PendingIncident {
  incidentId: string;
  userId: string;
  incidentType: 'suspicious login' | 'anomalous transaction';
  confidenceScore: number;
  timestamp: Date;
}


// --- Education Module Types ---

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  videoId: string; // YouTube video ID
  duration: number; // in minutes
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  reward: {
    type: 'badge';
    value: string; // Badge name
  };
}

export interface QuizProgress {
  [quizId: string]: {
    completed: boolean;
    score: number; // percentage
  };
}

export interface CosmicVenture {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  goalGRV: number;
  currentGRV: number;
  requiredFrequencyTier?: 'High' | 'Superposition';
  detailedDescription?: string;
  gallery?: ProjectMedia[];
  downloads?: ProjectDoc[];
}