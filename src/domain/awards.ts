import { calculatePredictionPoints } from './scoring';
import type { Match, Player } from '../types';

// Define os tipos de prêmios que podem aparecer no painel.
export type AwardType = 'exact' | 'streak' | 'errors' | 'almost';

// Representa um jogador que venceu ou empatou em um prêmio.
//
// value é o número que fez esse jogador ganhar.
// Exemplo: 4 placares exatos ou 3 jogos seguidos pontuando.
export interface AwardWinner {
  player: Player;
  value: number;
}

// Representa todas as informações necessárias para exibir um card de prêmio.
export interface Award {
  type: AwardType;
  title: string;
  description: string;
  valueLabel: string;
  winners: AwardWinner[];
}

// Mantém apenas partidas finalizadas com placares oficiais válidos.
//
// A ordenação por startsAtMs coloca os jogos do mais antigo para o mais recente.
// Isso é necessário para calcular corretamente a "Sequência quente".
function getFinishedMatches(matches: Match[]): Match[] {
  return matches
    .filter(
      (match) =>
        match.status === 'finished' &&
        typeof match.scoreA === 'number' &&
        Number.isFinite(match.scoreA) &&
        typeof match.scoreB === 'number' &&
        Number.isFinite(match.scoreB)
    )
    .sort((matchA, matchB) => matchA.startsAtMs - matchB.startsAtMs);
}

// Descobre quais jogadores possuem o maior valor para um prêmio.
//
// calculateValue é uma função recebida como parâmetro.
// Ela diz qual número deve ser calculado para cada jogador.
//
// Exemplos:
// - Para "Maior acerto", calcula quantos placares exatos cada jogador teve.
// - Para "Zicado do momento", calcula quantos palpites errados cada jogador enviou.
function getTopWinners(
  players: Player[],
  calculateValue: (player: Player) => number
): AwardWinner[] {
  // map cria uma nova lista contendo cada jogador e o valor calculado para ele.
  //
  // Exemplo:
  // [{ player: João, value: 3 }, { player: Maria, value: 5 }]
  const values = players
    .map((player) => ({
      player,
      value: calculateValue(player),
    }))

    // filter remove jogadores que possuem valor 0.
    // Ninguém com 0 acertos, 0 erros ou 0 quase deve aparecer como vencedor.
    .filter((item) => item.value > 0);

  if (values.length === 0) {
    return [];
  }

  // Primeiro map pega apenas os números da lista.
  //
  // Exemplo:
  // [{ João, 3 }, { Maria, 5 }]
  // ↓
  // [3, 5]
  //
  // O ... espalha esses valores para Math.max:
  // Math.max(3, 5) → 5
  const highestValue = Math.max(...values.map((item) => item.value));

  // Mantém todos que empataram com o maior valor encontrado.
  //
  // sort não decide quem ganhou. Ele só organiza empates por nome,
  // deixando a interface consistente.
  return values
    .filter((item) => item.value === highestValue)
    .sort((winnerA, winnerB) =>
      winnerA.player.name.localeCompare(winnerB.player.name)
    );
}

// Conta quantos placares exatos o jogador acertou.
//
// reduce percorre cada partida e mantém um acumulador chamado total.
// O 0 no fim é o valor inicial desse acumulador.
function getExactHits(player: Player, matches: Match[]): number {
  return matches.reduce((total, match) => {
    // Busca o palpite deste jogador para a partida atual.
    const prediction = player.predictions?.[match.id];

    // Reutiliza a regra oficial de pontuação do bolão.
    const result = calculatePredictionPoints(prediction, match);

    // Se o resultado foi exato, soma 1 no acumulador.
    // Caso contrário, mantém o total atual.
    return result.type === 'exact' ? total + 1 : total;
  }, 0);
}

// Conta quantos palpites enviados pelo jogador erraram vencedor ou empate.
//
// Não enviar palpite não conta como erro.
// A pessoa não recebe pontos, mas também não entra no prêmio "Zicado".
function getPredictionErrors(player: Player, matches: Match[]): number {
  return matches.reduce((total, match) => {
    const prediction = player.predictions?.[match.id];

    // Sem palpite, mantém a quantidade atual de erros.
    if (!prediction) {
      return total;
    }

    const result = calculatePredictionPoints(prediction, match);

    // Só soma erro quando o jogador enviou um palpite e ele foi avaliado
    // como error pela regra oficial de pontuação.
    return result.type === 'error' ? total + 1 : total;
  }, 0);
}

