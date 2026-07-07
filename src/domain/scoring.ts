import type { Match, Player, Prediction } from '../types';

// Pontos definidos pelas regras atuais do bolão.
//
// Manter esses valores nomeados evita números “mágicos” espalhados
// pelo cálculo e facilita alterar a pontuação no futuro.
const EXACT_SCORE_POINTS = 3;
const CORRECT_OUTCOME_POINTS = 1;

// Define os únicos resultados possíveis após avaliar um palpite.
//
// exact:
// acertou os dois placares.
//
// partial:
// acertou vencedor ou empate, mas errou algum placar.
//
// error:
// enviou palpite, mas errou vencedor/empate.
//
// unplayed:
// jogo ainda não possui resultado válido ou jogador não enviou palpite.
export type PredictionResultType =
  | 'exact'
  | 'partial'
  | 'error'
  | 'unplayed';

// Define o formato retornado após calcular um palpite.
//
// Interface não é executada no navegador. Ela serve para o TypeScript
// garantir que toda avaliação retorne pontos e um tipo de resultado válido.
export interface PredictionResult {
  points: number;
  type: PredictionResultType;
}

// Identifica o resultado de uma partida sem se importar com o placar exato.
//
// A:
// time A venceu.
//
// B:
// time B venceu.
//
// Draw:
// houve empate.
function getMatchOutcome(
  scoreA: number,
  scoreB: number
): 'A' | 'B' | 'Draw' {
  if (scoreA > scoreB) {
    return 'A';
  }

  if (scoreA < scoreB) {
    return 'B';
  }

  return 'Draw';
}

// Calcula a pontuação de um palpite em relação ao resultado oficial.
//
// Regras:
// placar exato: 3 pontos.
// acertou vencedor ou empate: 1 ponto.
// errou vencedor/empate: 0 pontos.
// jogo sem resultado ou sem palpite: não entra na estatística ainda.
export function calculatePredictionPoints(
  prediction: Prediction | undefined,
  match: Match
): PredictionResult {
  // Confirma que existe resultado oficial válido antes de calcular pontos.
  //
  // Mesmo que o status seja finished, o cálculo não deve continuar sem
  // scoreA e scoreB numéricos.
  const matchHasNoResult =
    match.status !== 'finished' ||
    match.scoreA === undefined ||
    match.scoreB === undefined ||
    !Number.isFinite(match.scoreA) ||
    !Number.isFinite(match.scoreB);

  // Sem palpite válido ou sem resultado oficial, não existe pontuação
  // nem erro contabilizado ainda.
  if (
    !prediction ||
    !Number.isFinite(prediction.scoreA) ||
    !Number.isFinite(prediction.scoreB) ||
    matchHasNoResult
  ) {
    return {
      points: 0,
      type: 'unplayed',
    };
  }

  // Confere se o usuário acertou os dois placares exatamente.
  const isExactScore =
    prediction.scoreA === match.scoreA &&
    prediction.scoreB === match.scoreB;

  if (isExactScore) {
    return {
      points: EXACT_SCORE_POINTS,
      type: 'exact',
    };
  }

  // Compara somente vencedor ou empate quando o placar exato não foi acertado.
  const predictedOutcome = getMatchOutcome(
    prediction.scoreA,
    prediction.scoreB
  );

  const actualOutcome = getMatchOutcome(
    match.scoreA,
    match.scoreB
  );

  if (predictedOutcome === actualOutcome) {
    return {
      points: CORRECT_OUTCOME_POINTS,
      type: 'partial',
    };
  }

  // O jogador enviou palpite, mas errou vencedor ou empate.
  return {
    points: 0,
    type: 'error',
  };
}

// Recalcula ranking e estatísticas usando todos os jogos finalizados.
//
// O valor de points salvo no documento do jogador não é usado como fonte
// principal. O ranking é recalculado a partir de palpites, resultados oficiais
// e ajuste manual, reduzindo o risco de pontuação antiga ficar incorreta.
export function computeLeaderboard(
  players: Player[],
  matches: Match[]
): Player[] {
  return players
    .map((player) => {
      // Ajuste manual é aplicado antes de somar os pontos dos palpites.
      //
      // ?? usa 0 apenas quando o campo não existe ou é null.
      let points = player.manualPointsAdjustment ?? 0;

      let exactHits = 0;
      let partialHits = 0;
      let errorHits = 0;

      // for...of deixa o fluxo mais claro do que forEach neste caso.
      //
      // continue significa: ignore apenas este jogo e vá para o próximo.
      for (const match of matches) {
        if (match.status !== 'finished') {
          continue;
        }

        // Busca o palpite deste jogador para a partida atual.
        const prediction = player.predictions?.[match.id];

        // Centraliza a decisão de pontuação em uma única função.
        const result = calculatePredictionPoints(prediction, match);

        // Sem palpite ou sem resultado oficial, não soma ponto nem erro.
        if (result.type === 'unplayed') {
          continue;
        }

        points += result.points;

        if (result.type === 'exact') {
          exactHits++;
        } else if (result.type === 'partial') {
          partialHits++;
        } else {
          errorHits++;
        }
      }

      // Cria um novo objeto Player com ranking e estatísticas recalculadas.
      //
      // ...player copia os demais campos, como id, nome, avatar e palpites.
      return {
        ...player,
        points,
        exactHits,
        partialHits,
        errorHits,
      };
    })
    .sort((playerA, playerB) => {
      // Mais pontos fica acima no ranking.
      if (playerB.points !== playerA.points) {
        return playerB.points - playerA.points;
      }

      // Em empate de pontos, quem possui mais placares exatos fica acima.
      if (playerB.exactHits !== playerA.exactHits) {
        return playerB.exactHits - playerA.exactHits;
      }

      // Persistindo o empate, organiza por nome em ordem alfabética.
      return playerA.name.localeCompare(playerB.name);
    });
}