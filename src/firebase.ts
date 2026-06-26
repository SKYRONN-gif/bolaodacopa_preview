/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


/**  * Este arquivo valida as variáveis de ambiente, cria as conexões com
 * Firestore e Firebase Auth, configura Emulators locais quando necessário
 * e oferece uma estrutura padrão para diagnosticar erros do Firestore. */
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth, //Cria o cliente de autenticação (como? pq? pra poder conectar ao banco né)
  GoogleAuthProvider, //Define que o login será pelo Google (não faço isso pelo firebase mesmo?)
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore, //Cria o cliente do banco Firestore pq preciso ter tudo isso aqui? Pra conectar com o banco? da onde descobriria isso?
} from 'firebase/firestore'; //oq é firestore? firebase é a plataforma do banco, firestore é o banco? e fire auth é da autenticação?


/**
 * Lista de variáveis necessárias para identificar o projeto Firebase correto.
 *
 * Os valores vêm do .env.local durante desenvolvimento ou das variáveis
 * configuradas na Vercel durante o deploy.
 */
const REQUIRED_FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const; //preciso para conectar o banco firabase com a vercel?

/**
 * Procura variáveis obrigatórias que não foram configuradas.
 *
 * Retorna apenas os nomes das variáveis ausentes para que a mensagem
 * de erro informe exatamente o que precisa ser corrigido.
 */
//entendi oq é feito aqui, só não entendi o pq e como
function getMissingFirebaseEnvKeys() {
  const env = import.meta.env;

  return REQUIRED_FIREBASE_ENV_KEYS.filter((key) => !env[key]);
}

/**
 * Monta a configuração usada para inicializar o Firebase.
 *
 * O aplicativo falha imediatamente se alguma variável obrigatória estiver
 * ausente, evitando erros mais difíceis de diagnosticar em outras telas.
 */
//mais uma vez entendi o que faz, mas não como
function resolveFirebaseConfig() {
  const env = import.meta.env;
  const missingKeys = getMissingFirebaseEnvKeys();

  //se falhar, mostra exatamente o que falta
  if (missingKeys.length > 0) {
    throw new Error(
      `Firebase nao configurado. Variaveis ausentes: ${missingKeys.join(', ')}`
    );
  }

  //depois retorna com tudo preenchido correto
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

  //se for diferente do env. data base id, ele fica undefined
  if (!env.VITE_FIREBASE_DATABASE_ID) {
    return undefined;
  }

  //recebe o data base id
  const databaseId = env.VITE_FIREBASE_DATABASE_ID;

  //retorna a data base como default
  return databaseId === '(default)' ? undefined : databaseId;
}
/**
 * Inicializa o Firebase uma única vez e exporta os clientes reutilizados
 * pelos services para autenticação, banco de dados e login com Google.
 */
//cria a dependencia (acho que entendi o pq, mas denovo não entendi como, preciso que arrume isso ao explicar)
const firebaseConfig = resolveFirebaseConfig();
const app = initializeApp(firebaseConfig);
const databaseId = resolveDatabaseId();

//expoe os valores para outros arquivos que precisam do valor
export const firebaseProjectId = firebaseConfig.projectId;
export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app); //entendi o que faz mas não como
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();


//usado para ser um simulador local do firebase
function connectEmulatorsIfConfigured() {
  if (typeof window === 'undefined') return; //Se este código estiver rodando em ambiente sem navegador, pare aqui. (pq precisaria isso? não entendi)

  const env = import.meta.env; //tentei ler esse env. mas achei confuso ainda

  //cria uma prórpriedade propria pro window (n sei pq e nem como)
  const windowWithFlag = window as typeof window & {
    __BOLAO_EMULATORS_CONNECTED__?: boolean;
  };

  //evita conectar duplicadamente
  if (windowWithFlag.__BOLAO_EMULATORS_CONNECTED__) return;

//conecta ao banco simulado
  if (env.VITE_FIREBASE_EMULATOR_HOST) {
    const [host, port] = env.VITE_FIREBASE_EMULATOR_HOST.split(':');
    connectFirestoreEmulator(db, host, Number(port));
  }

  //cria usuários na simulação local
  if (env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
    connectAuthEmulator(auth, env.VITE_FIREBASE_AUTH_EMULATOR_URL, {
      disableWarnings: true,
    });
  }

  windowWithFlag.__BOLAO_EMULATORS_CONNECTED__ = true;
}

connectEmulatorsIfConfigured();

//tipo d eoperação que pode ser usado no codigo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

//da o corpo do erro ex:
export interface FirestoreErrorInfo {
  error: string;                            // "error": "Missing or insufficient permissions.",
  operationType: OperationType;             // "operationType": "update",
  path: string | null;                      // "path": "players/abc123",
  authInfo: {
    userId?: string | null;                 //"userId": "abc123",
    email?: string | null;                  //"email": "usuario@gmail.com",
    emailVerified?: boolean | null;         //"emailVerified": true,
    isAnonymous?: boolean | null;           // "isAnonymous": false
  };
}

/**
 * Registra detalhes de um erro do Firestore e interrompe a operação atual.
 *
 * Os services informam a operação e o caminho afetado. A função adiciona
 * também dados do usuário autenticado para facilitar a investigação de
 * problemas de permissão e Firestore Rules.
 */
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