// Conta palpites que ficaram a apenas um gol de distância do placar oficial.
//
// "Quase" considera a distância total entre os dois placares.
//
// Exemplo:
// Resultado oficial: 2 x 1
// Palpite: 2 x 2
// Distância: |2 - 2| + |2 - 1| = 0 + 1 = 1
// Portanto, conta como quase.
//
// Essa regra pode considerar "quase" mesmo se a pessoa errou vencedor ou empate.
function getAlmostHits(player: Player, matches: Match[]): number {
  return matches.reduce((total, match) => {
    const prediction = player.predictions?.[match.id];

    // Sem palpite ou sem placar oficial válido, não há como avaliar "quase".
    if (
      !prediction ||
      typeof match.scoreA !== 'number' ||
      !Number.isFinite(match.scoreA) ||
      typeof match.scoreB !== 'number' ||
      !Number.isFinite(match.scoreB)
    ) {
      return total;
    }

    const result = calculatePredictionPoints(prediction, match);

    // Placar exato já é uma categoria melhor, então não entra como "quase".
    if (result.type === 'exact') {
      return total;
    }

    // Math.abs transforma uma diferença negativa em positiva.
    //
    // Exemplo:
    // Math.abs(1 - 2) → 1
    const scoreDistance =
      Math.abs(prediction.scoreA - match.scoreA) +
      Math.abs(prediction.scoreB - match.scoreB);

    // Só soma quando a diferença total for exatamente um gol.
    return scoreDistance === 1 ? total + 1 : total;
  }, 0);
}

// Calcula a maior sequência de palpites enviados que renderam pontos.
//
// Regra atual:
// - Palpite que pontuou: aumenta a sequência.
// - Palpite enviado que não pontuou: quebra a sequência.
// - Jogo sem palpite: não soma, mas também não quebra a sequência.
function getBestScoringStreak(player: Player, matches: Match[]): number {
  let currentStreak = 0;
  let bestStreak = 0;

  // Os jogos já chegam ordenados do mais antigo para o mais recente.
  matches.forEach((match) => {
    const prediction = player.predictions?.[match.id];
    const result = calculatePredictionPoints(prediction, match);

    // Acertou algo e ganhou ponto: aumenta a sequência atual.
    if (result.points > 0) {
      currentStreak++;

      // Guarda a maior sequência que já aconteceu até este momento.
      bestStreak = Math.max(bestStreak, currentStreak);
      return;
    }

    // Sem palpite, mantém a sequência como está.
    //
    // Com palpite enviado e sem ponto, encerra a sequência.
    if (prediction) {
      currentStreak = 0;
    }
  });

  return bestStreak;
}

// Junta os nomes dos vencedores para a interface.
//
// Exemplo:
// ["João", "Maria", "Pedro"]
// ↓
// "João, Maria, Pedro"
function formatWinnerNames(winners: AwardWinner[]): string {
  return winners.map((winner) => winner.player.name).join(', ');
}

// Monta todos os cards de prêmio usando jogadores e partidas.
export function buildAwards(players: Player[], matches: Match[]): Award[] {
  const finishedMatches = getFinishedMatches(matches);

  // Sem partidas finalizadas, não existe informação suficiente para premiar alguém.
  if (finishedMatches.length === 0) {
    return [];
  }

  // Para cada prêmio, getTopWinners chama a função recebida uma vez por jogador.
  const exactWinners = getTopWinners(players, (player) =>
    getExactHits(player, finishedMatches)
  );

  const streakWinners = getTopWinners(players, (player) =>
    getBestScoringStreak(player, finishedMatches)
  );

  const errorWinners = getTopWinners(players, (player) =>
    getPredictionErrors(player, finishedMatches)
  );

  const almostWinners = getTopWinners(players, (player) =>
    getAlmostHits(player, finishedMatches)
  );

  const awards: Award[] = [
    {
      type: 'exact',
      title: 'Maior acerto',
      description: 'Mais placares exatos até agora.',
      valueLabel: exactWinners[0]
        ? `${exactWinners[0].value} exatos`
        : 'Sem vencedor',
      winners: exactWinners,
    },
    {
      type: 'streak',
      title: 'Sequência quente',
      description: 'Maior sequência de palpites enviados que pontuaram.',
      valueLabel: streakWinners[0]
        ? `${streakWinners[0].value} jogos`
        : 'Sem vencedor',
      winners: streakWinners,
    },
    {
      type: 'errors',
      title: 'Zicado do momento',
      description: 'Mais palpites errados enviados.',
      valueLabel: errorWinners[0]
        ? `${errorWinners[0].value} erros`
        : 'Sem vencedor',
      winners: errorWinners,
    },
    {
      type: 'almost',
      title: 'Quase lá',
      description: 'Mais palpites a apenas um gol do placar oficial.',
      valueLabel: almostWinners[0]
        ? `${almostWinners[0].value} quase`
        : 'Sem vencedor',
      winners: almostWinners,
    },
  ];

  // Não exibe cards sem vencedores.
  return awards.filter((award) => award.winners.length > 0);
}

// Retorna os nomes dos vencedores do prêmio para exibição na tela.
export function getAwardWinnerText(award: Award): string {
  if (award.winners.length === 0) {
    return 'Sem vencedor ainda.';
  }

  return formatWinnerNames(award.winners);
}