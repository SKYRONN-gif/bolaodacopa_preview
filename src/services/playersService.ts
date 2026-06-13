import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Player, Prediction } from '../types';
import { normalizePlayerDocument } from './firestoreNormalizers';

interface SubscribeToPlayersParams {
  onData: (players: Player[], metadata: { fromCache: boolean }) => void;
  onEmpty: (metadata: { fromCache: boolean }) => void;
  onError: (error: unknown) => void;
}

export function subscribeToPlayers({
  onData,
  onEmpty,
  onError,
}: SubscribeToPlayersParams) {
  const playersCol = collection(db, 'players');

  return onSnapshot(
    playersCol,
    { includeMetadataChanges: true },
    (snapshot) => {
      const metadata = { fromCache: snapshot.metadata.fromCache };

      if (snapshot.empty) {
        onEmpty(metadata);
        return;
      }

      const loadedPlayers: Player[] = [];

      snapshot.forEach((document) => {
        const player = normalizePlayerDocument(document.id, document.data());

        if (player) {
          loadedPlayers.push(player);
        }
      });

      onData(loadedPlayers, metadata);
    },
    (error) => {
      onError(error);
    }
  );
}

export async function savePlayer(player: Player): Promise<void> {
  await setDoc(doc(db, 'players', player.id), player, { merge: true });
}

export async function savePlayerPrediction(
  playerId: string,
  matchId: string,
  prediction: Prediction
): Promise<void> {
  await updateDoc(doc(db, 'players', playerId), {
    [`predictions.${matchId}`]: prediction,
    lastPredictionMatchId: matchId,
  });
}

export async function savePlayerProfile(
  playerId: string,
  name: string,
  avatar: string
): Promise<void> {
  await updateDoc(doc(db, 'players', playerId), {
    name,
    avatar,
  });
}

export async function savePlayerManualAdjustment(
  playerId: string,
  manualPointsAdjustment: number
): Promise<void> {
  await updateDoc(doc(db, 'players', playerId), {
    manualPointsAdjustment,
    manualPointsAdjustmentUpdatedAt: new Date().toISOString(),
  });
}

export async function seedPlayers(players: Player[]): Promise<void> {
  for (const player of players) {
    await savePlayer(player);
  }
}
