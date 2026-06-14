import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { computeLeaderboard } from '../src/domain/scoring';
import {
  buildPredictionAuditRows,
  paginateRows,
} from '../src/features/leaderboard/auditRows';
import {
  normalizeMatchDocument,
  normalizePlayerDocument,
} from '../src/services/firestoreNormalizers';
import { Match, Player, Prediction } from '../src/types';

function createMatch(index: number): Match {
  const startsAt = new Date(Date.UTC(2026, 5, 11 + index, 19, 0, 0));

  return {
    id: `m${index + 1}`,
    teamA: `Time ${index * 2 + 1}`,
    teamB: `Time ${index * 2 + 2}`,
    flagA: 'A',
    flagB: 'B',
    date: startsAt.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
    time: '16:00',
    startsAt: startsAt.toISOString(),
    startsAtMs: startsAt.getTime(),
    status: index % 3 === 0 ? 'finished' : 'scheduled',
    scoreA: index % 3 === 0 ? index % 5 : undefined,
    scoreB: index % 3 === 0 ? (index + 2) % 4 : undefined,
    group: index < 72 ? `Grupo ${Math.floor(index / 6) + 1}` : 'Mata-mata',
  };
}

function createPrediction(playerIndex: number, matchIndex: number): Prediction {
  const savedAt = new Date(
    Date.UTC(2026, 4, 1, 12, playerIndex % 60, matchIndex % 60)
  ).toISOString();

  return {
    scoreA: (playerIndex + matchIndex) % 5,
    scoreB: (playerIndex * 2 + matchIndex) % 4,
    createdAt: savedAt,
    updatedAt: savedAt,
  };
}

function createPlayer(index: number, matches: Match[]): Player {
  const predictions: Record<string, Prediction> = {};

  matches.forEach((match, matchIndex) => {
    predictions[match.id] = createPrediction(index, matchIndex);
  });

  return {
    id: `player-${index + 1}`,
    name: `Jogador ${index + 1}`,
    avatar: String((index % 10) + 1),
    predictions,
    points: 0,
    exactHits: 0,
    partialHits: 0,
    errorHits: 0,
    manualPointsAdjustment: index % 4 === 0 ? 1 : 0,
    manualPointsAdjustmentUpdatedAt: '',
    lastPredictionMatchId: matches.at(-1)?.id || '',
    isAdmin: false,
    email: `jogador${index + 1}@example.com`,
  };
}

function normalizeMatches(rawMatches: Array<[string, unknown]>) {
  return rawMatches
    .map(([documentId, match]) => normalizeMatchDocument(documentId, match))
    .filter((match): match is Match => Boolean(match));
}

function normalizePlayers(rawPlayers: Array<[string, unknown]>) {
  return rawPlayers
    .map(([documentId, player]) => normalizePlayerDocument(documentId, player))
    .filter((player): player is Player => Boolean(player));
}

const manualStartsAt = new Date('2026-06-13T18:00:00.123Z');
const manualPredictionUpdatedAt = new Date('2026-06-13T19:15:00.000Z');
const manualAdjustmentUpdatedAt = new Date('2026-06-14T10:30:00.000Z');
const firestoreTimestampLike = {
  seconds: Math.floor(manualStartsAt.getTime() / 1000),
  nanoseconds: manualStartsAt.getUTCMilliseconds() * 1_000_000,
};

const manualMatches = normalizeMatches([
  [
    'm1',
    {
      id: 'wrong-id',
      teamA: '',
      teamB: '  Argentina  ',
      flagA: 123,
      flagB: 'AR',
      date: null,
      time: undefined,
      startsAt: firestoreTimestampLike,
      startsAtMs: 'not-a-number',
      status: 'finished',
      scoreA: '2',
      scoreB: '1',
      group: '',
      venue: 'A'.repeat(300),
    },
  ],
  ['m2', { teamA: 'Brasil', teamB: 'Mexico', status: 'scheduled' }],
  ['bad-doc', null],
]);

