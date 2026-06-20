import { isPredictionLocked } from './rules';
import { Match, Player } from '../types';

export type MatchFilter =
  | 'open'
  | 'all'
  | 'predicted'
  | 'missing'
  | 'locked'
  | 'finished';

export interface MatchFilterCounts {
  open: number;
  missing: number;
  predicted: number;
  locked: number;
  finished: number;
  all: number;
}

export function isMatchOpenForPrediction(match: Match) {
  return match.status === 'scheduled' && !isPredictionLocked(match);
}

function hasPrediction(player: Player, match: Match) {
  return Boolean(player.predictions?.[match.id]);
}

export function getMatchFilterCounts(
  matches: Match[],
  userPlayer: Player
): MatchFilterCounts {
  return matches.reduce<MatchFilterCounts>(
    (counts, match) => {
      const matchHasPrediction = hasPrediction(userPlayer, match);
      const isOpen = isMatchOpenForPrediction(match);
      const isFinished = match.status === 'finished';
      const isLocked = isPredictionLocked(match);

      if (isOpen) counts.open++;
      if (isOpen && !matchHasPrediction) counts.missing++;
      if (matchHasPrediction) counts.predicted++;
      if (isLocked && !isFinished) counts.locked++;
      if (isFinished) counts.finished++;

      counts.all++;

      return counts;
    },
    {
      open: 0,
      missing: 0,
      predicted: 0,
      locked: 0,
      finished: 0,
      all: 0,
    }
  );
}

export function getFilteredMatches(
  matches: Match[],
  userPlayer: Player,
  activeFilter: MatchFilter
) {
  return matches.filter((match) => {
    const matchHasPrediction = hasPrediction(userPlayer, match);
    const isOpen = isMatchOpenForPrediction(match);
    const isFinished = match.status === 'finished';
    const isLocked = isPredictionLocked(match);

    if (activeFilter === 'open') return isOpen;
    if (activeFilter === 'predicted') return matchHasPrediction;
    if (activeFilter === 'missing') return isOpen && !matchHasPrediction;
    if (activeFilter === 'locked') return isLocked && !isFinished;
    if (activeFilter === 'finished') return isFinished;

    return true;
  });
}
