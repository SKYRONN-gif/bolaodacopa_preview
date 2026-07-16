import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import { sortMatchesBySchedule } from '../domain/matches';
import { db } from '../firebase';
import type { Match } from '../types';
import { normalizeMatchDocument } from './firestoreNormalizers';

interface SubscribeToMatchesParams {
  onData: (
    matches: Match[],
    metadata: { fromCache: boolean }
  ) => void;

  onEmpty: (metadata: { fromCache: boolean }) => void;

  onError: (error: unknown) => void;
}

// Limite interno usado para dividir gravações grandes
// em batches menores.
//
// Cada batch é atômico individualmente, mas o processo completo
// pode ser parcialmente concluído caso um lote posterior falhe.
const FIRESTORE_BATCH_WRITE_LIMIT = 450;

// Variações conhecidas de nomes de seleções.
//
// O objetivo é permitir a comparação entre fontes
// que utilizam idiomas ou grafias diferentes.
const MATCH_TEAM_ALIASES: Record<string, string> = {
  // República Tcheca / Czechia
  'rep checa': 'republica tcheca',
  'republica checa': 'republica tcheca',
  'republica tcheca': 'republica tcheca',
  czechia: 'republica tcheca',
  'czech republic': 'republica tcheca',

  // Congo
  'rd congo': 'republica democratica do congo',
  'dr congo': 'republica democratica do congo',
  'congo dr': 'republica democratica do congo',
  'democratic republic of congo':
    'republica democratica do congo',
  'republica democratica congo':
    'republica democratica do congo',
  'republica democratica do congo':
    'republica democratica do congo',

  // Holanda / Países Baixos
  holanda: 'paises baixos',
  netherlands: 'paises baixos',
  netherland: 'paises baixos',

  // Costa do Marfim
  'ivory coast': 'costa do marfim',
  'cote d ivoire': 'costa do marfim',
  'cote divoire': 'costa do marfim',

  // Estados Unidos
  usa: 'estados unidos',
  'united states': 'estados unidos',
  'united states of america': 'estados unidos',

  // Coreia do Sul
  'south korea': 'coreia do sul',
  'korea republic': 'coreia do sul',

  // Bósnia e Herzegovina
  'bosnia and herzegovina': 'bosnia e herzegovina',
  'bosnia herzegovina': 'bosnia e herzegovina',

  // Outros nomes comuns
  germany: 'alemanha',
  spain: 'espanha',
  switzerland: 'suica',
  sweden: 'suecia',
  turkiye: 'turquia',
  turkey: 'turquia',
  morocco: 'marrocos',
  japan: 'japao',
  paraguay: 'paraguai',
};

// Estrutura esperada para uma partida retornada
// pelo endpoint interno de jogos da Copa.
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

// Estrutura esperada para a resposta completa do endpoint.
//
// matches continua como unknown[] até que cada item
// seja validado em tempo de execução.
interface WorldCupFixturesResponse {
  matches: unknown[];
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

type TeamOrder = 'same' | 'inverted' | 'different';

interface ToFirestoreMatchOptions {
  // Quando uma gravação usa merge, campos omitidos permanecem
  // no documento. Essa opção remove placares antigos quando
  // a partida não possui um resultado final válido.
  deleteScoresWhenMissing?: boolean;
}

// Verifica se um valor desconhecido é um objeto
// que pode ser inspecionado com segurança.
function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOptionalStringOrNull(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    typeof value === 'string'
  );
}

function isOptionalNumberOrNull(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

// Remove campos de primeiro nível cujo valor seja undefined,
// evitando enviá-los ao Firestore.
//
// Valores null são preservados.
function removeUndefinedFields<
  T extends Record<string, unknown>,
>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, fieldValue]) => fieldValue !== undefined
    )
  );
}

