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
  // onData: Recebe a lista de partidas. metadata avisa se é cache (true) ou servidor (false).
  onData: (matches: Match[], metadata: { fromCache: boolean }) => void;
  // onEmpty: O banco confirmou que não existe nenhuma partida cadastrada.
  onEmpty: (metadata: { fromCache: boolean }) => void;
  // onError: Falha de rede, permissão negada, etc.
  onError: (error: unknown) => void;
}

// O Firestore aceita no máximo 500 operações simultâneas num writeBatch.
// Usamos 450 como limite seguro para quebrar grandes salvamentos em "lotes menores"
// e evitar que o servidor rejeite a operação por excesso de tamanho.
const FIRESTORE_BATCH_WRITE_LIMIT = 450;

// O Firestore quebra (crasha) se você tentar salvar um campo com valor `undefined`.
// Essa função limpa o objeto antes de enviá-lo para o banco.
function removeUndefinedFields<T extends Record<string, unknown>>(value: T) {

  // 3. Monta o objeto de volta (fromEntries)
  return Object.fromEntries(

    // 1. Desmonta o objeto numa lista de pares [chave, valor] (entries)
    Object.entries(value)

    // 2. Filtra a lista, jogando no lixo qualquer par onde o valor seja "undefined"
    .filter(([, fieldValue]) => fieldValue !== undefined)
  );
}

// Sanitiza e prepara o objeto da partida antes de enviá-lo para o Firestore.
function toFirestoreMatch(match: Match) {

  //Valida se o jogo acabou e se tem placar válido
  const isFinishedWithScore =
    match.status === 'finished' &&
    typeof match.scoreA === 'number' &&
    typeof match.scoreB === 'number';

    //Passa para a função removeUndefinedFields retirar os undefined
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

    // Se o jogo não acabou, força os gols a serem undefined.
    // Assim, a removeUndefinedFields vai apagar essas chaves
    scoreA: isFinishedWithScore ? match.scoreA : undefined,
    scoreB: isFinishedWithScore ? match.scoreB : undefined,
  });
}

// Salva uma lista gigante de partidas no banco dividindo tudo em "lotes seguros" (Batches).
async function writeMatchesInBatches(
  matches: Match[],
  options?: { merge?: boolean }
): Promise<void> {
  
// Abre a prancheta de gravação e começa a contar quantas ordens já anotamos.
  let batch = writeBatch(db);
  let pendingWrites = 0;

  for (const match of matches) {
   // Apenas "escreve o endereço" no envelope para o Firestore saber onde salvar depois.
    const matchRef = doc(db, 'matches', match.id);

    //passa pela função que limpa o corpo
    const firestoreMatch = toFirestoreMatch(match);

    // Se pediram merge, faz um "Upsert" (atualiza sem apagar os dados velhos).
    if (options?.merge) {
      batch.set(matchRef, firestoreMatch, { merge: true });
    } else {
      //se não, faz um novo
      batch.set(matchRef, firestoreMatch);
    }

    // Anota que colocamos mais um item para uma segunda brantch
    pendingWrites++;

if (pendingWrites >= FIRESTORE_BATCH_WRITE_LIMIT) {
      await batch.commit();    // ... 1. Despacha o lote inteiro pro banco de uma vez!
      batch = writeBatch(db);  // ... 2. Pega uma prancheta nova e limpa.
      pendingWrites = 0;       // ... 3. Zera o contador pra começar o próximo lote.
    }
  }

  //salva a sobra do beta
  if (pendingWrites > 0) {
    await batch.commit();
  }
}

