import { Clock3, Eye, ListChecks } from 'lucide-react';
import { useMemo, useState } from 'react';

import { calculatePredictionPoints } from '../../domain/scoring';
import { Match, Player, Prediction } from '../../types';

interface PredictionsAuditTableProps {
  matches: Match[];
  players: Player[];
}

interface PredictionAuditRow {
  key: string;
  match: Match;
  player: Player;
  prediction: Prediction;
}

function formatDateTime(value?: string) {
  if (!value) return 'Não informado';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Não informado';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getMatchLabel(match: Match) {
  return `${match.flagA} ${match.teamA} x ${match.teamB} ${match.flagB}`;
}

function getResultLabel(match: Match) {
  if (
    match.status === 'finished' &&
    typeof match.scoreA === 'number' &&
    typeof match.scoreB === 'number'
  ) {
    return `${match.scoreA} x ${match.scoreB}`;
  }

  return 'Em aberto';
}

function getPointsLabel(row: PredictionAuditRow) {
  const result = calculatePredictionPoints(row.prediction, row.match);

  if (result.type === 'unplayed') return 'Aguardando';

  return `${result.points} ${result.points === 1 ? 'pt' : 'pts'}`;
}

function getPointsClass(row: PredictionAuditRow) {
  const result = calculatePredictionPoints(row.prediction, row.match);

  if (result.type === 'exact') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (result.type === 'partial') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (result.type === 'error') return 'bg-red-50 text-red-600 border-red-100';

  return 'bg-slate-50 text-slate-500 border-slate-100';
}

export function PredictionsAuditTable({
  matches,
  players,
}: PredictionsAuditTableProps) {
  const [selectedMatchId, setSelectedMatchId] = useState('all');

  const rows = useMemo<PredictionAuditRow[]>(() => {
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
  }, [matches, players]);

  const filteredRows =
    selectedMatchId === 'all'
      ? rows
      : rows.filter((row) => row.match.id === selectedMatchId);

  const matchesWithPredictions = matches.filter((match) =>
    rows.some((row) => row.match.id === match.id)
  );

  return (
    <section className="app-card overflow-hidden" id="predictions-audit">
      <div className="p-4 md:p-5 border-b border-slate-200 bg-slate-50 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-5 h-5 text-emerald-600 shrink-0" />

          <div className="min-w-0">
            <h3 className="font-bold text-base text-slate-800 uppercase tracking-tight">
              Conferência de palpites
            </h3>

            <p className="text-xs text-slate-500">
              Palpites enviados pelos participantes, com horário e pontuação.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 shrink-0">
            {rows.length} palpites
          </span>

          <label className="sr-only" htmlFor="prediction-audit-match-filter">
            Filtrar jogo
          </label>

          <select
            id="prediction-audit-match-filter"
            value={selectedMatchId}
            onChange={(event) => setSelectedMatchId(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">Todos os jogos</option>
            {matchesWithPredictions.map((match) => (
              <option key={match.id} value={match.id}>
                {match.teamA} x {match.teamB}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-6 text-sm text-slate-600">
          Nenhum palpite foi salvo no banco ainda.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="p-6 text-sm text-slate-600">
          Nenhum palpite encontrado para esse jogo.
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[860px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="py-4 px-5 font-bold">Jogo</th>
                  <th className="py-4 px-4 font-bold">Participante</th>
                  <th className="py-4 px-4 text-center font-bold">Palpite</th>
                  <th className="py-4 px-4 text-center font-bold">Resultado</th>
                  <th className="py-4 px-4 text-center font-bold">Pontos</th>
                  <th className="py-4 px-5 text-right font-bold">Quando</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-5">
                      <div className="font-semibold text-sm text-slate-800">
                        {getMatchLabel(row.match)}
                      </div>

                      <div className="text-[11px] text-slate-500">
                        {row.match.date} às {row.match.time}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{row.player.avatar || '⚽'}</span>
                        <span className="font-semibold text-sm text-slate-800 truncate">
                          {row.player.name}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="font-mono text-sm font-black text-slate-800">
                        {row.prediction.scoreA} x {row.prediction.scoreB}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {getResultLabel(row.match)}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-[10px] font-extrabold ${getPointsClass(row)}`}
                      >
                        {getPointsLabel(row)}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-[11px] font-semibold text-slate-500">
                        <Clock3 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDateTime(row.prediction.updatedAt || row.prediction.createdAt)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <article key={row.key} className="p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 leading-snug">
                      {getMatchLabel(row.match)}
                    </p>

                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {row.match.date} às {row.match.time}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-extrabold ${getPointsClass(row)}`}
                  >
                    {getPointsLabel(row)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Participante
                    </p>

                    <p className="text-xs font-bold text-slate-800 truncate">
                      {row.player.avatar || '⚽'} {row.player.name}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Palpite
                    </p>

                    <p className="text-xs font-black text-slate-800">
                      {row.prediction.scoreA} x {row.prediction.scoreB}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Resultado
                    </p>

                    <p className="text-xs font-bold text-slate-700">
                      {getResultLabel(row.match)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Quando
                    </p>

                    <p className="text-xs font-bold text-slate-700">
                      {formatDateTime(row.prediction.updatedAt || row.prediction.createdAt)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="border-t border-slate-100 bg-white px-4 py-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
        <ListChecks className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>
          A conferência mostra apenas palpites salvos no banco. Dados de login e controles de admin ficam ocultos.
        </span>
      </div>
    </section>
  );
}
