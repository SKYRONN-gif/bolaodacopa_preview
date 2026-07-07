import type { Match } from '../types';

// Converte data e horário antigos, como "13/06/2026" e "16:00",
// para um objeto Date do JavaScript.
//
// Esse formato é apenas um fallback para registros antigos.
// O formato principal do projeto deve ser startsAtMs.
function parseBrazilianDateTime(date: string, time: string): Date | null {
  // Confirma se a data segue um formato como "13/06/2026".
  const dateHasExpectedFormat = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date);

  // Confirma se o horário segue um formato como "16:00".
  const timeHasExpectedFormat = /^\d{1,2}:\d{2}$/.test(time);

  if (!dateHasExpectedFormat || !timeHasExpectedFormat) {
    return null;
  }

  // Divide a data em dia, mês e ano, convertendo cada parte para número.
  const [day, month, year] = date.split('/').map(Number);

  // Divide o horário em hora e minuto, convertendo cada parte para número.
  const [hour, minute] = time.split(':').map(Number);

  // Impede valores impossíveis antes de criar a data.
  const hasValidBasicRanges =
    day >= 1 &&
    day <= 31 &&
    month >= 1 &&
    month <= 12 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59;

  if (!hasValidBasicRanges) {
    return null;
  }

  // No JavaScript, janeiro é 0 e dezembro é 11.
  const parsedDate = new Date(year, month - 1, day, hour, minute, 0, 0);

  // O JavaScript pode transformar silenciosamente uma data inválida.
  //
  // Exemplo:
  // 31/02/2026 pode virar uma data de março.
  //
  // Esta comparação confirma que a data criada manteve exatamente
  // os mesmos valores recebidos.
  const keptOriginalDateAndTime =
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day &&
    parsedDate.getHours() === hour &&
    parsedDate.getMinutes() === minute;

  if (!keptOriginalDateAndTime) {
    return null;
  }

    return parsedDate;

}

// Retorna a data de início da partida na ordem mais confiável.
//
// 1. startsAtMs: horário em milissegundos usado também pelas Firestore Rules.
// 2. startsAt: data completa, normalmente enviada em formato ISO.
// 3. date + time: fallback para partidas antigas.
export function getMatchStartDate(match: Match): Date | null {
  // Number.isFinite confirma que existe um número válido e finito.
  //
  // Mesmo sendo obrigatório no TypeScript, esta verificação protege
  // o front-end contra documentos antigos ou dados inconsistentes no Firestore.
  if (Number.isFinite(match.startsAtMs)) {
    return new Date(match.startsAtMs);
  }

  // Tenta interpretar startsAt caso startsAtMs esteja ausente ou inválido.
  if (match.startsAt) {
    const parsedDate = new Date(match.startsAt);

    // getTime retorna NaN quando o JavaScript não consegue interpretar a data.
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  // Última alternativa para manter compatibilidade com registros antigos.
  return parseBrazilianDateTime(match.date, match.time);
}

// Verifica se o horário atual já chegou ou passou do início da partida.
export function hasMatchStarted(match: Match): boolean {
  const startDate = getMatchStartDate(match);

  // Mantém o comportamento atual: quando a interface não consegue identificar
  // o horário do jogo, ela não bloqueia visualmente o palpite.
  //
  // A proteção definitiva continua nas Firestore Rules, no servidor.
  if (!startDate) {
    return false;
  }

  // Date.now() retorna o horário atual em milissegundos.
  // getTime() retorna o horário da partida no mesmo formato.
  return Date.now() >= startDate.getTime();
}

// Define se a interface deve impedir edição do palpite.
export function isPredictionLocked(match: Match): boolean {
  // Jogo finalizado sempre fica travado, mesmo que exista algum problema
  // com o horário salvo na partida.
  if (match.status === 'finished') {
    return true;
  }

  // Jogo agendado fica travado quando o horário de início é atingido.
  return hasMatchStarted(match);
}

// Retorna a mensagem que será mostrada para o participante.
//
// Essa função melhora a experiência da interface, mas não é a segurança real.
// A autorização definitiva para salvar palpites acontece nas Firestore Rules.
export function getPredictionLockMessage(match: Match): string {
  if (match.status === 'finished') {
    return 'Partida finalizada. O palpite não pode mais ser alterado.';
  }

  if (hasMatchStarted(match)) {
    return 'A partida já começou. O palpite está travado.';
  }

  return 'Palpite aberto até o início da partida.';
}