export function subscribeToMatches({
  onData,
  onEmpty,
  onError,
}: SubscribeToMatchesParams) {

  //apontada para as matches do banco
  const matchesCol = collection(db, 'matches');

  //abre a conexão em tempo real
  return onSnapshot(
    matchesCol,
    { includeMetadataChanges: true },// Fica de olho se mudou de Cache (offline) para Servidor (online)
    (snapshot) => {
      const metadata = { fromCache: snapshot.metadata.fromCache };

      // Se não tiver nenhum jogo cadastrado, avisa o App e para por aqui.
      if (snapshot.empty) {
        onEmpty(metadata);
        return;
      }

      const loadedMatches: Match[] = [];

      // Passa por cada documento bruto que desceu do banco.
      snapshot.forEach((document) => {
        //normaliza o documento
        const match = normalizeMatchDocument(document.id, document.data());

        // Se a partida estiver íntegra, entra na lista de carregadas.
        if (match) {
          loadedMatches.push(match);
        }
      });

      // ele passa a lista pela função `sortMatchesBySchedule`.
      // Assim, o App sempre recebe os jogos ordenados por data/hora cronológica!
      onData(sortMatchesBySchedule(loadedMatches), metadata);
    },
    (error) => {
      onError(error);
    }
  );
}

//salva ou sobreescreve completamente uma partida no banco
export async function saveMatch(match: Match): Promise<void> {
  //espera a operação de rede terminar (await)
  await setDoc(

    //monta o endereço exato do banco (banco >> Coleção matches >> id da pt)
    doc(db, 'matches', match.id), 
    
    //passa pela função para garantir que não tem undefined
    toFirestoreMatch(match));
}

//faz a seed inicial ou em massa da tabela de partidas
export async function seedMatches(matches: Match[]): Promise<void> {
  
  //joga o trabalho pra writeMatchesInBatches e espera (await) terminar
  await writeMatchesInBatches(matches);
}

//sincroniza uma lista de jogos com o banco de dados seguramento
export async function syncDefaultMatches(matches: Match[]): Promise<void> {
  
  //verifica todas as partidas que tem no banco
  const snapshot = await getDocs(collection(db, 'matches'));

  //cria um dicionario para buscar rapidas
  const existingMatches = new Map<string, Match>();

  //guarda os jogos finais que irão pro banco
  const nextMatches: Match[] = [];

  //passa por cada doc, normalizando ele
  snapshot.forEach((document) => {
    const match = normalizeMatchDocument(document.id, document.data());

    //e guarda cada partida com o id como chave
    if (match) {
      existingMatches.set(document.id, match);
    }
  });

  for (const match of matches) {

    //busca no dicionario se o id já existe
    const existingMatch = existingMatches.get(match.id);

    //cria uma copia para poder modificar
    const nextMatch: Match = { ...match };

    //verifica se o jogo já existia no banco e se atende aos criterio
    if (
      existingMatch?.status === 'finished' &&
      typeof existingMatch.scoreA === 'number' &&
      typeof existingMatch.scoreB === 'number'
    ) {
      //se sim, resgata como está lá e cola na copia
      nextMatch.status = 'finished';
      nextMatch.scoreA = existingMatch.scoreA;
      nextMatch.scoreB = existingMatch.scoreB;
    }

    nextMatches.push(nextMatch); //joga a copia protegida e atualizada dentro da caixa final
  }

  //manda para salvar na função das batches
  await writeMatchesInBatches(nextMatches);
}

// O formato bruto e imprevisível de UM jogo que vem lá do servidor da API externa.
// Cheio de opcionais (?) e "null" porque dados da internet nem sempre vêm completos.
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

// Traz a lista de partidas (matches) e metadados de controle (total, hora da sincronização).
interface WorldCupFixturesResponse {
  matches: ApiWorldCupMatch[];
  total: number;
  source: string;
  fallbackFrom?: string | null;
  syncedAt: string;
}

// Configurações que passamos para a NOSSA função de sincronização.
// Serve para não baixar o banco de dados inteiro à toa (ex: pedir só os de hoje).
interface SyncWorldCupMatchesFromApiOptions {
  limit?: number;
  today?: boolean;
  upcoming?: boolean;
  finished?: boolean;
}

