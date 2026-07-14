import type { Match } from '../types';

// Transforma a data e horário da partida em um timestamp numérico.
//
// Timestamp é um número que representa um momento no tempo.
// Quanto menor o timestamp, mais cedo a partida acontece.
// Quanto maior o timestamp, mais tarde a partida acontece.
function getMatchTimestamp(match: Match): number {
  // Primeiro tenta usar startsAt, que é a representação mais completa
  // da data/hora da partida.
  if (match.startsAt) {
    const timestamp = new Date(match.startsAt).getTime();

    // Quando a data é inválida, getTime retorna NaN.
    // Se o timestamp for válido, ele já pode ser usado para ordenar.
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  // Se startsAt não existir ou estiver inválido,
  // usa os campos antigos/separados date e time como fallback.
  //
  // Exemplo:
  // date = "06/07/2026"
  // time = "16:00"
  //
  // split separa o texto.
  // map(Number) transforma cada parte em número.
  const [day, month, year] = match.date.split('/').map(Number);
  const [hour, minute] = match.time.split(':').map(Number);

  // Verifica se faltou alguma parte importante da data ou hora.
  //
  // Se não conseguir montar uma data confiável,
  // retorna um número muito alto para jogar essa partida ao final da lista.
  if (!day || !month || !year || Number.isNaN(hour) || Number.isNaN(minute)) {
    return Number.MAX_SAFE_INTEGER;
  }

  // Cria a data manualmente usando ano, mês, dia, hora e minuto.
  //
  // O mês usa month - 1 porque, no JavaScript:
  // 0 = janeiro
  // 1 = fevereiro
  // ...
  // 6 = julho
  return new Date(year, month - 1, day, hour, minute).getTime();
}

// Ordena as partidas pela data e horário.
//
// A função cria uma cópia da lista antes de ordenar,
// porque sort altera o array original.
export function sortMatchesBySchedule(matches: Match[]): Match[] {
  return [...matches].sort((matchA, matchB) => {
    // Compara os timestamps das duas partidas.
    //
    // Resultado negativo:
    // matchA vem antes.
    //
    // Resultado positivo:
    // matchB vem antes.
    //
    // Resultado zero:
    // as duas partidas têm o mesmo horário e precisam de desempate.
    const scheduleDiff =
      getMatchTimestamp(matchA) - getMatchTimestamp(matchB);

    // Se existe diferença de horário, essa diferença já decide a ordem.
    if (scheduleDiff !== 0) {
      return scheduleDiff;
    }

    // Se as partidas têm o mesmo horário, usa o id como critério de desempate.
    //
    // numeric: true faz "m2" vir antes de "m10".
    // Sem isso, texto puro poderia ordenar "m10" antes de "m2".
    //
    // sensitivity: 'base' evita diferença por maiúsculas/minúsculas
    // e deixa a comparação textual mais simples.
    return matchA.id.localeCompare(matchB.id, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

// Recria a lista de partidas padrão sem perder resultados
// que já foram finalizados.
//
// Para cada partida padrão, procura uma partida atual com o mesmo id.
// Se a partida atual estiver finalizada e possuir um placar válido,
// mantém seu status e resultado.
export function preserveFinishedResults(
  defaultMatches: Match[],
  currentMatches: Match[]
): Match[] {
  const matchesWithPreservedResults = defaultMatches.map((defaultMatch) => {
    // Procura a versão atual da partida pelo mesmo id.
    const currentMatch = currentMatches.find(
      (match) => match.id === defaultMatch.id
    );

    // Mantém o resultado quando a partida atual já foi finalizada
    // e possui os dois placares preenchidos.
    if (
      currentMatch?.status === 'finished' &&
      typeof currentMatch.scoreA === 'number' &&
      typeof currentMatch.scoreB === 'number'
    ) {
      return {
        ...defaultMatch,
        status: 'finished' as const,
        scoreA: currentMatch.scoreA,
        scoreB: currentMatch.scoreB,
      };
    }

    // Quando não existe resultado finalizado para preservar,
    // mantém a partida padrão sem alterações.
    return defaultMatch;
  });

  return sortMatchesBySchedule(matchesWithPreservedResults);
}

// Adiciona uma partida à lista ou substitui a partida
// que já possui o mesmo id.
//
// Depois da operação, sempre retorna as partidas
// ordenadas por data e horário.
export function upsertMatch(
  matches: Match[],
  nextMatch: Match
): Match[] {
  const alreadyExists = matches.some(
    (match) => match.id === nextMatch.id
  );

  // Se a partida ainda não existe,
  // adiciona ela ao final de uma nova lista.
  if (!alreadyExists) {
    return sortMatchesBySchedule([...matches, nextMatch]);
  }

  // Se a partida já existe, substitui apenas a partida
  // com o mesmo id e mantém todas as outras.
  const updatedMatches = matches.map((match) =>
    match.id === nextMatch.id ? nextMatch : match
  );

  return sortMatchesBySchedule(updatedMatches);
}