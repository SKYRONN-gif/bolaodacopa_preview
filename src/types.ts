/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Match {
  id: string;
  teamA: string;
  teamB: string;

  // Mantemos flagA/flagB porque o app atual já usa isso.
  // Para jogos vindos da API, podemos preencher com siglas tipo BRA, ARG, FRA.
  flagA: string;
  flagB: string;

  date: string; // exemplo: "13/06/2026"
  time: string; // HH:MM

  startsAt: string; // ISO datetime usado para travar palpite
  startsAtMs: number; // epoch ms usado nas Firestore Rules

  status: 'scheduled' | 'finished';

  scoreA?: number; // placar real, apenas se finalizado
  scoreB?: number; // placar real, apenas se finalizado

  group: string;
  venue?: string;
  city?: string;

  // Campos vindos da API
  apiFixtureId?: string;
  logoA?: string | null;
  logoB?: string | null;
  source?: 'espn' | 'openfootball' | string;
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
  manualPointsAdjustment?: number;
  manualPointsAdjustmentUpdatedAt?: string;
  lastPredictionMatchId?: string;
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

export interface ChampionPickTeam {
  code: string;
  name: string;
  logo?: string | null;
}

export interface ChampionPickSettings {
  enabled: boolean;
  locked: boolean;
  bonusPoints: number;
  championTeamCode: string;
  eligibleTeams: ChampionPickTeam[];
  updatedAt?: string;
}