// Converte uma partida da aplicação para o formato
// utilizado nas gravações do Firestore.
//
// Os placares só são mantidos quando a partida está finalizada
// e possui os dois valores numéricos.
function toFirestoreMatch(
  match: Match,
  options?: ToFirestoreMatchOptions
) {
  const isFinishedWithScore =
    match.status === 'finished' &&
    typeof match.scoreA === 'number' &&
    typeof match.scoreB === 'number';

  const missingScoreValue =
    options?.deleteScoresWhenMissing
      ? deleteField()
      : undefined;

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

    scoreA: isFinishedWithScore
      ? match.scoreA
      : missingScoreValue,

    scoreB: isFinishedWithScore
      ? match.scoreB
      : missingScoreValue,
  });
}

// Salva uma lista de partidas em batches menores.
//
// Com merge: true:
// - atualiza os campos enviados;
// - preserva campos não enviados;
// - remove placares antigos quando a partida não possui
//   um resultado final válido.
//
// Sem merge, o conteúdo anterior do documento é substituído.
async function writeMatchesInBatches(
  matches: Match[],
  options?: { merge?: boolean }
): Promise<void> {
  let batch = writeBatch(db);
  let pendingWrites = 0;

  for (const match of matches) {
    const matchRef = doc(db, 'matches', match.id);

    const firestoreMatch = toFirestoreMatch(match, {
      deleteScoresWhenMissing: Boolean(options?.merge),
    });

    if (options?.merge) {
      batch.set(matchRef, firestoreMatch, {
        merge: true,
      });
    } else {
      batch.set(matchRef, firestoreMatch);
    }

    pendingWrites++;

    if (
      pendingWrites >= FIRESTORE_BATCH_WRITE_LIMIT
    ) {
      await batch.commit();

      batch = writeBatch(db);
      pendingWrites = 0;
    }
  }

  // Confirma o último lote quando ele não atingiu
  // o limite definido para os batches anteriores.
  if (pendingWrites > 0) {
    await batch.commit();
  }
}

// Mantém a lista de partidas sincronizada com o Firestore.
//
// includeMetadataChanges permite distinguir snapshots
// carregados do cache de snapshots confirmados pelo servidor.
//
// Cada documento passa pelo normalizador antes de ser entregue
// ao hook responsável pelas partidas.
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
      const metadata = {
        fromCache: snapshot.metadata.fromCache,
      };

      if (snapshot.empty) {
        onEmpty(metadata);
        return;
      }

      const loadedMatches: Match[] = [];

      snapshot.forEach((matchDocument) => {
        const match = normalizeMatchDocument(
          matchDocument.id,
          matchDocument.data()
        );

        if (match) {
          loadedMatches.push(match);
        }
      });

      onData(
        sortMatchesBySchedule(loadedMatches),
        metadata
      );
    },
    onError
  );
}

// Cria ou substitui uma partida no Firestore.
//
// Como não utiliza merge, campos antigos que não estiverem
// no objeto serializado deixam de existir no documento.
export async function saveMatch(
  match: Match
): Promise<void> {
  await setDoc(
    doc(db, 'matches', match.id),
    toFirestoreMatch(match)
  );
}

// Salva uma lista de partidas usando batches.
//
// Caso sejam necessários vários lotes, o processo completo
// não é atômico entre todos eles.
export async function seedMatches(
  matches: Match[]
): Promise<void> {
  await writeMatchesInBatches(matches);
}

