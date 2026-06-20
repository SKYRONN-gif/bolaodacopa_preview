import assert from 'node:assert/strict';

import { calculatePrizes, getPaidParticipants } from '../src/domain/finance';
import {
  buildDuplicatePlayerPlans,
  getNormalizedEmail,
  mergePlayersByEmail,
  mergePlayersKeepingPrimary,
} from '../src/domain/playerMerge';
import { computeLeaderboard } from '../src/domain/scoring';
import { Match, Player, Prediction } from '../src/types';

function createMatch(
  id: string,
  scoreA: number,
  scoreB: number,
  startsAt = '2026-06-01T15:00:00.000Z'
): Match {
  return {
    id,
    teamA: `Time ${id} A`,
    teamB: `Time ${id} B`,
    flagA: 'A',
    flagB: 'B',
    date: '01/06/2026',
    time: '12:00',
    startsAt,
    startsAtMs: new Date(startsAt).getTime(),
    status: 'finished',
    scoreA,
    scoreB,
    group: 'Grupo A',
  };
}

function createPrediction(
  scoreA: number,
  scoreB: number,
  updatedAt: string
): Prediction {
  return {
    scoreA,
    scoreB,
    createdAt: updatedAt,
    updatedAt,
  };
}

function createPlayer(overrides: Partial<Player>): Player {
  return {
    id: 'player',
    name: 'Jogador',
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
    email: '',
    ...overrides,
  };
}

function applyDuplicatePlans(players: Player[], preferredPlayerId: string) {
  const plans = buildDuplicatePlayerPlans(players, preferredPlayerId);
  const duplicateIds = new Set(
    plans.flatMap((plan) => plan.duplicatePlayers.map((player) => player.id))
  );
  const mergedPlayersById = new Map(
    plans.map((plan) => [plan.primaryPlayer.id, plan.mergedPlayer])
  );

  return players
    .filter((player) => !duplicateIds.has(player.id))
    .map((player) => mergedPlayersById.get(player.id) || player);
}

const matches = [
  createMatch('m1', 1, 0),
  createMatch('m2', 2, 2),
  createMatch('m3', 0, 1),
];

const importedPlayers = [
  createPlayer({
    id: 'uid-main',
    name: 'Conta Google atual',
    email: 'Jogador@Example.com',
    manualPointsAdjustment: 1,
    predictions: {
      m1: createPrediction(0, 0, '2026-05-01T10:00:00.000Z'),
    },
  }),
  createPlayer({
    id: 'legacy-a',
    name: 'Conta antiga A',
    email: ' jogador@example.com ',
    manualPointsAdjustment: 50,
    predictions: {
      m1: createPrediction(1, 0, '2026-05-02T10:00:00.000Z'),
      m2: createPrediction(2, 2, '2026-05-02T10:10:00.000Z'),
    },
  }),
  createPlayer({
    id: 'legacy-b',
    name: 'Conta antiga B',
    email: 'JOGADOR@example.com',
    predictions: {
      m3: createPrediction(0, 1, '2026-05-03T10:00:00.000Z'),
    },
  }),
  createPlayer({
    id: 'other-player',
    name: 'Outro jogador',
    email: 'outro@example.com',
    predictions: {
      m1: createPrediction(1, 0, '2026-05-01T11:00:00.000Z'),
    },
  }),
];

const targetPlayerBeforeImport = createPlayer({
  id: 'same-id-player',
  name: 'Jogador no banco novo',
  email: 'mesmoid@example.com',
  predictions: {
    m1: createPrediction(9, 9, '2026-06-01T10:00:00.000Z'),
    m40: createPrediction(1, 1, '2026-06-10T10:00:00.000Z'),
  },
});
const oldPlayerWithSameId = createPlayer({
  id: 'same-id-player',
  name: 'Jogador no banco antigo',
  email: 'mesmoid@example.com',
  predictions: {
    m1: createPrediction(1, 0, '2026-06-02T10:00:00.000Z'),
    m2: createPrediction(2, 2, '2026-06-02T10:10:00.000Z'),
  },
});
const mergedSameIdPlayer = mergePlayersKeepingPrimary(
  targetPlayerBeforeImport,
  oldPlayerWithSameId
);

