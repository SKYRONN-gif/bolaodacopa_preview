import { calculatePredictionPoints } from './scoring';
import { Match, Player } from '../types';

export type AwardType = 'exact' | 'streak' | 'errors' | 'almost';

export interface AwardWinner {
  player: Player;
  value: number;
}

export interface Award {
  type: AwardType;
  title: string;
  description: string;
  valueLabel: string;
  winners: AwardWinner[];
}

function getFinishedMatches(matches: Match[]) {
  return matches
    .filter(
      (match) =>
        match.status === 'finished' &&
        typeof match.scoreA === 'number' &&
        typeof match.scoreB === 'number'
    )
    .sort((a, b) => a.startsAtMs - b.startsAtMs);
}

function getTopWinners(
  players: Player[],
  getValue: (player: Player) => number
): AwardWinner[] {
  const values = players
    .map((player) => ({
      player,
      value: getValue(player),
    }))
    .filter((item) => item.value > 0);

  if (values.length === 0) return [];

  const highestValue = Math.max(...values.map((item) => item.value));

  return values
    .filter((item) => item.value === highestValue)
    .sort((a, b) => a.player.name.localeCompare(b.player.name));
}

function getExactHits(player: Player, matches: Match[]) {
  return matches.reduce((total, match) => {
    const prediction = player.predictions?.[match.id];
    const result = calculatePredictionPoints(prediction, match);

    return result.type === 'exact' ? total + 1 : total;
  }, 0);
}

function getPredictionErrors(player: Player, matches: Match[]) {
  return matches.reduce((total, match) => {
    const prediction = player.predictions?.[match.id];

    if (!prediction) return total;

    const result = calculatePredictionPoints(prediction, match);

    return result.type === 'error' ? total + 1 : total;
  }, 0);
}

function getAlmostHits(player: Player, matches: Match[]) {
  return matches.reduce((total, match) => {
    const prediction = player.predictions?.[match.id];

    if (
      !prediction ||
      typeof match.scoreA !== 'number' ||
      typeof match.scoreB !== 'number'
    ) {
      return total;
    }

    const result = calculatePredictionPoints(prediction, match);

    if (result.type === 'exact') return total;

    const scoreDistance =
      Math.abs(prediction.scoreA - match.scoreA) +
      Math.abs(prediction.scoreB - match.scoreB);

    return scoreDistance === 1 ? total + 1 : total;
  }, 0);
}

function getBestScoringStreak(player: Player, matches: Match[]) {
  let currentStreak = 0;
  let bestStreak = 0;

  matches.forEach((match) => {
    const prediction = player.predictions?.[match.id];
    const result = calculatePredictionPoints(prediction, match);

    if (result.points > 0) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
      return;
    }

    if (prediction) {
      currentStreak = 0;
    }
  });

  return bestStreak;
}

function formatWinnerNames(winners: AwardWinner[]) {
  return winners.map((winner) => winner.player.name).join(', ');
}

export function buildAwards(players: Player[], matches: Match[]): Award[] {
  const finishedMatches = getFinishedMatches(matches);

  if (finishedMatches.length === 0) {
    return [];
  }

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
      description: 'Mais jogos seguidos pontuando.',
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
      description: 'Mais palpites que passaram perto.',
      valueLabel: almostWinners[0]
        ? `${almostWinners[0].value} quase`
        : 'Sem vencedor',
      winners: almostWinners,
    },
  ];

  return awards.filter((award) => award.winners.length > 0);
}

export function getAwardWinnerText(award: Award) {
  if (award.winners.length === 0) return 'Sem vencedor ainda.';

  return formatWinnerNames(award.winners);
}
