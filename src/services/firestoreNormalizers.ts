import { DEFAULT_AVATAR } from '../config/avatars';

import type {
  Match,
  Player,
  Prediction,
} from '../types';

// Maior placar aceito pelo sistema.
//
// Qualquer valor acima desse limite
// será convertido para 99.
const MAX_SCORE = 99;

// Verifica se o valor recebido é um objeto comum.
//
// O valor precisa:
// - ser considerado object pelo JavaScript;
// - não ser null;
// - não ser um array.
//
// Quando retorna true, o TypeScript permite acessar
// propriedades como value.name e value.scoreA.
function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

// Recebe um valor desconhecido e tenta
// transformá-lo em uma string válida.
//
// Se não for string ou ficar vazio depois do trim,
// devolve o fallback.
//
// Caso possua conteúdo, limita o tamanho com slice.
function cleanString(
  value: unknown,
  fallback: string,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(
    0,
    maxLength
  );
}

// Limpa campos de texto opcionais.
//
// Diferente de cleanString, esta função não precisa
// receber um fallback. Quando não existe conteúdo,
// devolve undefined.
function cleanOptionalString(
  value: unknown,
  maxLength: number
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(
    0,
    maxLength
  );
}

// Procura uma propriedade dentro de um objeto
// e tenta transformá-la em número.
//
// value[key] permite acessar uma propriedade
// usando o nome recebido no parâmetro key.
//
// Exemplo:
// value = { seconds: "100" }
// key = "seconds"
// rawValue = "100"
function getRecordNumber(
  value: Record<string, unknown>,
  key: string
): number | undefined {
  const rawValue = value[key];

  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue)
      ? rawValue
      : undefined;
  }

  if (typeof rawValue === 'string') {
    const parsedValue =
      Number(rawValue);

    return Number.isFinite(parsedValue)
      ? parsedValue
      : undefined;
  }

  return undefined;
}

// Converte um timestamp numérico
// para um objeto Date.
//
// Timestamps podem chegar em:
//
// segundos:
// 1710000000
//
// milissegundos:
// 1710000000000
//
// Valores menores que um trilhão são tratados
// como segundos e multiplicados por 1000.
function epochToDate(
  value: number
): Date | null {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  const milliseconds =
    Math.abs(value) <
    1_000_000_000_000
      ? value * 1000
      : value;

  const date =
    new Date(milliseconds);

  // getTime() retorna NaN
  // quando o objeto Date é inválido.
  return Number.isNaN(date.getTime())
    ? null
    : date;
}

