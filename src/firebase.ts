/**
 * Centraliza a configuração e os clientes Firebase usados pelo projeto.
 *
 * Este arquivo garante que o front-end saiba qual projeto Firebase utilizar,
 * cria clientes reutilizáveis para autenticação e banco de dados, permite
 * trocar para Emulators locais durante o desenvolvimento e padroniza o
 * diagnóstico de erros do Firestore.
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

/**
 * Informa ao TypeScript que este projeto pode guardar uma flag própria
 * no objeto global window.
 *
 * A flag permanece na página mesmo quando o Vite recarrega módulos durante
 * o desenvolvimento, evitando uma segunda conexão com os Emulators.
 */
declare global {
  interface Window {
    __BOLAO_EMULATORS_CONNECTED__?: boolean;
  }
}

/**
 * Lista das variáveis necessárias para identificar o projeto Firebase.
 *
 * Localmente, esses valores vêm do arquivo .env.local.
 * Em produção, vêm das Environment Variables configuradas na Vercel.
 *
 * "as const" faz o TypeScript preservar os nomes exatos das variáveis,
 * permitindo acessar import.meta.env com mais segurança.
 */
const REQUIRED_FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

/**
 * Busca as variáveis obrigatórias que ainda não possuem valor.
 *
 * Validar isso antes de inicializar o Firebase evita erros espalhados pelo
 * sistema, como falhas de login ou banco sem uma causa clara.
 */
function getMissingFirebaseEnvKeys(): string[] {
  // import.meta.env é o objeto criado pelo Vite com os valores do .env.local
  // ou das Environment Variables configuradas na Vercel.
  const env = import.meta.env;

  // Guardará somente os nomes das variáveis que estão ausentes.
  const missingKeys: string[] = [];

  // Percorre uma variável obrigatória por vez.
  for (const key of REQUIRED_FIREBASE_ENV_KEYS) {
    const value = env[key];

    // !value significa: o valor está vazio, undefined ou não foi configurado.
    if (!value) {
      missingKeys.push(key);
    }
  }

  return missingKeys;
}

/**
 * Monta o objeto usado para inicializar o Firebase.
 *
 * A aplicação falha logo no início caso alguma configuração obrigatória
 * esteja ausente. Essa estratégia é chamada de fail fast: interromper cedo
 * com uma mensagem clara, em vez de permitir erros confusos mais adiante.
 */
function resolveFirebaseConfig() {
  const env = import.meta.env;
  const missingKeys = getMissingFirebaseEnvKeys();

  if (missingKeys.length > 0) {
    // join transforma a lista em um texto legível para a mensagem de erro.
    const missingKeysText = missingKeys.join(', ');

    throw new Error(
      `Firebase nao configurado. Variaveis ausentes: ${missingKeysText}`
    );
  }

  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,

    // ?? usa string vazia apenas se o valor for null ou undefined.
    // Na prática, appId deve existir porque ele já foi validado acima.
    appId: env.VITE_FIREBASE_APP_ID ?? '',

    // measurementId é opcional porque o projeto pode não usar Analytics.
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID ?? '',
  };
}

/**
 * Resolve qual banco Firestore será usado na inicialização.
 *
 * Quando nenhum ID específico é informado, o projeto deve usar o banco
 * padrão. Por isso, valor vazio e "(default)" são normalizados para
 * undefined antes de criar o cliente Firestore.
 */
function resolveDatabaseId(): string | undefined {
  const rawDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

  if (!rawDatabaseId) {
    // undefined informa ao getFirestore que deve usar o banco padrão.
    return undefined;
  }

  // trim remove espaços acidentais no .env, como " (default) ".
  const configuredDatabaseId = rawDatabaseId.trim();

  // Valor vazio e "(default)" representam a mesma decisão de negócio:
  // não escolher um banco alternativo.
  const shouldUseDefaultDatabase =
    configuredDatabaseId === '' || configuredDatabaseId === '(default)';

  if (shouldUseDefaultDatabase) {
    return undefined;
  }

  return configuredDatabaseId;
}

/**
 * Inicializa o projeto Firebase uma única vez.
 *
 * firebaseApp funciona como a configuração central compartilhada pelos
 * serviços Firebase usados no navegador.
 */
const firebaseConfig = resolveFirebaseConfig();
const firebaseApp = initializeApp(firebaseConfig);
const databaseId = resolveDatabaseId();

/**
 * Cria o cliente Firestore usado por todos os services do projeto.
 *
 * Quando existe um databaseId específico, ele é usado. Caso contrário,
 * o Firebase cria o cliente conectado ao banco padrão do projeto.
 */
function createFirestoreClient() {
  if (databaseId) {
    // Este formato é usado apenas quando o projeto precisa acessar
    // um banco Firestore nomeado, diferente do banco padrão.
    return getFirestore(firebaseApp, databaseId);
  }

  // Omitir o segundo parâmetro significa: usar o banco padrão.
  return getFirestore(firebaseApp);
}

/**
 * Exportações reutilizadas pelo restante da aplicação.
 *
 * db:
 * cliente usado pelos services para ler, escutar e salvar documentos.
 *
 * auth:
 * cliente usado para login, logout e identificação do usuário atual.
 *
 * googleProvider:
 * informa que o fluxo de login deve utilizar contas Google.
 */
export const firebaseProjectId = firebaseConfig.projectId;
export const db = createFirestoreClient();
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

/**
 * Verifica se o código está sendo executado no navegador.
 *
 * O objeto window não existe em ambientes como Node.js, testes automatizados
 * ou renderização no servidor. Essa verificação impede que o arquivo tente
 * usar recursos exclusivos do navegador nesses cenários.
 */
