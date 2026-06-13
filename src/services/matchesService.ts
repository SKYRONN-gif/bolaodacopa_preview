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

interface SubscribeToMatchesParams {
  onData: (matches: Match[], metadata: { fromCache: boolean }) => void;
  onEmpty: (metadata: { fromCache: boolean }) => void;
  onError: (error: unknown) => void;
}

const FIRESTORE_BATCH_WRITE_LIMIT = 450;

async function writeMatchesInBatches(matches: Match[]): Promise<void> {
  let batch = writeBatch(db);
  let pendingWrites = 0;

  for (const match of matches) {
    batch.set(doc(db, 'matches', match.id), match);
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
        loadedMatches.push(document.data() as Match);
      });

      onData(sortMatchesBySchedule(loadedMatches), metadata);
    },
    (error) => {
      onError(error);
    }
  );
}

export async function saveMatch(match: Match): Promise<void> {
  await setDoc(doc(db, 'matches', match.id), match);
}

export async function seedMatches(matches: Match[]): Promise<void> {
  await writeMatchesInBatches(matches);
}

export async function syncDefaultMatches(matches: Match[]): Promise<void> {
  const snapshot = await getDocs(collection(db, 'matches'));
  const existingMatches = new Map<string, Match>();
  const nextMatches: Match[] = [];

  snapshot.forEach((document) => {
    const match = document.data() as Match;
    existingMatches.set(document.id, match);
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