// O balanço que a função devolve para o App depois que o processo termina.
// Avisa quantos jogos realmente entraram no nosso banco (imported) vs quantos tinham lá (totalFromApi)
interface SyncWorldCupMatchesFromApiResult {
  imported: number;
  totalFromApi: number;
  source: string;
  fallbackFrom?: string | null;
}

// Monta o endereço da internet (URL) traduzindo os filtros do App para uma "Query String".
function buildWorldCupFixturesUrl(options?: SyncWorldCupMatchesFromApiOptions) {

  // Inicia o construtor nativo do JS que gerencia parâmetros de URL com segurança.
  const params = new URLSearchParams();

  // Converte números e booleanos para o formato de texto que a API espera (ex: '1' para true).
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

  //Transforma as regras inseridas em um texto formatado (Ex: "limit=5&today=1")
  const queryString = params.toString();

  // Se tem parâmetros, cola eles depois do '?'. Se estiver vazio, retorna só a rota base.
  return queryString
    ? `/api/worldcup-fixtures?${queryString}`
    : '/api/worldcup-fixtures';
}

//Checa se o objeto que chegou da internet
// é realmente uma partida válida antes de deixá-lo entrar no nosso sistema.
function isValidApiWorldCupMatch(match: ApiWorldCupMatch) {
  return (

    // Checa se os campos obrigatórios básicos existem e são textos de verdade
    typeof match.id === 'string' &&
    typeof match.teamA === 'string' &&
    typeof match.teamB === 'string' &&
    typeof match.date === 'string' &&
    typeof match.time === 'string' &&
    typeof match.startsAt === 'string' &&

    //garante que é um número real e utilizável,
    Number.isFinite(match.startsAtMs) &&

    //só aceita jogos que estejam com estes dois status exatos.
    (match.status === 'scheduled' || match.status === 'finished')
  );
}

//prepara nomes das seleções, para não ter parecidas
function normalizeMatchText(value?: string | null) {

// Limpa o texto tirando acentos, pontuações, letras maiúsculas e espaços extras.
  const normalized = (value || '')
    .normalize('NFD')                 // Separa a letra do acento
    .replace(/[\u0300-\u036f]/g, '')  // Joga o acento fora
    .toLowerCase()                    // Transforma tudo em minúsculo
    .replace(/[^a-z0-9]+/g, ' ')      // Troca qualquer caractere estranho por espaço
    .trim();                          // Remove espaços sobrando nas pontas

    // Mapeia as variações ou nomes para o nosso padrão oficial.
  const aliases: Record<string, string> = {

    // República Tcheca / Czechia
'rep checa': 'republica tcheca',
'republica checa': 'republica tcheca',
'republica tcheca': 'republica tcheca',
'czechia': 'republica tcheca',
'czech republic': 'republica tcheca',

    // Congo
    'rd congo': 'republica democratica do congo',
    'dr congo': 'republica democratica do congo',
    'congo dr': 'republica democratica do congo',
    'democratic republic of congo': 'republica democratica do congo',
    'republica democratica congo': 'republica democratica do congo',
    'republica democratica do congo': 'republica democratica do congo',

    // Holanda / Países Baixos
    'holanda': 'paises baixos',
    'netherlands': 'paises baixos',
    'netherland': 'paises baixos',

    // Costa do Marfim
    'ivory coast': 'costa do marfim',
    'cote d ivoire': 'costa do marfim',
    'cote divoire': 'costa do marfim',

    // Estados Unidos
    'usa': 'estados unidos',
    'united states': 'estados unidos',
    'united states of america': 'estados unidos',

    // Coreia
    'south korea': 'coreia do sul',
    'korea republic': 'coreia do sul',

    // Bósnia
    'bosnia and herzegovina': 'bosnia e herzegovina',
    'bosnia herzegovina': 'bosnia e herzegovina',

    // Outros nomes comuns
    'germany': 'alemanha',
    'spain': 'espanha',
    'switzerland': 'suica',
    'sweden': 'suecia',
    'turkiye': 'turquia',
    'turkey': 'turquia',
    'morocco': 'marrocos',
    'japan': 'japao',
    'paraguay': 'paraguai',
  };

  // Retorna a versão padronizada do dicionário. Se não existir no dicionário, 
  // retorna a palavra que passou
  return aliases[normalized] || normalized;
}

