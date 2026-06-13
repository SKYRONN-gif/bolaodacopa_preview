import { Match } from '../types';

function parseBrazilianDateTime(date: string, time: string): Date | null {
  const [day, month, year] = date.split('/').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  if (!day || !month || !year || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function getMatchStartDate(match: Match): Date | null {
  if (match.startsAt) {
    const parsedDate = new Date(match.startsAt);

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return parseBrazilianDateTime(match.date, match.time);
}

export function hasMatchStarted(match: Match): boolean {
  const startDate = getMatchStartDate(match);

  if (!startDate) {
    return false;
  }

  return new Date() >= startDate;
}

export function isPredictionLocked(match: Match): boolean {
  return match.status === 'finished' || hasMatchStarted(match);
}

export function getPredictionLockMessage(match: Match): string {
  if (match.status === 'finished') {
    return 'Partida finalizada. O palpite não pode mais ser alterado.';
  }

  if (hasMatchStarted(match)) {
    return 'A partida já começou. O palpite está travado.';
  }

  return 'Palpite aberto até o início da partida.';
}
