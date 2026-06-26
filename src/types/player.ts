import type { Prediction } from './prediction';

//usado no banco e na importacação legada (oq é legada?) usado nos components e no banco, e representa um participante
export interface Player {
  id: string;
  name: string;
  avatar: string;
  predictions: Record<string, Prediction>; // matchId -> prediction tipo map<string do matchid (o id de match) e o prediction
  points: number; //total
  exactHits: number;   // Acertos exatos (3 pts)
  partialHits: number; // Acertos parciais / Ganhador (1 pt)
  errorHits: number;   // Erros (0 pts)
  manualPointsAdjustment?: number; //quanto mudou
  manualPointsAdjustmentUpdatedAt?: string; //quando mudou
/**
 * Informa qual partida teve o palpite alterado por último.
 *
 * As Firestore Rules usam esse campo para verificar que somente um
 * palpite foi modificado e que a partida ainda estava aberta.
 */
  lastPredictionMatchId?: string;
  isAdmin?: boolean; // indica perfil administrativo; a permissão real é validada pelas Firestore Rules
  email?: string; // usado para vincular o perfil ao login Google e encontrar jogadores importados
}