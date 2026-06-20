import assert from 'node:assert/strict';

import { renderToStaticMarkup } from 'react-dom/server';

import { MatchCard } from '../src/features/matches/MatchCard';
import {
  getFilteredMatches,
  getMatchFilterCounts,
} from '../src/domain/matchFilters';
import { calculatePrizes, getPaidParticipants } from '../src/domain/finance';
import { isPredictionLocked } from '../src/domain/rules';
import {
  calculatePredictionPoints,
  computeLeaderboard,
} from '../src/domain/scoring';
import { Match, Player, Prediction } from '../src/types';

function createMatch(overrides: Partial<Match> = {}): Match {
  const startsAt = overrides.startsAt || '2099-06-01T15:00:00.000Z';

  return {
    id: 'match-1',
    teamA: 'Brasil',
    teamB: 'Argentina',
    flagA: 'BR',
    flagB: 'AR',
    date: '01/06/2099',
    time: '12:00',
    startsAt,
    startsAtMs: new Date(startsAt).getTime(),
    status: 'scheduled',
    group: 'Grupo A',
    ...overrides,
  };
}

function createPrediction(
  scoreA: number,
  scoreB: number,
  updatedAt = '2026-06-01T12:00:00.000Z'
): Prediction {
  return {
    scoreA,
    scoreB,
    createdAt: updatedAt,
    updatedAt,
  };
}

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Jogador Teste',
    avatar: '⚽',
    predictions: {},
    points: 0,
    exactHits: 0,
    partialHits: 0,
    errorHits: 0,
    manualPointsAdjustment: 0,
    manualPointsAdjustmentUpdatedAt: '',
    lastPredictionMatchId: '',
    isAdmin: false,
    email: 'jogador@example.com',
    ...overrides,
  };
}

const finishedMatch = createMatch({
  id: 'finished',
  status: 'finished',
  scoreA: 2,
  scoreB: 1,
});

assert.deepEqual(
  calculatePredictionPoints(createPrediction(2, 1), finishedMatch),
  { points: 3, type: 'exact' }
);
assert.deepEqual(
  calculatePredictionPoints(createPrediction(3, 0), finishedMatch),
  { points: 1, type: 'partial' }
);
assert.deepEqual(
  calculatePredictionPoints(createPrediction(0, 1), finishedMatch),
  { points: 0, type: 'error' }
);
assert.deepEqual(
  calculatePredictionPoints(undefined, finishedMatch),
  { points: 0, type: 'unplayed' }
);

const rankingMatches = [
  createMatch({ id: 'm1', status: 'finished', scoreA: 2, scoreB: 1 }),
  createMatch({ id: 'm2', status: 'finished', scoreA: 0, scoreB: 0 }),
  createMatch({ id: 'm3', status: 'finished', scoreA: 1, scoreB: 3 }),
];

const ranking = computeLeaderboard(
  [
    createPlayer({
      id: 'alice',
      name: 'Alice',
      manualPointsAdjustment: 2,
      predictions: {
        m1: createPrediction(2, 1),
        m2: createPrediction(1, 1),
      },
    }),
    createPlayer({
      id: 'bob',
      name: 'Bob',
      predictions: {
        m1: createPrediction(2, 1),
        m2: createPrediction(0, 0),
        m3: createPrediction(4, 4),
      },
    }),
  ],
  rankingMatches
);

assert.equal(ranking[0].id, 'bob');
assert.equal(ranking[0].points, 6);
assert.equal(ranking[0].exactHits, 2);
assert.equal(ranking[1].id, 'alice');
assert.equal(ranking[1].points, 6);
assert.equal(ranking[1].errorHits, 1);

const paidPlayers = getPaidParticipants([
  createPlayer({ id: 'paid-1', isAdmin: false }),
  createPlayer({ id: 'admin-1', isAdmin: true }),
  createPlayer({ id: 'paid-2', isAdmin: false }),
]);