const manualPlayers = normalizePlayers([
  [
    'player-1',
    {
      id: 'different-player-id',
      name: '  '.padEnd(200, 'N'),
      avatar: 42,
      predictions: {
        m1: {
          scoreA: '2',
          scoreB: '1',
          createdAt: firestoreTimestampLike,
          updatedAt: { toDate: () => manualPredictionUpdatedAt },
        },
        m2: { scoreA: '0', scoreB: 1 },
        brokenScore: { scoreA: 'abc', scoreB: 1 },
        missingMatch: { scoreA: 9, scoreB: 9 },
      },
      points: '100',
      exactHits: 'bad',
      partialHits: null,
      errorHits: undefined,
      manualPointsAdjustment: '3',
      manualPointsAdjustmentUpdatedAt: {
        _seconds: Math.floor(manualAdjustmentUpdatedAt.getTime() / 1000),
        _nanoseconds: 0,
      },
      lastPredictionMatchId: 'm1',
      isAdmin: 'true',
      email: 123,
    },
  ],
  ['player-2', { name: 'Sem palpites', predictions: null }],
  ['bad-player', []],
]);

assert.equal(manualMatches.length, 2);
assert.equal(manualMatches[0].id, 'm1');
assert.equal(manualMatches[0].teamA, 'Time A');
assert.equal(manualMatches[0].startsAt, manualStartsAt.toISOString());
assert.equal(manualMatches[0].startsAtMs, manualStartsAt.getTime());
assert.equal(manualMatches[0].scoreA, 2);
assert.equal(manualPlayers.length, 2);
assert.equal(manualPlayers[0].id, 'player-1');
assert.equal(manualPlayers[0].name.length, 128);
assert.equal(manualPlayers[0].isAdmin, false);
assert.equal(Object.keys(manualPlayers[0].predictions).length, 3);
assert.equal(
  manualPlayers[0].predictions.m1.createdAt,
  manualStartsAt.toISOString()
);
assert.equal(
  manualPlayers[0].predictions.m1.updatedAt,
  manualPredictionUpdatedAt.toISOString()
);
assert.equal(
  manualPlayers[0].manualPointsAdjustmentUpdatedAt,
  manualAdjustmentUpdatedAt.toISOString()
);

const manualLeaderboard = computeLeaderboard(manualPlayers, manualMatches);
const manualAuditRows = buildPredictionAuditRows(manualMatches, manualPlayers);

assert.equal(manualLeaderboard.length, 2);
assert.equal(manualLeaderboard[0].points, 6);
assert.equal(manualAuditRows.length, 2);
assert.deepEqual(
  manualAuditRows.map((row) => row.key).sort(),
  ['m1-player-1', 'm2-player-1']
);

const volumeScenarios = [
  { matches: 0, players: 0 },
  { matches: 1, players: 1 },
  { matches: 8, players: 15 },
  { matches: 24, players: 15 },
  { matches: 104, players: 15 },
  { matches: 128, players: 30 },
  { matches: 128, players: 128 },
];

const scenarioResults = volumeScenarios.map((scenario) => {
  const matches = Array.from({ length: scenario.matches }, (_, index) =>
    createMatch(index)
  );
  const players = Array.from({ length: scenario.players }, (_, index) =>
    createPlayer(index, matches)
  );

  const startedAt = performance.now();
  const leaderboard = computeLeaderboard(players, matches);
  const auditRows = buildPredictionAuditRows(matches, players);
  const firstPage = paginateRows(auditRows, 1, 50);
  const lastPage = paginateRows(auditRows, 9999, 50);
  const elapsedMs = performance.now() - startedAt;

  assert.equal(leaderboard.length, scenario.players);
  assert.equal(auditRows.length, scenario.matches * scenario.players);
  assert.equal(firstPage.rows.length, Math.min(50, auditRows.length));
  assert.equal(lastPage.endRow, auditRows.length);
  assert.ok(elapsedMs < 5000, `Scenario too slow: ${elapsedMs.toFixed(2)}ms`);

  return {
    ...scenario,
    predictions: auditRows.length,
    pages: firstPage.totalPages,
    elapsedMs: Number(elapsedMs.toFixed(2)),
  };
});

console.log(
  JSON.stringify(
    {
      manualDbMutation: {
        normalizedMatches: manualMatches.length,
        normalizedPlayers: manualPlayers.length,
        auditRows: manualAuditRows.length,
        topPlayerPoints: manualLeaderboard[0].points,
      },
      volumeScenarios: scenarioResults,
    },
    null,
    2
  )
);
