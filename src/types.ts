/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Match {
  id: string;
  teamA: string;
  teamB: string;
  flagA: string;
  flagB: string;
  date: string; // ISO string or readable
  time: string; // HH:MM
  startsAt?: string; // ISO datetime used for prediction locking
  status: 'scheduled' | 'finished';
  scoreA?: number; // actual score
  scoreB?: number; // actual score
  group: string;
  venue?: string;
  city?: string;
}

export interface Prediction {
  scoreA: number;
  scoreB: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  predictions: Record<string, Prediction>; // matchId -> prediction
  points: number;
  exactHits: number;   // Acertos exatos (3 pts)
  partialHits: number; // Acertos parciais / Ganhador (1 pt)
  errorHits: number;   // Erros (0 pts)
  isAdmin?: boolean;
  email?: string;
}

export interface BolaoRules {
  entryFee: number; // R$ 10.00
  firstPlacePercentage: number; // 0.8
  secondPlacePercentage: number; // 0.2
  pointsExact: number; // 3
  pointsPartial: number; // 1
  pointsError: number; // 0
}

export type AppTab = 'home' | 'matches' | 'ranking' | 'admin';