assert.equal(paidPlayers.length, 2);
assert.deepEqual(calculatePrizes(paidPlayers.length), {
  totalPrizePool: 20,
  firstPrize: 16,
  secondPrize: 4,
});

const openWithoutPrediction = createMatch({ id: 'open-without-prediction' });
const openWithPrediction = createMatch({ id: 'open-with-prediction' });
const lockedWithoutPrediction = createMatch({
  id: 'locked-without-prediction',
  startsAt: '2000-06-01T15:00:00.000Z',
});
const lockedWithPrediction = createMatch({
  id: 'locked-with-prediction',
  startsAt: '2000-06-02T15:00:00.000Z',
});
const finishedWithResult = createMatch({
  id: 'finished-with-result',
  status: 'finished',
  scoreA: 1,
  scoreB: 1,
});
const filterMatches = [
  openWithoutPrediction,
  openWithPrediction,
  lockedWithoutPrediction,
  lockedWithPrediction,
  finishedWithResult,
];
const filterPlayer = createPlayer({
  predictions: {
    [openWithPrediction.id]: createPrediction(1, 0),
    [lockedWithPrediction.id]: createPrediction(0, 0),
  },
});

assert.deepEqual(getMatchFilterCounts(filterMatches, filterPlayer), {
  open: 2,
  missing: 1,
  predicted: 2,
  locked: 2,
  finished: 1,
  all: 5,
});
assert.deepEqual(
  getFilteredMatches(filterMatches, filterPlayer, 'missing').map(
    (match) => match.id
  ),
  ['open-without-prediction']
);
assert.deepEqual(
  getFilteredMatches(filterMatches, filterPlayer, 'locked').map(
    (match) => match.id
  ),
  ['locked-without-prediction', 'locked-with-prediction']
);
assert.equal(getFilteredMatches(filterMatches, filterPlayer, 'all').length, 5);

assert.equal(isPredictionLocked(openWithoutPrediction), false);
assert.equal(isPredictionLocked(lockedWithoutPrediction), true);
assert.equal(isPredictionLocked(finishedWithResult), true);

const cardMatch = createMatch({ id: 'card-match' });
const cardPlayer = createPlayer({
  predictions: {
    [cardMatch.id]: createPrediction(1, 0, '2026-06-01T12:30:00.000Z'),
  },
});
const noop = () => undefined;
const renderCard = (
  saveStatus: 'idle' | 'saving' | 'saved' | 'error',
  editedPrediction?: { scoreA: string; scoreB: string }
) =>
  renderToStaticMarkup(
    <MatchCard
      match={cardMatch}
      userPlayer={cardPlayer}
      editedPrediction={editedPrediction}
      canEdit
      saveStatus={saveStatus}
      onInputChange={noop}
      onSavePrediction={noop}
      onShareMatchWhatsApp={noop}
      onOpenDetails={noop}
    />
  );

assert.ok(
  renderCard('idle', { scoreA: '2', scoreB: '0' }).includes(
    'Alteração não salva'
  )
);
assert.ok(
  renderCard('saving', { scoreA: '2', scoreB: '0' }).includes(
    'Salvando palpite'
  )
);
assert.ok(
  renderCard('saved', { scoreA: '2', scoreB: '0' }).includes('Palpite salvo')
);
assert.ok(renderCard('idle').includes('Atualizado em'));

console.log(
  JSON.stringify(
    {
      scoring: 'passed',
      ranking: ranking.map((player) => ({
        id: player.id,
        points: player.points,
        exactHits: player.exactHits,
        partialHits: player.partialHits,
        errorHits: player.errorHits,
      })),
      filters: getMatchFilterCounts(filterMatches, filterPlayer),
      predictionLock: 'passed',
      predictionCardStatuses: 'passed',
      prizes: calculatePrizes(paidPlayers.length),
    },
    null,
    2
  )
);
