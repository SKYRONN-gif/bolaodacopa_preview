import { Match, Player, Prediction } from '../types';

export type PredictionResultType = 'exact' | 'partial' | 'error' | 'unplayed';

export interface PredictionResult {
  points: number;
  type: PredictionResultType;
}

function getMatchOutcome(scoreA: number, scoreB: number): 'A' | 'B' | 'Draw' {
  if (scoreA > scoreB) return 'A';
  if (scoreA < scoreB) return 'B';
  return 'Draw';
}

/**
 * Calcula a pontuação de um palpite.
 *
 * Regras:
 * - Placar exato: 3 pontos
 * - Acertou vencedor ou empate: 1 ponto
 * - Errou o resultado: 0 pontos
 * - Jogo sem resultado ou sem palpite: não conta ainda
 */
export function calculatePredictionPoints(
  prediction: Prediction | undefined,
  match: Match
): PredictionResult {
  const matchHasNoResult =
    match.status !== 'finished' ||
    match.scoreA === undefined ||
    match.scoreB === undefined;

  if (!prediction || matchHasNoResult) {
    return { points: 0, type: 'unplayed' };
  }

  const isExactScore =
    prediction.scoreA === match.scoreA &&
    prediction.scoreB === match.scoreB;

  if (isExactScore) {
    return { points: 3, type: 'exact' };
  }

  const predictedOutcome = getMatchOutcome(prediction.scoreA, prediction.scoreB);
  const actualOutcome = getMatchOutcome(match.scoreA, match.scoreB);

  if (predictedOutcome === actualOutcome) {
    return { points: 1, type: 'partial' };
  }

  return { points: 0, type: 'error' };
}

/**
 * Recalcula o ranking inteiro com base nos jogos finalizados.
 */
export function computeLeaderboard(players: Player[], matches: Match[]): Player[] {
  return players
    .map((player) => {
      let points = 0;
      let exactHits = 0;
      let partialHits = 0;
      let errorHits = 0;

      matches.forEach((match) => {
        if (match.status !== 'finished') return;

        const prediction = player.predictions[match.id];

        if (!prediction) {
          errorHits++;
          return;
        }

        const result = calculatePredictionPoints(prediction, match);

        points += result.points;

        if (result.type === 'exact') exactHits++;
        if (result.type === 'partial') partialHits++;
        if (result.type === 'error') errorHits++;
      });

      return {
        ...player,
        points,
        exactHits,
        partialHits,
        errorHits,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }

      if (b.exactHits !== a.exactHits) {
        return b.exactHits - a.exactHits;
      }

      return a.name.localeCompare(b.name);
    });
}