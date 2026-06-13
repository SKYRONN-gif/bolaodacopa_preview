import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { computeLeaderboard } from '../src/domain/scoring';
import {
  buildPredictionAuditRows,
  filterAuditRowsByMatch,
  paginateRows,
} from '../src/features/leaderboard/auditRows';
import { Match, Player, Prediction } from '../src/types';

const MATCH_COUNT = 104;
const PLAYER_COUNT = 15;
const AUDIT_PAGE_SIZE = 50;
const FIRESTORE_DOCUMENT_LIMIT_BYTES = 1024 * 1024;

function createMatch(index: number): Match {
  const startsAt = new Date(Date.UTC(2026, 5, 11 + index, 19, 0, 0));
  const scoreA = index % 5;
  const scoreB = (index + 2) % 4;

  return {
    id: `m${index + 1}`,
    teamA: `Time ${index * 2 + 1}`,
    teamB: `Time ${index * 2 + 2}`,
    flagA: 'A',
    flagB: 'B',
    date: startsAt.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
    time: startsAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }),
    startsAt: startsAt.toISOString(),
    startsAtMs: startsAt.getTime(),
    status: 'finished',
    scoreA,
    scoreB,
    group: index < 72 ? `Grupo ${Math.floor(index / 6) + 1}` : 'Mata-mata',
    venue: `Estadio ${index + 1}`,
    city: `Cidade ${index + 1}`,
  };
}

function createPrediction(playerIndex: number, matchIndex: number): Prediction {
  const savedAt = new Date(
    Date.UTC(2026, 4, 1, 12, playerIndex, matchIndex)
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
    name: `Jogador ${String(index + 1).padStart(2, '0')}`,
    avatar: String(index + 1),
    predictions,
    points: 0,
    exactHits: 0,
    partialHits: 0,
    errorHits: 0,
    manualPointsAdjustment: 0,
    manualPointsAdjustmentUpdatedAt: '',
    lastPredictionMatchId: `m${matches.length}`,
    isAdmin: false,
    email: `jogador${index + 1}@example.com`,
  };
}

function getDocumentSizeBytes(player: Player) {
  return Buffer.byteLength(JSON.stringify(player), 'utf8');
}

const matches = Array.from({ length: MATCH_COUNT }, (_, index) =>
  createMatch(index)
);
const players = Array.from({ length: PLAYER_COUNT }, (_, index) =>
  createPlayer(index, matches)
);

const leaderboardStart = performance.now();
const leaderboard = computeLeaderboard(players, matches);
const leaderboardMs = performance.now() - leaderboardStart;

const auditStart = performance.now();
const auditRows = buildPredictionAuditRows(matches, players);
const auditBuildMs = performance.now() - auditStart;

const firstAuditPage = paginateRows(auditRows, 1, AUDIT_PAGE_SIZE);
const lastAuditPage = paginateRows(auditRows, 999, AUDIT_PAGE_SIZE);
const firstMatchRows = filterAuditRowsByMatch(auditRows, 'm1');
const firstMatchPage = paginateRows(firstMatchRows, 1, AUDIT_PAGE_SIZE);
const playerDocumentSizes = players.map(getDocumentSizeBytes);
const maxPlayerDocumentBytes = Math.max(...playerDocumentSizes);

assert.equal(matches.length, MATCH_COUNT);
assert.equal(players.length, PLAYER_COUNT);
assert.equal(auditRows.length, MATCH_COUNT * PLAYER_COUNT);
assert.equal(firstAuditPage.rows.length, AUDIT_PAGE_SIZE);
assert.equal(firstAuditPage.totalPages, 32);
assert.equal(lastAuditPage.page, 32);
assert.equal(lastAuditPage.rows.length, 10);
assert.equal(lastAuditPage.startRow, 1551);
assert.equal(lastAuditPage.endRow, MATCH_COUNT * PLAYER_COUNT);
assert.equal(firstMatchRows.length, PLAYER_COUNT);
assert.equal(firstMatchPage.totalPages, 1);
assert.equal(leaderboard.length, PLAYER_COUNT);
assert.ok(
  leaderboard.every(
    (player) =>
      player.exactHits + player.partialHits + player.errorHits === MATCH_COUNT
  )
);
assert.ok(
  maxPlayerDocumentBytes < FIRESTORE_DOCUMENT_LIMIT_BYTES,
  `Player document is ${maxPlayerDocumentBytes} bytes`
);
assert.ok(leaderboardMs < 500, `Ranking took ${leaderboardMs.toFixed(2)}ms`);
assert.ok(
  auditBuildMs < 500,
  `Audit rows took ${auditBuildMs.toFixed(2)}ms`
);

console.log(
  JSON.stringify(
    {
      matches: MATCH_COUNT,
      players: PLAYER_COUNT,
      predictions: auditRows.length,
      auditPageSize: AUDIT_PAGE_SIZE,
      auditPages: firstAuditPage.totalPages,
      lastAuditPageRows: lastAuditPage.rows.length,
      rankingMs: Number(leaderboardMs.toFixed(2)),
      auditBuildMs: Number(auditBuildMs.toFixed(2)),
      maxPlayerDocumentKb: Number((maxPlayerDocumentBytes / 1024).toFixed(2)),
    },
    null,
    2
  )
);
