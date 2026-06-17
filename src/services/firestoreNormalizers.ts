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

function getRecordNumber(value: Record<string, unknown>, key: string) {
  const rawValue = value[key];

  if (typeof rawValue === 'number') return rawValue;

  if (typeof rawValue === 'string') {
    const parsedValue = Number(rawValue);

    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function epochToDate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;

  const milliseconds =
    Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value;
  const date = new Date(milliseconds);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTimeValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    return epochToDate(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) return null;

    const numericValue = Number(trimmed);

    if (Number.isFinite(numericValue)) {
      return epochToDate(numericValue);
    }

    const date = new Date(trimmed);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (!isRecord(value)) return null;

  if (typeof value.toDate === 'function') {
    try {
      const date = value.toDate();

      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date;
      }
    } catch {
      return null;
    }
  }

  const seconds =
    getRecordNumber(value, 'seconds') ?? getRecordNumber(value, '_seconds');

  if (seconds === undefined) return null;

  const nanoseconds =
    getRecordNumber(value, 'nanoseconds') ??
    getRecordNumber(value, '_nanoseconds') ??
    0;
  const date = new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000));

  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanDateTimeString(value: unknown) {
  const date = parseDateTimeValue(value);

  if (date) return date.toISOString();

  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, 40) : undefined;
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

function parseBrazilianSchedule(date: string, time: string) {
  const dateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());

  if (!dateMatch || !timeMatch) return null;

  const [, rawDay, rawMonth, rawYear] = dateMatch;
  const [, rawHour, rawMinute] = timeMatch;
  const day = Number(rawDay);
  const month = Number(rawMonth);
  const year = Number(rawYear);
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (
    !day ||
    !month ||
    !year ||
    month > 12 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const pad = (numberValue: number) => String(numberValue).padStart(2, '0');
  const parsedDate = new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00-03:00`
  );

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function cleanTimestampMs(value: unknown, startsAt: string, date: string, time: string) {
  const parsedValue = parseDateTimeValue(value);

  if (parsedValue) {
    return parsedValue.getTime();
  }

  const timestamp = cleanNumber(value, Number.NaN);

  if (Number.isFinite(timestamp) && timestamp > 0) {
    return epochToDate(timestamp)?.getTime() ?? timestamp;
  }

  const parsedStartsAt = parseDateTimeValue(startsAt)?.getTime();

  if (parsedStartsAt && Number.isFinite(parsedStartsAt)) {
    return parsedStartsAt;
  }

  const parsedSchedule = parseBrazilianSchedule(date, time)?.getTime();

  return parsedSchedule && Number.isFinite(parsedSchedule) ? parsedSchedule : 0;
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

  const createdAt = cleanDateTimeString(value.createdAt);
  const updatedAt = cleanDateTimeString(value.updatedAt);

  if (createdAt) prediction.createdAt = createdAt;
  if (updatedAt) prediction.updatedAt = updatedAt;

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

  const date = cleanString(value.date, 'Data indefinida', 50);
  const time = cleanString(value.time, '--:--', 50);
  const startsAt =
    cleanDateTimeString(value.startsAt) ||
    parseBrazilianSchedule(date, time)?.toISOString() ||
    '';
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
    date,
    time,
    startsAt,
    startsAtMs: cleanTimestampMs(value.startsAtMs, startsAt, date, time),
    status,
    scoreA,
    scoreB,
    group: cleanString(value.group, 'Sem grupo', 50),
    venue: cleanOptionalString(value.venue, 120),
    city: cleanOptionalString(value.city, 120),

    apiFixtureId: cleanOptionalString(value.apiFixtureId, 128),
logoA: cleanOptionalString(value.logoA, 500) || null,
logoB: cleanOptionalString(value.logoB, 500) || null,
source: cleanOptionalString(value.source, 50),
}
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
      cleanDateTimeString(value.manualPointsAdjustmentUpdatedAt) || '',
    lastPredictionMatchId: cleanString(value.lastPredictionMatchId, '', 128),
    isAdmin: value.isAdmin === true,
    email: typeof value.email === 'string' ? value.email.slice(0, 254) : '',
  };
}
