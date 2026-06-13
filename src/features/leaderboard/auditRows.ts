import { Match, Player, Prediction } from '../../types';

export interface PredictionAuditRow {
  key: string;
  match: Match;
  player: Player;
  prediction: Prediction;
}

export interface PaginatedRows<T> {
  rows: T[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  startRow: number;
  endRow: number;
}

export function buildPredictionAuditRows(
  matches: Match[],
  players: Player[]
): PredictionAuditRow[] {
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const collectedRows: PredictionAuditRow[] = [];

  players.forEach((player) => {
    Object.entries(player.predictions || {}).forEach(([matchId, prediction]) => {
      const match = matchesById.get(matchId);

      if (!match) return;

      collectedRows.push({
        key: `${matchId}-${player.id}`,
        match,
        player,
        prediction,
      });
    });
  });

  return collectedRows.sort((a, b) => {
    if (a.match.id !== b.match.id) {
      return a.match.id.localeCompare(b.match.id, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }

    return a.player.name.localeCompare(b.player.name);
  });
}

export function filterAuditRowsByMatch(
  rows: PredictionAuditRow[],
  selectedMatchId: string
) {
  if (selectedMatchId === 'all') return rows;

  return rows.filter((row) => row.match.id === selectedMatchId);
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number
): PaginatedRows<T> {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRows);

  return {
    rows: rows.slice(startIndex, endIndex),
    page: safePage,
    pageSize,
    totalRows,
    totalPages,
    startRow: totalRows === 0 ? 0 : startIndex + 1,
    endRow: endIndex,
  };
}
