import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Player, Prediction } from '../types';

interface SubscribeToPlayersParams {
  onData: (players: Player[]) => void;
  onEmpty: () => void;
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
    (snapshot) => {
      if (snapshot.empty) {
        onEmpty();
        return;
      }

      const loadedPlayers: Player[] = [];

      snapshot.forEach((document) => {
        loadedPlayers.push(document.data() as Player);
      });

      onData(loadedPlayers);
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
  });
}

export async function seedPlayers(players: Player[]): Promise<void> {
  for (const player of players) {
    await savePlayer(player);
  }
}
