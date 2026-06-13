import { DEFAULT_AVATAR } from '../config/avatars';
import { Match, Player, Prediction } from '../types';

const MAX_SCORE = 99;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  return trimmed.slice(0, maxLength);
}

function cleanOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return trimmed.slice(0, maxLength);
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : Number.NaN;

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function cleanScore(value: unknown, fallback = 0) {
  const score = Math.round(cleanNumber(value, fallback));

  return Math.min(MAX_SCORE, Math.max(0, score));
}

function cleanTimestampMs(value: unknown, startsAt: string) {
  const timestamp = cleanNumber(value, Number.NaN);

  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp;
  }

  const parsedStartsAt = new Date(startsAt).getTime();

  return Number.isFinite(parsedStartsAt) ? parsedStartsAt : 0;
}

function cleanPrediction(value: unknown): Prediction | null {
  if (!isRecord(value)) return null;

  const scoreA = cleanScore(value.scoreA, Number.NaN);
  const scoreB = cleanScore(value.scoreB, Number.NaN);

  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
    return null;
  }

  const prediction: Prediction = {
    scoreA,
    scoreB,
  };

  if (typeof value.createdAt === 'string') {
    prediction.createdAt = value.createdAt.slice(0, 40);
  }

  if (typeof value.updatedAt === 'string') {
    prediction.updatedAt = value.updatedAt.slice(0, 40);
  }

  return prediction;
}

function cleanPredictions(value: unknown) {
  if (!isRecord(value)) return {};

  return Object.entries(value).reduce<Record<string, Prediction>>(
    (predictions, [matchId, rawPrediction]) => {
      const cleanMatchId = cleanString(matchId, '', 128);
      const prediction = cleanPrediction(rawPrediction);

      if (cleanMatchId && prediction) {
        predictions[cleanMatchId] = prediction;
      }

      return predictions;
    },
    {}
  );
}

export function normalizeMatchDocument(
  documentId: string,
  value: unknown
): Match | null {
  if (!isRecord(value)) return null;

  const id = cleanString(documentId, cleanString(value.id, '', 128), 128);

  if (!id) return null;

  const startsAt = cleanString(value.startsAt, '', 40);
  const status = value.status === 'finished' ? 'finished' : 'scheduled';
  const scoreA =
    value.scoreA === undefined && status !== 'finished'
      ? undefined
      : cleanScore(value.scoreA, 0);
  const scoreB =
    value.scoreB === undefined && status !== 'finished'
      ? undefined
      : cleanScore(value.scoreB, 0);

  return {
    id,
    teamA: cleanString(value.teamA, 'Time A', 100),
    teamB: cleanString(value.teamB, 'Time B', 100),
    flagA: cleanString(value.flagA, '', 10),
    flagB: cleanString(value.flagB, '', 10),
    date: cleanString(value.date, 'Data indefinida', 50),
    time: cleanString(value.time, '--:--', 50),
    startsAt,
    startsAtMs: cleanTimestampMs(value.startsAtMs, startsAt),
    status,
    scoreA,
    scoreB,
    group: cleanString(value.group, 'Sem grupo', 50),
    venue: cleanOptionalString(value.venue, 120),
    city: cleanOptionalString(value.city, 120),
  };
}

export function normalizePlayerDocument(
  documentId: string,
  value: unknown
): Player | null {
  if (!isRecord(value)) return null;

  const id = cleanString(documentId, cleanString(value.id, '', 128), 128);

  if (!id) return null;

  return {
    id,
    name: cleanString(value.name, 'Jogador sem nome', 128),
    avatar: cleanString(value.avatar, DEFAULT_AVATAR, 10),
    predictions: cleanPredictions(value.predictions),
    points: cleanNumber(value.points, 0),
    exactHits: cleanNumber(value.exactHits, 0),
    partialHits: cleanNumber(value.partialHits, 0),
    errorHits: cleanNumber(value.errorHits, 0),
    manualPointsAdjustment: cleanNumber(value.manualPointsAdjustment, 0),
    manualPointsAdjustmentUpdatedAt:
      typeof value.manualPointsAdjustmentUpdatedAt === 'string'
        ? value.manualPointsAdjustmentUpdatedAt.slice(0, 40)
        : '',
    lastPredictionMatchId: cleanString(value.lastPredictionMatchId, '', 128),
    isAdmin: value.isAdmin === true,
    email: typeof value.email === 'string' ? value.email.slice(0, 254) : '',
  };
}
