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
  onData: (matches: Match[]) => void;
  onEmpty: () => void;
  onError: (error: unknown) => void;
}

export function subscribeToMatches({
  onData,
  onEmpty,
  onError,
}: SubscribeToMatchesParams) {
  const matchesCol = collection(db, 'matches');

  return onSnapshot(
    matchesCol,
    (snapshot) => {
      if (snapshot.empty) {
        onEmpty();
        return;
      }

      const loadedMatches: Match[] = [];

      snapshot.forEach((document) => {
        loadedMatches.push(document.data() as Match);
      });

      onData(sortMatchesBySchedule(loadedMatches));
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
  const batch = writeBatch(db);

  for (const match of matches) {
    batch.set(doc(db, 'matches', match.id), match);
  }

  await batch.commit();
}

export async function syncDefaultMatches(matches: Match[]): Promise<void> {
  const snapshot = await getDocs(collection(db, 'matches'));
  const existingMatches = new Map<string, Match>();
  const batch = writeBatch(db);

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

    batch.set(doc(db, 'matches', match.id), nextMatch);
  }

  await batch.commit();
}
