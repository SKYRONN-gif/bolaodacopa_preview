import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { sortMatchesBySchedule } from '../domain/matches';
import { db } from '../firebase';
import { Match } from '../types';
import { normalizeMatchDocument } from './firestoreNormalizers';

interface SubscribeToMatchesParams {
  onData: (matches: Match[], metadata: { fromCache: boolean }) => void;
  onEmpty: (metadata: { fromCache: boolean }) => void;
  onError: (error: unknown) => void;
}

const FIRESTORE_BATCH_WRITE_LIMIT = 450;

function removeUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  );
}

function toFirestoreMatch(match: Match) {
  const isFinishedWithScore =
    match.status === 'finished' &&
    typeof match.scoreA === 'number' &&
    typeof match.scoreB === 'number';

  return removeUndefinedFields({
    id: match.id,
    teamA: match.teamA,
    teamB: match.teamB,
    flagA: match.flagA,
    flagB: match.flagB,
    date: match.date,
    time: match.time,
    startsAt: match.startsAt,
    startsAtMs: match.startsAtMs,
    status: match.status,
    group: match.group,
    venue: match.venue,
    city: match.city,
    apiFixtureId: match.apiFixtureId,
    logoA: match.logoA,
    logoB: match.logoB,
    source: match.source,

    scoreA: isFinishedWithScore ? match.scoreA : undefined,
    scoreB: isFinishedWithScore ? match.scoreB : undefined,
  });
}

