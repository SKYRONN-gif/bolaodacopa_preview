/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';

const REQUIRED_FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

function getMissingFirebaseEnvKeys() {
  const env = import.meta.env;

  return REQUIRED_FIREBASE_ENV_KEYS.filter((key) => !env[key]);
}

function resolveFirebaseConfig() {
  const env = import.meta.env;
  const missingKeys = getMissingFirebaseEnvKeys();

  if (missingKeys.length > 0) {
    throw new Error(
      `Firebase nao configurado. Variaveis ausentes: ${missingKeys.join(', ')}`
    );
  }

  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID ?? '',
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID ?? '',
  };
}

function resolveDatabaseId(): string | undefined {
  const env = import.meta.env;

  if (!env.VITE_FIREBASE_DATABASE_ID) {
    return undefined;
  }

  const databaseId = env.VITE_FIREBASE_DATABASE_ID;

  return databaseId === '(default)' ? undefined : databaseId;
}

const firebaseConfig = resolveFirebaseConfig();
const app = initializeApp(firebaseConfig);
const databaseId = resolveDatabaseId();

export const firebaseProjectId = firebaseConfig.projectId;
export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

function connectEmulatorsIfConfigured() {
  if (typeof window === 'undefined') return;

  const env = import.meta.env;
  const windowWithFlag = window as typeof window & {
    __BOLAO_EMULATORS_CONNECTED__?: boolean;
  };

  if (windowWithFlag.__BOLAO_EMULATORS_CONNECTED__) return;

  if (env.VITE_FIREBASE_EMULATOR_HOST) {
    const [host, port] = env.VITE_FIREBASE_EMULATOR_HOST.split(':');
    connectFirestoreEmulator(db, host, Number(port));
  }

  if (env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
    connectAuthEmulator(auth, env.VITE_FIREBASE_AUTH_EMULATOR_URL, {
      disableWarnings: true,
    });
  }

  windowWithFlag.__BOLAO_EMULATORS_CONNECTED__ = true;
}

connectEmulatorsIfConfigured();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };

  console.error('Firestore Error Details:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
