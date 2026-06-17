import { calculatePredictionPoints } from './scoring';
import { Match, Player } from '../types';

type Outcome = 'A' | 'B' | 'Draw';

export interface TopScorePrediction {
  scoreLabel: string;
  count: number;
  playerNames: string[];
}

export interface MatchStats {
  totalPredictions: number;
  teamAWins: number;
  draws: number;
  teamBWins: number;
  topScores: TopScorePrediction[];
  exactPlayers: string[];
  partialPlayers: string[];
  errorPlayers: string[];
}

function getOutcome(scoreA: number, scoreB: number): Outcome {
  if (scoreA > scoreB) return 'A';
  if (scoreA < scoreB) return 'B';
  return 'Draw';
}

function addPlayerName(list: string[], player: Player) {
  list.push(player.name || 'Jogador');
}

export function buildMatchStats(match: Match, players: Player[]): MatchStats {
  let totalPredictions = 0;
  let teamAWins = 0;
  let draws = 0;
  let teamBWins = 0;

  const scoreMap = new Map<
    string,
    {
      scoreLabel: string;
      count: number;
      playerNames: string[];
    }
  >();

  const exactPlayers: string[] = [];
  const partialPlayers: string[] = [];
  const errorPlayers: string[] = [];

  players.forEach((player) => {
    const prediction = player.predictions?.[match.id];

    if (!prediction) return;

    totalPredictions++;

    const outcome = getOutcome(prediction.scoreA, prediction.scoreB);

    if (outcome === 'A') teamAWins++;
    if (outcome === 'Draw') draws++;
    if (outcome === 'B') teamBWins++;

    const scoreLabel = `${prediction.scoreA} x ${prediction.scoreB}`;
    const currentScore = scoreMap.get(scoreLabel);

    if (currentScore) {
      currentScore.count++;
      addPlayerName(currentScore.playerNames, player);
    } else {
      scoreMap.set(scoreLabel, {
        scoreLabel,
        count: 1,
        playerNames: [player.name || 'Jogador'],
      });
    }

    if (match.status === 'finished') {
      const result = calculatePredictionPoints(prediction, match);

      if (result.type === 'exact') {
        addPlayerName(exactPlayers, player);
      }

      if (result.type === 'partial') {
        addPlayerName(partialPlayers, player);
      }

      if (result.type === 'error') {
        addPlayerName(errorPlayers, player);
      }
    }
  });

  const topScores = Array.from(scoreMap.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;

      return a.scoreLabel.localeCompare(b.scoreLabel);
    })
    .slice(0, 5);

  return {
    totalPredictions,
    teamAWins,
    draws,
    teamBWins,
    topScores,
    exactPlayers: exactPlayers.sort(),
    partialPlayers: partialPlayers.sort(),
    errorPlayers: errorPlayers.sort(),
  };
}