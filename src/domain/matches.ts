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