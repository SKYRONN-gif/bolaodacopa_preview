import { getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  writeBatch,
} from 'firebase/firestore';

import { mergePlayersKeepingPrimary } from '../domain/playerMerge';
import { db } from '../firebase';
import type { Player } from '../types';
import { normalizePlayerDocument } from './firestoreNormalizers';

const OLD_FIREBASE_APP_NAME = 'old-bolao-production';

const REQUIRED_OLD_FIREBASE_ENV_KEYS = [
  'VITE_OLD_FIREBASE_API_KEY',
  'VITE_OLD_FIREBASE_AUTH_DOMAIN',
  'VITE_OLD_FIREBASE_PROJECT_ID',
  'VITE_OLD_FIREBASE_STORAGE_BUCKET',
  'VITE_OLD_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_OLD_FIREBASE_APP_ID',
] as const;

interface LegacyPreviewResult {
  matchesCount: number;
  playersCount: number;
  predictionsCount: number;
  playerNames: string[];
  matchIds: string[];
}

interface LegacyImportResult extends LegacyPreviewResult {
  importedMatches: number;
  importedPlayers: number;
}

function getMissingOldFirebaseEnvKeys() {
  const env = import.meta.env;

  return REQUIRED_OLD_FIREBASE_ENV_KEYS.filter((key) => !env[key]);
}

function resolveOldFirebaseConfig() {
  const env = import.meta.env;
  const missingKeys = getMissingOldFirebaseEnvKeys();

  if (missingKeys.length > 0) {
    throw new Error(
      `Firebase antigo nao configurado. Variaveis ausentes: ${missingKeys.join(', ')}`
    );
  }

  return {
    apiKey: env.VITE_OLD_FIREBASE_API_KEY,
    authDomain: env.VITE_OLD_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_OLD_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_OLD_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_OLD_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_OLD_FIREBASE_APP_ID,
  };
}

function resolveOldDatabaseId(): string | undefined {
  const env = import.meta.env;
  const databaseId = env.VITE_OLD_FIREBASE_DATABASE_ID;

  if (!databaseId || databaseId === '(default)') {
    return undefined;
  }

  return databaseId;
}

function getOldFirebaseApp(): FirebaseApp {
  const existingApp = getApps().find(
    (app) => app.name === OLD_FIREBASE_APP_NAME
  );

  if (existingApp) {
    return existingApp;
  }

  return initializeApp(resolveOldFirebaseConfig(), OLD_FIREBASE_APP_NAME);
}

function getOldDb() {
  const oldApp = getOldFirebaseApp();
  const oldDatabaseId = resolveOldDatabaseId();

  return oldDatabaseId
    ? getFirestore(oldApp, oldDatabaseId)
    : getFirestore(oldApp);
}

function countPlayerPredictions(playerData: Record<string, unknown>) {
  const predictions = playerData.predictions;

  if (!predictions || typeof predictions !== 'object') {
    return 0;
  }

  return Object.keys(predictions).length;
}

export async function previewLegacyBolaoData(): Promise<LegacyPreviewResult> {
  const oldDb = getOldDb();

  const [matchesSnapshot, playersSnapshot] = await Promise.all([
    getDocs(collection(oldDb, 'matches')),
    getDocs(collection(oldDb, 'players')),
  ]);

  let predictionsCount = 0;
  const playerNames: string[] = [];

  playersSnapshot.forEach((document) => {
    const data = document.data();

    predictionsCount += countPlayerPredictions(data);

    if (typeof data.name === 'string' && data.name.trim()) {
      playerNames.push(data.name);
    }
  });

  const matchIds = matchesSnapshot.docs.map((document) => document.id);

  return {
    matchesCount: matchesSnapshot.size,
    playersCount: playersSnapshot.size,
    predictionsCount,
    playerNames: playerNames.slice(0, 10),
    matchIds: matchIds.slice(0, 20),
  };
}

function removeUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  );
}

async function writeCollectionDocsInBatches(
  collectionName: 'matches' | 'players',
  docs: Array<{ id: string; data: Record<string, unknown> }>
) {
  let batch = writeBatch(db);
  let pendingWrites = 0;

  for (const item of docs) {
    batch.set(
      doc(db, collectionName, item.id),
      removeUndefinedFields({
        ...item.data,
        id: item.data.id || item.id,
      }),
      { merge: true }
    );

    pendingWrites++;

    if (pendingWrites >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    await batch.commit();
  }
}

async function loadCurrentPlayersById() {
  const playersSnapshot = await getDocs(collection(db, 'players'));
  const playersById = new Map<string, Player>();

  playersSnapshot.forEach((document) => {
    const player = normalizePlayerDocument(document.id, document.data());

    if (player) {
      playersById.set(document.id, player);
    }
  });

  return playersById;
}

function mergeLegacyPlayerIntoCurrent(
  playerId: string,
  legacyData: Record<string, unknown>,
  currentPlayersById: Map<string, Player>
): Record<string, unknown> {
  const legacyPlayer = normalizePlayerDocument(playerId, legacyData);
  const currentPlayer = currentPlayersById.get(playerId);

  if (!legacyPlayer || !currentPlayer) {
    return legacyData;
  }

  return { ...mergePlayersKeepingPrimary(currentPlayer, legacyPlayer) };
}

export async function importLegacyBolaoData(): Promise<LegacyImportResult> {
  const oldDb = getOldDb();

  const [matchesSnapshot, playersSnapshot, currentPlayersById] =
    await Promise.all([
      getDocs(collection(oldDb, 'matches')),
      getDocs(collection(oldDb, 'players')),
      loadCurrentPlayersById(),
    ]);

  let predictionsCount = 0;
  const playerNames: string[] = [];

  const legacyMatches = matchesSnapshot.docs.map((document) => ({
    id: document.id,
    data: document.data(),
  }));

  const legacyPlayers = playersSnapshot.docs.map((document) => {
    const data = document.data();

    predictionsCount += countPlayerPredictions(data);

    if (typeof data.name === 'string' && data.name.trim()) {
      playerNames.push(data.name);
    }

    return {
      id: document.id,
      data: mergeLegacyPlayerIntoCurrent(
        document.id,
        data,
        currentPlayersById
      ),
    };
  });

  await writeCollectionDocsInBatches('matches', legacyMatches);
  await writeCollectionDocsInBatches('players', legacyPlayers);

  return {
    matchesCount: matchesSnapshot.size,
    playersCount: playersSnapshot.size,
    predictionsCount,
    playerNames: playerNames.slice(0, 10),
    matchIds: matchesSnapshot.docs.map((document) => document.id).slice(0, 20),
    importedMatches: legacyMatches.length,
    importedPlayers: legacyPlayers.length,
  };
}