// Recebe um valor desconhecido e tenta
// transformá-lo em um objeto Date.
//
// A função aceita:
// - Date;
// - timestamp numérico;
// - timestamp salvo como string;
// - data em formato de texto;
// - Timestamp do Firestore com toDate();
// - objeto com seconds e nanoseconds.
//
// Quando nenhum formato funciona,
// retorna null.
function parseDateTimeValue(
  value: unknown
): Date | null {
  // O valor já pode ser um Date.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  // Números são tratados como timestamps
  // em segundos ou milissegundos.
  if (typeof value === 'number') {
    return epochToDate(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    // Primeiro tenta interpretar a string
    // como um timestamp numérico.
    const numericValue =
      Number(trimmed);

    if (
      Number.isFinite(numericValue)
    ) {
      return epochToDate(
        numericValue
      );
    }

    // Caso não seja número, tenta criar
    // uma data usando o texto recebido.
    const date =
      new Date(trimmed);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  // Caso ainda não tenha sido identificado,
  // só continua se for um objeto comum.
  if (!isRecord(value)) {
    return null;
  }

  // Timestamps do Firestore normalmente
  // possuem um método chamado toDate().
  if (
    typeof value.toDate ===
    'function'
  ) {
    try {
      const date =
        value.toDate();

      if (
        date instanceof Date &&
        !Number.isNaN(
          date.getTime()
        )
      ) {
        return date;
      }
    } catch {
      // Caso toDate falhe, a função ainda tenta
      // os formatos com seconds abaixo.
    }
  }

  // Primeiro procura seconds.
  // Caso não exista, tenta o formato _seconds.
  //
  // O operador ?? usa o valor da direita
  // quando o da esquerda é null ou undefined.
  const seconds =
    getRecordNumber(
      value,
      'seconds'
    ) ??
    getRecordNumber(
      value,
      '_seconds'
    );

  if (seconds === undefined) {
    return null;
  }

  // Segue o mesmo processo para nanoseconds.
  // Quando nenhum campo existe, usa zero.
  const nanoseconds =
    getRecordNumber(
      value,
      'nanoseconds'
    ) ??
    getRecordNumber(
      value,
      '_nanoseconds'
    ) ??
    0;

  // Converte segundos para milissegundos.
  //
  // Nanosegundos também são convertidos
  // para milissegundos.
  //
  // Math.floor arredonda para baixo,
  // removendo qualquer parte decimal.
  const milliseconds =
    seconds * 1000 +
    Math.floor(
      nanoseconds / 1_000_000
    );

  const date =
    new Date(milliseconds);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

// Tenta transformar qualquer formato de data
// em uma string ISO.
//
// Exemplo:
// 2026-07-06T19:30:00.000Z
//
// Caso não consiga interpretar como Date,
// ainda preserva strings com conteúdo,
// limitadas a 40 caracteres.
function cleanDateTimeString(
  value: unknown
): string | undefined {
  const date =
    parseDateTimeValue(value);

  if (date) {
    return date.toISOString();
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed
    ? trimmed.slice(0, 40)
    : undefined;
}

// Recebe um número ou uma string numérica
// e tenta devolver um número válido.
//
// Strings com vírgula são convertidas
// para o formato com ponto.
//
// A verificação da string vazia evita que
// Number("") transforme um campo vazio em zero.
function cleanNumber(
  value: unknown,
  fallback = 0
): number {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : fallback;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const normalizedValue =
    value
      .trim()
      .replace(',', '.');

  if (!normalizedValue) {
    return fallback;
  }

  const parsedValue =
    Number(normalizedValue);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback;
}

// Limpa um placar recebido.
//
// Primeiro tenta obter um número.
// Depois arredonda para o inteiro mais próximo.
//
// Math.max impede placares abaixo de zero.
// Math.min impede placares acima de MAX_SCORE.
function cleanScore(
  value: unknown,
  fallback = 0
): number {
  const score = Math.round(
    cleanNumber(
      value,
      fallback
    )
  );

  return Math.min(
    MAX_SCORE,
    Math.max(
      0,
      score
    )
  );
}

// Limpa um placar que pode não existir.
//
// Campos ausentes ou vazios retornam undefined.
// Valores válidos passam por cleanScore.
//
// Isso evita transformar uma partida sem placar
// em um resultado artificial de 0 × 0.
function cleanOptionalScore(
  value: unknown
): number | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  if (
    typeof value === 'string' &&
    !value.trim()
  ) {
    return undefined;
  }

  const score = cleanScore(
    value,
    Number.NaN
  );

  return Number.isFinite(score)
    ? score
    : undefined;
}

// Converte uma data e um horário brasileiros
// para um objeto Date.
//
// Formato esperado:
//
// data: 06/07/2026
// hora: 16:30
function parseBrazilianSchedule(
  date: string,
  time: string
): Date | null {
  // Aceita:
  // dia com 1 ou 2 dígitos;
  // mês com 1 ou 2 dígitos;
  // ano com exatamente 4 dígitos.
  const dateMatch =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(
      date.trim()
    );

  // Aceita:
  // hora com 1 ou 2 dígitos;
  // minutos com exatamente 2 dígitos.
  const timeMatch =
    /^(\d{1,2}):(\d{2})$/.exec(
      time.trim()
    );

  // exec() retorna null quando o texto
  // não corresponde ao formato esperado.
  if (
    !dateMatch ||
    !timeMatch
  ) {
    return null;
  }

  // A posição zero contém o texto completo
  // encontrado pela expressão e é ignorada.
  //
  // As posições seguintes contêm
  // cada grupo separado.
  const [
    ,
    rawDay,
    rawMonth,
    rawYear,
  ] = dateMatch;

  const [
    ,
    rawHour,
    rawMinute,
  ] = timeMatch;

  const day =
    Number(rawDay);

  const month =
    Number(rawMonth);

  const year =
    Number(rawYear);

  const hour =
    Number(rawHour);

  const minute =
    Number(rawMinute);

  // Valida os limites básicos
  // da data e do horário.
  if (
    !day ||
    !month ||
    !year ||
    month > 12 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  // Descobre quantos dias existem
  // no mês e ano informados.
  //
  // Isso impede que datas como 31/02/2026
  // sejam ajustadas automaticamente para março.
  const daysInMonth =
    new Date(
      Date.UTC(
        year,
        month,
        0
      )
    ).getUTCDate();

  if (day > daysInMonth) {
    return null;
  }

  // Arrow function curta que adiciona zero
  // à esquerda até o número possuir dois dígitos.
  //
  // 7 vira "07".
  // 12 continua "12".
  const pad = (
    numberValue: number
  ) =>
    String(numberValue)
      .padStart(2, '0');

  // O -03:00 representa o fuso usado
  // para os horários das partidas.
  const parsedDate =
    new Date(
      `${year}-${pad(month)}-${pad(day)}` +
      `T${pad(hour)}:${pad(minute)}:00-03:00`
    );

  return Number.isNaN(
    parsedDate.getTime()
  )
    ? null
    : parsedDate;
}

// Produz o timestamp em milissegundos
// usado para ordenar e comparar as partidas.
//
// A função tenta encontrar um horário válido
// seguindo esta ordem:
//
// 1. value, normalmente startsAtMs;
// 2. value convertido diretamente para número;
// 3. startsAt;
// 4. combinação de date e time;
// 5. zero, quando nenhuma fonte é válida.
function cleanTimestampMs(
  value: unknown,
  startsAt: string,
  date: string,
  time: string
): number {
  const parsedValue =
    parseDateTimeValue(value);

  if (parsedValue) {
    return parsedValue.getTime();
  }

  // Essa tentativa também aceita números
  // que tenham chegado como string com vírgula.
  const timestamp =
    cleanNumber(
      value,
      Number.NaN
    );

  if (
    Number.isFinite(timestamp) &&
    timestamp > 0
  ) {
    const timestampDate =
      epochToDate(timestamp);

    if (timestampDate) {
      return timestampDate.getTime();
    }

    return timestamp;
  }

  // O optional chaining ?. só executa getTime()
  // quando parseDateTimeValue retorna um Date.
  const parsedStartsAt =
    parseDateTimeValue(
      startsAt
    )?.getTime();

  if (
    parsedStartsAt !== undefined &&
    Number.isFinite(
      parsedStartsAt
    )
  ) {
    return parsedStartsAt;
  }

  const parsedSchedule =
    parseBrazilianSchedule(
      date,
      time
    )?.getTime();

  if (
    parsedSchedule !== undefined &&
    Number.isFinite(
      parsedSchedule
    )
  ) {
    return parsedSchedule;
  }

  return 0;
}

// Tenta transformar um valor desconhecido
// em um palpite válido.
//
// scoreA e scoreB são obrigatórios.
// Se qualquer um for inválido,
// o palpite inteiro é rejeitado.
//
// createdAt e updatedAt são opcionais.
function cleanPrediction(
  value: unknown
): Prediction | null {
  if (!isRecord(value)) {
    return null;
  }

  const scoreA = cleanScore(
    value.scoreA,
    Number.NaN
  );

  const scoreB = cleanScore(
    value.scoreB,
    Number.NaN
  );

  if (
    !Number.isFinite(scoreA) ||
    !Number.isFinite(scoreB)
  ) {
    return null;
  }

  const prediction: Prediction = {
    scoreA,
    scoreB,
  };

  const createdAt =
    cleanDateTimeString(
      value.createdAt
    );

  const updatedAt =
    cleanDateTimeString(
      value.updatedAt
    );

  // Os campos opcionais só são adicionados
  // quando possuem um valor válido.
  if (createdAt) {
    prediction.createdAt =
      createdAt;
  }

  if (updatedAt) {
    prediction.updatedAt =
      updatedAt;
  }

  return prediction;
}

// Normaliza o mapa completo de palpites
// de um jogador.
//
// Object.entries transforma cada propriedade
// do objeto em um par:
//
// [matchId, rawPrediction]
//
// O for...of percorre esses pares.
// Somente IDs e palpites válidos
// são adicionados ao resultado.
function cleanPredictions(
  value: unknown
): Record<string, Prediction> {
  if (!isRecord(value)) {
    return {};
  }

  const predictions: Record<
    string,
    Prediction
  > = {};

  for (
    const [
      matchId,
      rawPrediction,
    ] of Object.entries(value)
  ) {
    const cleanMatchId =
      cleanString(
        matchId,
        '',
        128
      );

    const prediction =
      cleanPrediction(
        rawPrediction
      );

    // continue encerra somente esta volta
    // e passa para o próximo palpite.
    if (
      !cleanMatchId ||
      !prediction
    ) {
      continue;
    }

    predictions[cleanMatchId] =
      prediction;
  }

  return predictions;
}

// Recebe o ID e os dados brutos
// de uma partida do Firestore.
//
// A função rejeita documentos que:
// - não sejam objetos;
// - não possuam um ID válido.
//
// Depois normaliza horários, placares,
// equipes e demais dados da partida.
export function normalizeMatchDocument(
  documentId: string,
  value: unknown
): Match | null {
  if (!isRecord(value)) {
    return null;
  }

  // O ID do documento possui prioridade.
  //
  // Caso ele esteja vazio, tenta utilizar
  // o campo id salvo dentro do documento.
  const id = cleanString(
    documentId,
    cleanString(
      value.id,
      '',
      128
    ),
    128
  );

  if (!id) {
    return null;
  }

  const date = cleanString(
    value.date,
    'Data indefinida',
    50
  );

  const time = cleanString(
    value.time,
    '--:--',
    50
  );

  // Primeiro tenta utilizar startsAt.
  //
  // Caso ele não exista, tenta criar uma data
  // combinando os campos date e time.
  //
  // Se nenhuma opção funcionar,
  // utiliza uma string vazia.
  const startsAt =
    cleanDateTimeString(
      value.startsAt
    ) ||
    parseBrazilianSchedule(
      date,
      time
    )?.toISOString() ||
    '';

  // Somente o texto exato "finished"
  // é aceito como uma partida finalizada.
  //
  // Qualquer outro valor vira "scheduled".
  const status =
    value.status === 'finished'
      ? 'finished'
      : 'scheduled';

  // Placares ausentes ou inválidos
  // permanecem como undefined.
  //
  // O normalizador não inventa 0 × 0
  // apenas porque a partida está finalizada.
  const scoreA =
    cleanOptionalScore(
      value.scoreA
    );

  const scoreB =
    cleanOptionalScore(
      value.scoreB
    );

  return {
    id,

    teamA: cleanString(
      value.teamA,
      'Time A',
      100
    ),

    teamB: cleanString(
      value.teamB,
      'Time B',
      100
    ),

    flagA: cleanString(
      value.flagA,
      '',
      10
    ),

    flagB: cleanString(
      value.flagB,
      '',
      10
    ),

    date,
    time,
    startsAt,

    startsAtMs:
      cleanTimestampMs(
        value.startsAtMs,
        startsAt,
        date,
        time
      ),

    status,
    scoreA,
    scoreB,

    group: cleanString(
      value.group,
      'Sem grupo',
      50
    ),

    venue:
      cleanOptionalString(
        value.venue,
        120
      ),

    city:
      cleanOptionalString(
        value.city,
        120
      ),

    apiFixtureId:
      cleanOptionalString(
        value.apiFixtureId,
        128
      ),

    logoA:
      cleanOptionalString(
        value.logoA,
        500
      ) || null,

    logoB:
      cleanOptionalString(
        value.logoB,
        500
      ) || null,

    source:
      cleanOptionalString(
        value.source,
        50
      ),
  };
}

// Recebe o ID e os dados brutos
// de um jogador do Firestore.
//
// A função normaliza:
// - nome e avatar;
// - palpites;
// - pontuação;
// - acertos;
// - ajuste manual;
// - permissão de administrador;
// - e-mail.
//
// Documentos inválidos ou sem ID
// são rejeitados com null.
export function normalizePlayerDocument(
  documentId: string,
  value: unknown
): Player | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = cleanString(
    documentId,
    cleanString(
      value.id,
      '',
      128
    ),
    128
  );

  if (!id) {
    return null;
  }

  return {
    id,

    name: cleanString(
      value.name,
      'Jogador sem nome',
      128
    ),

    // Os avatares deste projeto são valores curtos,
    // como emojis ou identificadores,
    // por isso o limite continua em 10 caracteres.
    avatar: cleanString(
      value.avatar,
      DEFAULT_AVATAR,
      10
    ),

    predictions:
      cleanPredictions(
        value.predictions
      ),

    points: cleanNumber(
      value.points,
      0
    ),

    exactHits: cleanNumber(
      value.exactHits,
      0
    ),

    partialHits: cleanNumber(
      value.partialHits,
      0
    ),

    errorHits: cleanNumber(
      value.errorHits,
      0
    ),

    manualPointsAdjustment:
      cleanNumber(
        value.manualPointsAdjustment,
        0
      ),

    manualPointsAdjustmentUpdatedAt:
      cleanDateTimeString(
        value.manualPointsAdjustmentUpdatedAt
      ) || '',

    lastPredictionMatchId:
      cleanString(
        value.lastPredictionMatchId,
        '',
        128
      ),

    // Apenas o booleano true
    // concede permissão de administrador.
    isAdmin:
      value.isAdmin === true,

    // O e-mail é limpo e convertido
    // para minúsculas para manter consistência
    // com o restante da aplicação.
    email: cleanString(
      value.email,
      '',
      254
    ).toLowerCase(),
  };
}