// Remove espaços acidentais da data
function normalizeMatchDate(value?: string | null) {
  return (value || '').trim();
}

// Remove espaços acidentais do horário
function normalizeMatchTime(value?: string | null) {
  return (value || '').trim();
}

//deixa ficar a mesma ordem ou a ordem invertida
function areSameTeams(apiMatch: ApiWorldCupMatch, existingMatch: Match) {

// 1. Passa os 4 times (os 2 da API e os 2 do nosso Banco) pela nossa "Máquina de Lavar Textos"
  // para ignorar acentos, letras maiúsculas e diferenças de idioma (ex: Holanda vs Netherlands).
  const apiTeamA = normalizeMatchText(apiMatch.teamA);
  const apiTeamB = normalizeMatchText(apiMatch.teamB);

  const existingTeamA = normalizeMatchText(existingMatch.teamA);
  const existingTeamB = normalizeMatchText(existingMatch.teamB);

  // 2. Testa a Rota Direta: A é igual a A, e B é igual a B?
  const sameOrder = apiTeamA === existingTeamA && apiTeamB === existingTeamB;
  
  // 3. Testa a Rota Espelhada (Invertida): O A da API é o nosso B, e o B da API é o nosso A?
  const invertedOrder = apiTeamA === existingTeamB && apiTeamB === existingTeamA;

  // 4. Se qualquer uma das rotas for verdadeira, significa que é o exato mesmo jogo.
  return sameOrder || invertedOrder;
}

// Verifica se a partida que veio da API vai acontecer no mesmo momento da partida 
// que já temos salva no banco de dados.
function areSameSchedule(apiMatch: ApiWorldCupMatch, existingMatch: Match) {

  //verifica se as datas da api e do banco são as mesmas
  const sameDate =
    normalizeMatchDate(apiMatch.date) === normalizeMatchDate(existingMatch.date);

      //verifica se o horario da api e do banco são as mesmas
  const sameTime =
    normalizeMatchTime(apiMatch.time) === normalizeMatchTime(existingMatch.time);

    // Se o jogo mudou das 16:00 para as 16:30, a diferença é de apenas 30 minutos.
  // Como 30m é menor que nossa janela máxima de 90m (1000ms * 60s * 90m), ele aceita!
  const closeStartsAt =
    Number.isFinite(apiMatch.startsAtMs) &&
    Number.isFinite(existingMatch.startsAtMs) &&
    Math.abs(apiMatch.startsAtMs - existingMatch.startsAtMs) <= 1000 * 60 * 90;

    // Só é o mesmo jogo se a DATA for idêntica. 
  // E o horário tem que bater exato OU estar dentro da margem de 90 minutos de diferença.
  return sameDate && (sameTime || closeStartsAt);
}

// Descobre se a partida foi importada da API externa ou criada manualmente no app.
function isApiGeneratedMatchId(matchId: string) {
  return /^\d+$/.test(matchId);
}