async function writeMatchesInBatches(
  matches: Match[],
  options?: { merge?: boolean }
): Promise<void> {
  let batch = writeBatch(db);
  let pendingWrites = 0;

  for (const match of matches) {
    const matchRef = doc(db, 'matches', match.id);
    const firestoreMatch = toFirestoreMatch(match);

    if (options?.merge) {
      batch.set(matchRef, firestoreMatch, { merge: true });
    } else {
      batch.set(matchRef, firestoreMatch);
    }

    pendingWrites++;

    if (pendingWrites >= FIRESTORE_BATCH_WRITE_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    await batch.commit();
  }
}

export function subscribeToMatches({
  onData,
  onEmpty,
  onError,
}: SubscribeToMatchesParams) {
  const matchesCol = collection(db, 'matches');

  return onSnapshot(
    matchesCol,
    { includeMetadataChanges: true },
    (snapshot) => {
      const metadata = { fromCache: snapshot.metadata.fromCache };

      if (snapshot.empty) {
        onEmpty(metadata);
        return;
      }

      const loadedMatches: Match[] = [];

      snapshot.forEach((document) => {
        const match = normalizeMatchDocument(document.id, document.data());

        if (match) {
          loadedMatches.push(match);
        }
      });

      onData(sortMatchesBySchedule(loadedMatches), metadata);
    },
    (error) => {
      onError(error);
    }
  );
}

export async function saveMatch(match: Match): Promise<void> {
  await setDoc(doc(db, 'matches', match.id), toFirestoreMatch(match));
}

export async function seedMatches(matches: Match[]): Promise<void> {
  await writeMatchesInBatches(matches);
}

export async function syncDefaultMatches(matches: Match[]): Promise<void> {
  const snapshot = await getDocs(collection(db, 'matches'));
  const existingMatches = new Map<string, Match>();
  const nextMatches: Match[] = [];

  snapshot.forEach((document) => {
    const match = normalizeMatchDocument(document.id, document.data());

    if (match) {
      existingMatches.set(document.id, match);
    }
  });

  for (const match of matches) {
    const existingMatch = existingMatches.get(match.id);
    const nextMatch: Match = { ...match };

    if (
      existingMatch?.status === 'finished' &&
      typeof existingMatch.scoreA === 'number' &&
      typeof existingMatch.scoreB === 'number'
    ) {
      nextMatch.status = 'finished';
      nextMatch.scoreA = existingMatch.scoreA;
      nextMatch.scoreB = existingMatch.scoreB;
    }

    nextMatches.push(nextMatch);
  }

  await writeMatchesInBatches(nextMatches);
}

interface ApiWorldCupMatch {
  id: string;
  apiFixtureId?: string;
  teamA: string;
  teamB: string;
  shortTeamA?: string | null;
  shortTeamB?: string | null;
  logoA?: string | null;
  logoB?: string | null;
  date: string;
  time: string;
  startsAt: string;
  startsAtMs: number;
  status: 'scheduled' | 'finished';
  scoreA?: number | null;
  scoreB?: number | null;
  group: string;
  venue?: string | null;
  city?: string | null;
  source?: string;
}

interface WorldCupFixturesResponse {
  matches: ApiWorldCupMatch[];
  total: number;
  source: string;
  fallbackFrom?: string | null;
  syncedAt: string;
}

interface SyncWorldCupMatchesFromApiOptions {
  limit?: number;
  today?: boolean;
  upcoming?: boolean;
  finished?: boolean;
}

interface SyncWorldCupMatchesFromApiResult {
  imported: number;
  totalFromApi: number;
  source: string;
  fallbackFrom?: string | null;
}

function buildWorldCupFixturesUrl(options?: SyncWorldCupMatchesFromApiOptions) {
  const params = new URLSearchParams();

  if (options?.limit && options.limit > 0) {
    params.set('limit', String(options.limit));
  }

  if (options?.today) {
    params.set('today', '1');
  }

  if (options?.upcoming) {
    params.set('upcoming', '1');
  }

  if (options?.finished) {
    params.set('finished', '1');
  }

  const queryString = params.toString();

  return queryString
    ? `/api/worldcup-fixtures?${queryString}`
    : '/api/worldcup-fixtures';
}

function isValidApiWorldCupMatch(match: ApiWorldCupMatch) {
  return (
    typeof match.id === 'string' &&
    typeof match.teamA === 'string' &&
    typeof match.teamB === 'string' &&
    typeof match.date === 'string' &&
    typeof match.time === 'string' &&
    typeof match.startsAt === 'string' &&
    Number.isFinite(match.startsAtMs) &&
    (match.status === 'scheduled' || match.status === 'finished')
  );
}

function normalizeMatchText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeMatchDate(value?: string | null) {
  return (value || '').trim();
}

function normalizeMatchTime(value?: string | null) {
  return (value || '').trim();
}

function areSameTeams(apiMatch: ApiWorldCupMatch, existingMatch: Match) {
  const apiTeamA = normalizeMatchText(apiMatch.teamA);
  const apiTeamB = normalizeMatchText(apiMatch.teamB);

  const existingTeamA = normalizeMatchText(existingMatch.teamA);
  const existingTeamB = normalizeMatchText(existingMatch.teamB);

  const sameOrder = apiTeamA === existingTeamA && apiTeamB === existingTeamB;
  const invertedOrder = apiTeamA === existingTeamB && apiTeamB === existingTeamA;

  return sameOrder || invertedOrder;
}

function areSameSchedule(apiMatch: ApiWorldCupMatch, existingMatch: Match) {
  const sameDate =
    normalizeMatchDate(apiMatch.date) === normalizeMatchDate(existingMatch.date);

  const sameTime =
    normalizeMatchTime(apiMatch.time) === normalizeMatchTime(existingMatch.time);

  const closeStartsAt =
    Number.isFinite(apiMatch.startsAtMs) &&
    Number.isFinite(existingMatch.startsAtMs) &&
    Math.abs(apiMatch.startsAtMs - existingMatch.startsAtMs) <= 1000 * 60 * 90;

  return sameDate && (sameTime || closeStartsAt);
}

function findExistingMatchForApiMatch(
  apiMatch: ApiWorldCupMatch,
  existingMatches: Map<string, Match>
) {
  const matches = Array.from(existingMatches.values());

  const byApiFixtureId = matches.find(
    (existingMatch) =>
      existingMatch.apiFixtureId &&
      existingMatch.apiFixtureId === apiMatch.apiFixtureId
  );

  if (byApiFixtureId) {
    return byApiFixtureId;
  }

  const byTeamsAndSchedule = matches.find(
    (existingMatch) =>
      areSameTeams(apiMatch, existingMatch) &&
      areSameSchedule(apiMatch, existingMatch)
  );

  return byTeamsAndSchedule;
}

function apiMatchToMatch(match: ApiWorldCupMatch, existingMatch?: Match): Match {
  const isFinishedWithScore =
    match.status === 'finished' &&
    typeof match.scoreA === 'number' &&
    typeof match.scoreB === 'number';

  const shouldPreserveExistingFinishedScore =
    existingMatch?.status === 'finished' &&
    typeof existingMatch.scoreA === 'number' &&
    typeof existingMatch.scoreB === 'number' &&
    !isFinishedWithScore;

  return {
    ...existingMatch,

    id: existingMatch?.id || match.id,
    apiFixtureId: match.apiFixtureId,

    teamA: match.teamA,
    teamB: match.teamB,

    flagA: existingMatch?.flagA || match.shortTeamA || '🏳️',
    flagB: existingMatch?.flagB || match.shortTeamB || '🏳️',

    logoA: match.logoA || existingMatch?.logoA || null,
    logoB: match.logoB || existingMatch?.logoB || null,

    date: match.date,
    time: match.time,
    startsAt: match.startsAt,
    startsAtMs: match.startsAtMs,

    group: match.group || existingMatch?.group || 'Copa do Mundo 2026',
    venue: match.venue || existingMatch?.venue,
    city: match.city || existingMatch?.city,

    source: match.source || existingMatch?.source,

    status: shouldPreserveExistingFinishedScore
  ? 'finished'
  : match.status === 'finished'
    ? 'finished'
    : 'scheduled',

    scoreA: shouldPreserveExistingFinishedScore
      ? existingMatch.scoreA
      : isFinishedWithScore
        ? match.scoreA ?? undefined
        : undefined,

    scoreB: shouldPreserveExistingFinishedScore
      ? existingMatch.scoreB
      : isFinishedWithScore
        ? match.scoreB ?? undefined
        : undefined,
  };
}

export async function syncWorldCupMatchesFromApi(
  options?: SyncWorldCupMatchesFromApiOptions
): Promise<SyncWorldCupMatchesFromApiResult> {
  const response = await fetch(buildWorldCupFixturesUrl(options));

  if (!response.ok) {
    throw new Error(`Erro ao buscar jogos da API. Status: ${response.status}`);
  }

  const data = (await response.json()) as WorldCupFixturesResponse;

  if (!Array.isArray(data.matches)) {
    throw new Error('Resposta inválida da API: matches não encontrado.');
  }

  const snapshot = await getDocs(collection(db, 'matches'));
  const existingMatches = new Map<string, Match>();

  snapshot.forEach((document) => {
    const match = normalizeMatchDocument(document.id, document.data());

    if (match) {
      existingMatches.set(document.id, match);
    }
  });

const validApiMatches = data.matches.filter(isValidApiWorldCupMatch);

const nextMatches = validApiMatches
  .map((apiMatch) => {
    const existingMatch = findExistingMatchForApiMatch(apiMatch, existingMatches);

    if (!existingMatch && options?.finished) {
      return null;
    }

    return apiMatchToMatch(apiMatch, existingMatch);
  })
  .filter((match): match is Match => Boolean(match));

  await writeMatchesInBatches(nextMatches, { merge: true });

  return {
    imported: nextMatches.length,
    totalFromApi: data.total,
    source: data.source,
    fallbackFrom: data.fallbackFrom || null,
  };
}
