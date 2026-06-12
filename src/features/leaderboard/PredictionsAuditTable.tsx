import { SearchCheck } from 'lucide-react';

import { isAdminPlayer } from '../../domain/finance';
import { calculatePredictionPoints } from '../../domain/scoring';
import { Match, Player, Prediction } from '../../types';

interface PredictionsAuditTableProps {
  matches: Match[];
  players: Player[];
}

function formatPrediction(prediction?: Prediction) {
  if (!prediction) return '—';

  return `${prediction.scoreA}x${prediction.scoreB}`;
}

function formatPredictionDate(prediction?: Prediction) {
  const dateValue = prediction?.updatedAt || prediction?.createdAt;

  if (!dateValue) return 'Sem data';

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Sem data';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getPredictionClass(player: Player, match: Match) {
  const result = calculatePredictionPoints(player.predictions[match.id], match);

  if (result.type === 'exact') {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }

  if (result.type === 'partial') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }

  if (result.type === 'error') {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-white text-slate-700 border-slate-200';
}

export function PredictionsAuditTable({
  matches,
  players,
}: PredictionsAuditTableProps) {
  return (
    <section className="app-card overflow-hidden" id="predictions-audit">
      <div className="p-4 md:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <SearchCheck className="w-5 h-5 text-emerald-700 shrink-0" />

          <div>
            <h3 className="font-bold text-base text-slate-800 uppercase tracking-tight">
              Conferência de palpites
            </h3>

            <p className="text-xs text-slate-500">
              Tabela pública com o placar palpitado e o último horário salvo.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 shrink-0">
          {players.length} perfis
        </span>
      </div>

      {players.length === 0 || matches.length === 0 ? (
        <div className="p-6 text-sm text-slate-600">
          Assim que houver participantes e jogos cadastrados, os palpites
          aparecerão aqui.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-200">
                <th className="sticky left-0 z-10 bg-white py-3 px-4 font-bold min-w-[190px]">
                  Participante
                </th>

                {matches.map((match, index) => (
                  <th
                    key={match.id}
                    className="py-3 px-3 text-center font-bold min-w-[96px]"
                    title={`${match.teamA} x ${match.teamB}`}
                  >
                    <span className="block font-mono">J{index + 1}</span>
                    <span className="block text-base leading-none mt-1">
                      {match.flagA} x {match.flagB}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {players.map((player) => (
                <tr key={player.id} className="hover:bg-slate-50/60">
                  <td className="sticky left-0 z-10 bg-white py-3 px-4 border-r border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl h-9 w-9 min-w-[36px] bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center">
                        {player.avatar || '⚽'}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-sm text-slate-800 truncate">
                            {player.name}
                          </span>

                          {isAdminPlayer(player) && (
                            <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded uppercase shrink-0">
                              ADM
                            </span>
                          )}
                        </div>

                        {isAdminPlayer(player) && (
                          <p className="text-[10px] text-red-500 font-semibold">
                            Perfil de administração
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {matches.map((match) => {
                    const prediction = player.predictions[match.id];

                    return (
                      <td key={match.id} className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[54px] rounded-lg border px-2 py-1 text-xs font-black font-mono ${getPredictionClass(
                            player,
                            match
                          )}`}
                        >
                          {formatPrediction(prediction)}
                        </span>

                        {prediction && (
                          <span className="block mt-1 text-[9px] text-slate-400 font-semibold">
                            {formatPredictionDate(prediction)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