function isRunningInBrowser(): boolean {
  // typeof é seguro mesmo quando window não existe.
  // Usar apenas "window !== undefined" poderia quebrar antes da comparação.
  return typeof window !== 'undefined';
}

/**
 * Conecta o cliente Firestore ao Emulator local, quando configurado.
 *
 * Exemplo:
 * VITE_FIREBASE_EMULATOR_HOST=127.0.0.1:8080
 *
 * Usar o Emulator permite testar leituras, escritas e regras sem alterar
 * dados reais do Firebase de produção.
 */
function connectFirestoreEmulatorIfConfigured() {
  const emulatorAddress = import.meta.env.VITE_FIREBASE_EMULATOR_HOST;

  if (!emulatorAddress) {
    // Sem a variável no .env, o projeto continua usando o Firestore real.
    return;
  }

  // split separa "127.0.0.1:8080" em host e porta.
  const [host, portText] = emulatorAddress.split(':');

  // A porta chega como texto pelo .env; Number converte para número.
  const port = Number(portText);

  if (!host || !Number.isInteger(port)) {
    throw new Error(
      'VITE_FIREBASE_EMULATOR_HOST deve seguir o formato host:porta. Exemplo: 127.0.0.1:8080'
    );
  }

  connectFirestoreEmulator(db, host, port);
}

/**
 * Conecta o cliente de autenticação ao Emulator local, quando configurado.
 *
 * Exemplo:
 * VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
 *
 * Isso redireciona login e usuários de teste para o ambiente simulado,
 * sem interferir nas contas reais do Firebase Authentication.
 */
function connectAuthEmulatorIfConfigured() {
  const emulatorUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;

  if (!emulatorUrl) {
    return;
  }

  connectAuthEmulator(auth, emulatorUrl, {
    disableWarnings: true,
  });
}

/**
 * Conecta os Emulators somente quando o projeto estiver no navegador e as
 * variáveis de desenvolvimento estiverem configuradas.
 *
 * A flag no window impede reconexões durante recargas de módulo do Vite,
 * que podem acontecer sem a página inteira ser atualizada.
 */
function connectEmulatorsIfConfigured() {
  if (!isRunningInBrowser()) {
    return;
  }

  // A comparação explícita com true deixa claro que undefined também
  // significa "ainda não conectou".
  const emulatorsAlreadyConnected =
    window.__BOLAO_EMULATORS_CONNECTED__ === true;

  if (emulatorsAlreadyConnected) {
    return;
  }

  connectFirestoreEmulatorIfConfigured();
  connectAuthEmulatorIfConfigured();

  // A flag fica no window, não no módulo. Por isso ela sobrevive melhor
  // às recargas parciais feitas pelo Vite durante o desenvolvimento.
  window.__BOLAO_EMULATORS_CONNECTED__ = true;
}

connectEmulatorsIfConfigured();
/**
 * Define os tipos de operação que podem falhar ao acessar o Firestore.
 *
 * Registrar a operação ajuda a identificar se o problema aconteceu ao
 * criar, atualizar, excluir, buscar ou listar dados.
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Define as informações técnicas registradas quando uma operação do
 * Firestore falha.
 *
 * Esses dados ajudam a investigar erros de caminho, autenticação e regras
 * de permissão sem depender apenas da mensagem genérica do Firebase.
 */
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

/**
 * Extrai uma mensagem legível de um erro desconhecido.
 *
 * O catch pode receber Error, texto, número ou outro valor. Por isso o
 * parâmetro é unknown e precisa ser tratado antes de acessar .message.
 */
function getErrorMessage(error: unknown): string {
  // instanceof confirma que o valor realmente possui a estrutura Error
  // antes de tentar acessar error.message.
  if (error instanceof Error) {
    return error.message;
  }

  // String garante uma mensagem mesmo quando alguém lança texto, número
  // ou um objeto inesperado.
  return String(error);
}

/**
 * Reúne informações do usuário autenticado no momento em que ocorreu o erro.
 *
 * Esses dados ajudam a descobrir, por exemplo, se uma Firestore Rule bloqueou
 * uma operação porque não havia login, e-mail verificado ou permissão admin.
 */
function getCurrentUserErrorInfo() {
  return {
    // ?. evita erro quando ninguém está logado.
    // Se currentUser for null, o resultado será undefined.
    userId: auth.currentUser?.uid,
    email: auth.currentUser?.email,
    emailVerified: auth.currentUser?.emailVerified,
    isAnonymous: auth.currentUser?.isAnonymous,
  };
}

/**
 * Monta um objeto padronizado com todos os detalhes úteis para diagnóstico.
 *
 * Separar essa montagem da função principal reduz a responsabilidade de
 * handleFirestoreError e facilita entender de onde cada informação vem.
 */
function createFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  return {
    error: getErrorMessage(error),
    operationType,
    path,
    authInfo: getCurrentUserErrorInfo(),
  };
}

/**
 * Registra detalhes de um erro do Firestore e interrompe a operação atual.
 *
 * O retorno never informa ao TypeScript que esta função nunca termina
 * normalmente: ela sempre lança um erro e encerra o fluxo atual.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errorInfo = createFirestoreErrorInfo(
    error,
    operationType,
    path
  );

  // O console guarda detalhes técnicos para desenvolvimento.
  console.error('Firestore Error Details:', errorInfo);

  // throw encerra a função; por isso o retorno é never, e não void.
  throw new Error(JSON.stringify(errorInfo));
}