// Sincroniza a lista padrão de partidas com o Firestore.
//
// Resultados já finalizados são preservados para impedir
// que uma nova sincronização apague placares cadastrados.
//
// Partidas extras que já existem no banco não são removidas,
// pois somente os jogos recebidos são gravados novamente.
export async function syncDefaultMatches(
  matches: Match[]
): Promise<void> {
  const snapshot = await getDocs(
    collection(db, 'matches')
  );

  const existingMatches = new Map<string, Match>();
  const nextMatches: Match[] = [];

  snapshot.forEach((matchDocument) => {
    const match = normalizeMatchDocument(
      matchDocument.id,
      matchDocument.data()
    );

    if (match) {
      existingMatches.set(matchDocument.id, match);
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

// Monta a URL do endpoint interno com os filtros solicitados.
//
// Apenas parâmetros ativos são incluídos na query string.
function buildWorldCupFixturesUrl(
  options?: SyncWorldCupMatchesFromApiOptions
) {
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

// Valida a estrutura geral da resposta do endpoint.
//
// A asserção de tipos do TypeScript não valida dados
// recebidos em tempo de execução, por isso essa verificação
// ocorre antes de acessar os campos da resposta.
function parseWorldCupFixturesResponse(
  value: unknown
): WorldCupFixturesResponse {
  if (!isRecord(value)) {
    throw new Error(
      'Resposta inválida da API: objeto principal não encontrado.'
    );
  }

  if (!Array.isArray(value.matches)) {
    throw new Error(
      'Resposta inválida da API: matches não encontrado.'
    );
  }

  if (
    typeof value.total !== 'number' ||
    !Number.isFinite(value.total)
  ) {
    throw new Error(
      'Resposta inválida da API: total inválido.'
    );
  }

  if (typeof value.source !== 'string') {
    throw new Error(
      'Resposta inválida da API: source inválido.'
    );
  }

  if (typeof value.syncedAt !== 'string') {
    throw new Error(
      'Resposta inválida da API: syncedAt inválido.'
    );
  }

  if (!isOptionalStringOrNull(value.fallbackFrom)) {
    throw new Error(
      'Resposta inválida da API: fallbackFrom inválido.'
    );
  }

  return {
    matches: value.matches,
    total: value.total,
    source: value.source,
    fallbackFrom: value.fallbackFrom as
      | string
      | null
      | undefined,
    syncedAt: value.syncedAt,
  };
}

// Valida cada item recebido da API antes que ele
// seja tratado como uma partida da Copa.
function isValidApiWorldCupMatch(
  value: unknown
): value is ApiWorldCupMatch {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.teamA === 'string' &&
    typeof value.teamB === 'string' &&
    typeof value.date === 'string' &&
    typeof value.time === 'string' &&
    typeof value.startsAt === 'string' &&
    typeof value.startsAtMs === 'number' &&
    Number.isFinite(value.startsAtMs) &&
    typeof value.group === 'string' &&
    (value.status === 'scheduled' ||
      value.status === 'finished') &&
    isOptionalStringOrNull(value.apiFixtureId) &&
    isOptionalStringOrNull(value.shortTeamA) &&
    isOptionalStringOrNull(value.shortTeamB) &&
    isOptionalStringOrNull(value.logoA) &&
    isOptionalStringOrNull(value.logoB) &&
    isOptionalNumberOrNull(value.scoreA) &&
    isOptionalNumberOrNull(value.scoreB) &&
    isOptionalStringOrNull(value.venue) &&
    isOptionalStringOrNull(value.city) &&
    isOptionalStringOrNull(value.source)
  );
}

// Normaliza nomes de seleções para permitir comparação
// entre fontes que usam idiomas ou grafias diferentes.
function normalizeMatchText(
  value?: string | null
) {
  const normalized = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return (
    MATCH_TEAM_ALIASES[normalized] || normalized
  );
}

function normalizeMatchDate(
  value?: string | null
) {
  return (value || '').trim();
}

function normalizeMatchTime(
  value?: string | null
) {
  return (value || '').trim();
}

// Identifica a orientação das seleções entre
// uma partida da API e uma partida já existente.
//
// A orientação é importante porque scoreA e scoreB
// estão ligados diretamente a teamA e teamB.
function getTeamOrder(
  apiMatch: ApiWorldCupMatch,
  existingMatch: Match
): TeamOrder {
  const apiTeamA = normalizeMatchText(apiMatch.teamA);
  const apiTeamB = normalizeMatchText(apiMatch.teamB);

  const existingTeamA = normalizeMatchText(
    existingMatch.teamA
  );

  const existingTeamB = normalizeMatchText(
    existingMatch.teamB
  );

  const sameOrder =
    apiTeamA === existingTeamA &&
    apiTeamB === existingTeamB;

  if (sameOrder) {
    return 'same';
  }

  const invertedOrder =
    apiTeamA === existingTeamB &&
    apiTeamB === existingTeamA;

  if (invertedOrder) {
    return 'inverted';
  }

  return 'different';
}

// Retorna true quando as partidas envolvem
// as mesmas duas seleções, mesmo em ordem invertida.
function areSameTeams(
  apiMatch: ApiWorldCupMatch,
  existingMatch: Match
) {
  return (
    getTeamOrder(apiMatch, existingMatch) !==
    'different'
  );
}

// Considera o horário equivalente quando:
// - a data textual é igual;
// - e o horário textual é igual ou o timestamp
//   possui diferença máxima de 90 minutos.
//
// A comparação pressupõe que as duas fontes usam
// o mesmo formato textual de data.
function areSameSchedule(
  apiMatch: ApiWorldCupMatch,
  existingMatch: Match
) {
  const sameDate =
    normalizeMatchDate(apiMatch.date) ===
    normalizeMatchDate(existingMatch.date);

  const sameTime =
    normalizeMatchTime(apiMatch.time) ===
    normalizeMatchTime(existingMatch.time);

  const closeStartsAt =
    Number.isFinite(apiMatch.startsAtMs) &&
    Number.isFinite(existingMatch.startsAtMs) &&
    Math.abs(
      apiMatch.startsAtMs -
        existingMatch.startsAtMs
    ) <=
      1000 * 60 * 90;

  return sameDate && (sameTime || closeStartsAt);
}

// Considera IDs totalmente numéricos como IDs
// gerados pela API.
//
// Essa identificação depende da convenção adotada pelo projeto.
function isApiGeneratedMatchId(
  matchId: string
) {
  return /^\d+$/.test(matchId);
}

// Procura uma partida existente correspondente
// à partida recebida da API.
//
// A busca prioriza partidas com IDs locais por times e horário,
// preservando IDs que podem estar vinculados a palpites existentes.
//
// Depois tenta apiFixtureId e, por último,
// qualquer partida com os mesmos times e horário.
function findExistingMatchForApiMatch(
  apiMatch: ApiWorldCupMatch,
  existingMatches: Map<string, Match>
) {
  const matches = Array.from(
    existingMatches.values()
  );

  const byTeamsAndSchedule = matches.find(
    (existingMatch) =>
      !isApiGeneratedMatchId(existingMatch.id) &&
      areSameTeams(apiMatch, existingMatch) &&
      areSameSchedule(apiMatch, existingMatch)
  );

  if (byTeamsAndSchedule) {
    return byTeamsAndSchedule;
  }

  const apiFixtureId =
    apiMatch.apiFixtureId || apiMatch.id;

  const byApiFixtureId = matches.find(
    (existingMatch) =>
      existingMatch.apiFixtureId === apiFixtureId
  );

  if (byApiFixtureId) {
    return byApiFixtureId;
  }

  return matches.find(
    (existingMatch) =>
      areSameTeams(apiMatch, existingMatch) &&
      areSameSchedule(apiMatch, existingMatch)
  );
}

// Converte uma partida da API para o formato Match.
//
// Quando a partida existente possui os times na ordem inversa,
// os dados da API também são invertidos para manter teamA/teamB,
// scoreA/scoreB, bandeiras e logos alinhados aos palpites existentes.
//
// Um resultado local finalizado é preservado quando a API
// não fornece um novo placar final válido.
function apiMatchToMatch(
  match: ApiWorldCupMatch,
  existingMatch?: Match
): Match {
  const teamOrder = existingMatch
    ? getTeamOrder(match, existingMatch)
    : 'same';

  const shouldInvertApiSides =
    teamOrder === 'inverted';

  const apiTeamA = shouldInvertApiSides
    ? match.teamB
    : match.teamA;

  const apiTeamB = shouldInvertApiSides
    ? match.teamA
    : match.teamB;

  const apiShortTeamA = shouldInvertApiSides
    ? match.shortTeamB
    : match.shortTeamA;

  const apiShortTeamB = shouldInvertApiSides
    ? match.shortTeamA
    : match.shortTeamB;

  const apiLogoA = shouldInvertApiSides
    ? match.logoB
    : match.logoA;

  const apiLogoB = shouldInvertApiSides
    ? match.logoA
    : match.logoB;

  const rawApiScoreA = shouldInvertApiSides
    ? match.scoreB
    : match.scoreA;

  const rawApiScoreB = shouldInvertApiSides
    ? match.scoreA
    : match.scoreB;

  const apiScoreA =
    typeof rawApiScoreA === 'number'
      ? rawApiScoreA
      : undefined;

  const apiScoreB =
    typeof rawApiScoreB === 'number'
      ? rawApiScoreB
      : undefined;

  const isFinishedWithScore =
    match.status === 'finished' &&
    apiScoreA !== undefined &&
    apiScoreB !== undefined;

  const shouldPreserveExistingFinishedScore =
    existingMatch?.status === 'finished' &&
    typeof existingMatch.scoreA === 'number' &&
    typeof existingMatch.scoreB === 'number' &&
    !isFinishedWithScore;

  return {
    ...existingMatch,

    id: existingMatch?.id || match.id,
    apiFixtureId:
      match.apiFixtureId || match.id,

    teamA: apiTeamA,
    teamB: apiTeamB,

    flagA:
      apiShortTeamA?.toUpperCase() ||
      existingMatch?.flagA ||
      '🏳️',

    flagB:
      apiShortTeamB?.toUpperCase() ||
      existingMatch?.flagB ||
      '🏳️',

    logoA:
      apiLogoA ||
      existingMatch?.logoA ||
      null,

    logoB:
      apiLogoB ||
      existingMatch?.logoB ||
      null,

    date: match.date,
    time: match.time,
    startsAt: match.startsAt,
    startsAtMs: match.startsAtMs,

    group:
      match.group ||
      existingMatch?.group ||
      'Copa do Mundo 2026',

    venue:
      match.venue ||
      existingMatch?.venue,

    city:
      match.city ||
      existingMatch?.city,

    source:
      match.source ||
      existingMatch?.source,

    status: shouldPreserveExistingFinishedScore
      ? 'finished'
      : match.status,

    scoreA: shouldPreserveExistingFinishedScore
      ? existingMatch.scoreA
      : isFinishedWithScore
        ? apiScoreA
        : undefined,

    scoreB: shouldPreserveExistingFinishedScore
      ? existingMatch.scoreB
      : isFinishedWithScore
        ? apiScoreB
        : undefined,
  };
}

// Consulta o endpoint interno de partidas, compara o resultado
// com o Firestore e salva as partidas correspondentes.
//
// Quando finished é utilizado, partidas finalizadas que ainda
// não existem no banco são ignoradas. Nesse modo, o objetivo
// é atualizar resultados de partidas já cadastradas.
export async function syncWorldCupMatchesFromApi(
  options?: SyncWorldCupMatchesFromApiOptions
): Promise<SyncWorldCupMatchesFromApiResult> {
  const response = await fetch(
    buildWorldCupFixturesUrl(options)
  );

  if (!response.ok) {
    throw new Error(
      `Erro ao buscar jogos da API. Status: ${response.status}`
    );
  }

  const rawData: unknown = await response.json();

  const data =
    parseWorldCupFixturesResponse(rawData);

  const snapshot = await getDocs(
    collection(db, 'matches')
  );

  const existingMatches =
    new Map<string, Match>();

  snapshot.forEach((matchDocument) => {
    const match = normalizeMatchDocument(
      matchDocument.id,
      matchDocument.data()
    );

    if (match) {
      existingMatches.set(
        matchDocument.id,
        match
      );
    }
  });

  const validApiMatches = data.matches.filter(
    isValidApiWorldCupMatch
  );

  const nextMatches = validApiMatches
    .map((apiMatch) => {
      const existingMatch =
        findExistingMatchForApiMatch(
          apiMatch,
          existingMatches
        );

      if (
        !existingMatch &&
        options?.finished
      ) {
        return null;
      }

      return apiMatchToMatch(
        apiMatch,
        existingMatch
      );
    })
    .filter(
      (match): match is Match =>
        Boolean(match)
    );

  await writeMatchesInBatches(nextMatches, {
    merge: true,
  });

  return {
    imported: nextMatches.length,
    totalFromApi: data.total,
    source: data.source,
    fallbackFrom:
      data.fallbackFrom || null,
  };
}