// Tenta descobrir se a partida que chegou da API já existe no nosso banco de dados
function findExistingMatchForApiMatch(
  apiMatch: ApiWorldCupMatch,
  existingMatches: Map<string, Match>
) {

  // Transforma o Dicionário (Map) numa Lista (Array).
  //Map só consegue buscar se tivermos o ID exato.
  // O Array nos dá acesso ao superpoder '.find()', que permite buscar por características.
  const matches = Array.from(existingMatches.values());

// Procura uma partida que foi criada por um humano (não tem ID de API), 
  // mas que é exatamente o mesmo jogo (mesmos times e horário).
  const byTeamsAndSchedule = matches.find(
    (existingMatch) =>
      !isApiGeneratedMatchId(existingMatch.id) && // Garante que foi criado na mão
      areSameTeams(apiMatch, existingMatch) &&    // Usa o nosso Detector de Espelhos
      areSameSchedule(apiMatch, existingMatch)    // Usa a nossa Janela de 90 minutos
  );

  // EARLY RETURN
// Se encontrou na Tentativa 1, devolve a partida e encerra a função aqui mesmo.
  // Não tem por que gastar processamento procurando nas outras tentativas.
  if (byTeamsAndSchedule) {
    return byTeamsAndSchedule;
  }

//TENTATIVA 2
// Se não tem jogo manual, procura pela ligação oficial: O ID da API que salvamos no banco
  // bate com o ID da API que acabou de chegar?
  const byApiFixtureId = matches.find(
    (existingMatch) =>
      existingMatch.apiFixtureId &&
      existingMatch.apiFixtureId === (apiMatch.apiFixtureId || apiMatch.id)
  );

  if (byApiFixtureId) {
    return byApiFixtureId;
  }

  //TENTATIVA 3 (O Plano de Contingência):
  // Se o ID falhou (bug da API), procura por qualquer partida no banco que tenha 
  // os mesmos times e horários, independente de onde ela veio.
  const byAnyTeamsAndSchedule = matches.find(
    (existingMatch) =>
      areSameTeams(apiMatch, existingMatch) &&
      areSameSchedule(apiMatch, existingMatch)
  );

  return byAnyTeamsAndSchedule;
}

function apiMatchToMatch(match: ApiWorldCupMatch, existingMatch?: Match): Match {
  //verifica se a partida acabou com placar
  const isFinishedWithScore =
    match.status === 'finished' &&
    typeof match.scoreA === 'number' &&
    typeof match.scoreB === 'number';

    //se a partida existir ou não e o status for finished, e tiver número no placar, ela não é finalizada? foi isso que li aqui
  const shouldPreserveExistingFinishedScore =
    existingMatch?.status === 'finished' &&
    typeof existingMatch.scoreA === 'number' &&
    typeof existingMatch.scoreB === 'number' &&
    !isFinishedWithScore;

  return {
    ...existingMatch, //preserva a partida existente

    //converte a partida da api, para Match
    id: existingMatch?.id || match.id,
    apiFixtureId: match.apiFixtureId || match.id,

    teamA: match.teamA,
    teamB: match.teamB,

    flagA: match.shortTeamA?.toUpperCase() || existingMatch?.flagA || '🏳️',
flagB: match.shortTeamB?.toUpperCase() || existingMatch?.flagB || '🏳️',

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
  //response seria a resposta, ele ta esperando o para buscar as opções da url
  const response = await fetch(buildWorldCupFixturesUrl(options));

  if (!response.ok) {
    throw new Error(`Erro ao buscar jogos da API. Status: ${response.status}`);
  }

  //pega o json da api
  const data = (await response.json()) as WorldCupFixturesResponse;

  //se não tiver partidas: joga oe rro
  if (!Array.isArray(data.matches)) {
    throw new Error('Resposta inválida da API: matches não encontrado.');
  }

  //pega as coleções de partidas do banco
  const snapshot = await getDocs(collection(db, 'matches'));
  const existingMatches = new Map<string, Match>();

  //normaliza eles
  snapshot.forEach((document) => {
    const match = normalizeMatchDocument(document.id, document.data());

    //se tiver, seta como uma nova pt
    if (match) {
      existingMatches.set(document.id, match);
    }
  });

  //
const validApiMatches = data.matches.filter(isValidApiWorldCupMatch);

//
const nextMatches = validApiMatches
  .map((apiMatch) => {
    //procura uma partida api e do banco
    const existingMatch = findExistingMatchForApiMatch(apiMatch, existingMatches);

    //se ão tiver partida e tiver ou não tiver finished, retorna null
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
