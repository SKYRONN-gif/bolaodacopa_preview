import { Match } from '../types';

function getMatchTimestamp(match: Match) {
  if (match.startsAt) {
    const timestamp = new Date(match.startsAt).getTime();

    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  const [day, month, year] = match.date.split('/').map(Number);
  const [hour, minute] = match.time.split(':').map(Number);

  if (!day || !month || !year || Number.isNaN(hour) || Number.isNaN(minute)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return new Date(year, month - 1, day, hour, minute).getTime();
}

export function sortMatchesBySchedule(matches: Match[]) {
  return [...matches].sort((a, b) => {
    const scheduleDiff = getMatchTimestamp(a) - getMatchTimestamp(b);

    if (scheduleDiff !== 0) {
      return scheduleDiff;
    }

    return a.id.localeCompare(b.id, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}