assert.deepEqual(Object.keys(mergedSameIdPlayer.predictions).sort(), [
  'm1',
  'm2',
  'm40',
]);
assert.equal(mergedSameIdPlayer.predictions.m1.scoreA, 1);
assert.equal(mergedSameIdPlayer.predictions.m40.scoreA, 1);

const duplicatePlans = buildDuplicatePlayerPlans(importedPlayers, 'uid-main');

assert.equal(duplicatePlans.length, 1);
assert.equal(duplicatePlans[0].email, 'jogador@example.com');
assert.equal(duplicatePlans[0].primaryPlayer.id, 'uid-main');
assert.deepEqual(
  duplicatePlans[0].duplicatePlayers.map((player) => player.id).sort(),
  ['legacy-a', 'legacy-b']
);
assert.equal(duplicatePlans[0].totalPredictions, 3);
assert.deepEqual(duplicatePlans[0].mergedPlayer.predictions.m1, {
  scoreA: 1,
  scoreB: 0,
  createdAt: '2026-05-02T10:00:00.000Z',
  updatedAt: '2026-05-02T10:00:00.000Z',
});
assert.equal(duplicatePlans[0].mergedPlayer.predictions.m2.scoreA, 2);
assert.equal(duplicatePlans[0].mergedPlayer.predictions.m3.scoreB, 1);
assert.equal(duplicatePlans[0].mergedPlayer.manualPointsAdjustment, 1);

const consolidatedPlayers = applyDuplicatePlans(importedPlayers, 'uid-main');
const normalizedEmails = consolidatedPlayers
  .map((player) => getNormalizedEmail(player.email))
  .filter(Boolean);

assert.equal(consolidatedPlayers.length, 2);
assert.equal(new Set(normalizedEmails).size, normalizedEmails.length);

const consolidatedMain = consolidatedPlayers.find(
  (player) => player.id === 'uid-main'
);

assert.ok(consolidatedMain);
assert.deepEqual(Object.keys(consolidatedMain.predictions).sort(), [
  'm1',
  'm2',
  'm3',
]);

const ranking = computeLeaderboard(consolidatedPlayers, matches);

assert.equal(ranking.length, 2);
assert.deepEqual(
  ranking.map((player) => getNormalizedEmail(player.email)),
  ['jogador@example.com', 'outro@example.com']
);
assert.equal(ranking[0].id, 'uid-main');
assert.equal(ranking[0].points, 10);
assert.equal(ranking[0].exactHits, 3);

const uniqueBeforeConsolidation = mergePlayersByEmail(importedPlayers);
const prizeBeforeConsolidation = calculatePrizes(
  getPaidParticipants(uniqueBeforeConsolidation).length
);
const prizeAfterConsolidation = calculatePrizes(
  getPaidParticipants(consolidatedPlayers).length
);
const prizeIfRawDuplicatesWereCounted = calculatePrizes(
  getPaidParticipants(importedPlayers).length
);

assert.deepEqual(prizeAfterConsolidation, prizeBeforeConsolidation);
assert.equal(prizeAfterConsolidation.totalPrizePool, 20);
assert.equal(prizeIfRawDuplicatesWereCounted.totalPrizePool, 40);

console.log(
  JSON.stringify(
    {
      duplicateEmailsFound: duplicatePlans.length,
      removedPlayers: duplicatePlans[0].duplicatePlayers.length,
      consolidatedPlayers: consolidatedPlayers.length,
      mainPlayerPredictions: Object.keys(consolidatedMain.predictions).length,
      ranking: ranking.map((player) => ({
        id: player.id,
        email: getNormalizedEmail(player.email),
        points: player.points,
        exactHits: player.exactHits,
      })),
      prizeAfterConsolidation,
    },
    null,
    2
  )
);
