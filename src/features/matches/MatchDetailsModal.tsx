import { BarChart3, Target, Users, X } from 'lucide-react';
import { useMemo } from 'react';

import { buildMatchStats } from '../../domain/matchStats';
import { Match, Player } from '../../types';
import { TeamBadge } from './TeamBadge';
import { getMatchGroupLabel } from '../../domain/matchLabels';

interface MatchDetailsModalProps {
  match: Match;
  players: Player[];
  onClose: () => void;
}

function formatNames(names: string[]) {
  if (names.length === 0) return 'Ninguém ainda.';

  if (names.length <= 6) {
    return names.join(', ');
  }

  return `${names.slice(0, 6).join(', ')} e mais ${names.length - 6}`;
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

export function MatchDetailsModal({
  match,
  players,
  onClose,
}: MatchDetailsModalProps) {
  const stats = useMemo(
    () => buildMatchStats(match, players),
    [match, players]
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
                Detalhes do jogo
              </p>

              <div className="mt-2 flex items-center gap-3">
                <TeamBadge
                  flag={match.flagA}
                  logo={match.logoA}
                  name={match.teamA}
                />

                <h2 className="min-w-0 text-lg font-black text-slate-950">
                  {match.teamA} x {match.teamB}
                </h2>

                <TeamBadge
                  flag={match.flagB}
                  logo={match.logoB}
                  name={match.teamB}
                />
              </div>

              <p className="mt-2 text-xs font-semibold text-slate-500">
  {getMatchGroupLabel(match.group)} • {match.date} às {match.time}
  {match.venue ? ` • ${match.venue}` : ''}
</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Palpites
              </p>

              <p className="mt-1 text-xl font-black text-slate-900">
                {stats.totalPredictions}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {match.teamA} vence
              </p>

              <p className="mt-1 text-xl font-black text-slate-900">
                {stats.teamAWins}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Empate
              </p>

              <p className="mt-1 text-xl font-black text-slate-900">
                {stats.draws}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {match.teamB} vence
              </p>

              <p className="mt-1 text-xl font-black text-slate-900">
                {stats.teamBWins}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-700" />

                <h3 className="text-sm font-black text-slate-900">
                  Placares mais escolhidos
                </h3>
              </div>

              {stats.topScores.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">
                  Ninguém palpitou nesse jogo ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.topScores.map((score) => (
                    <div
                      key={score.scoreLabel}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm font-black text-slate-900">
                          {score.scoreLabel}
                        </span>

                        <span className="text-[10px] font-black uppercase tracking-wide text-emerald-700">
                          {score.count}{' '}
                          {score.count === 1 ? 'pessoa' : 'pessoas'}
                        </span>
                      </div>

                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {formatNames(score.playerNames)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-700" />

                <h3 className="text-sm font-black text-slate-900">
                  Resultado e pontuação
                </h3>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Resultado oficial
                </p>

                <p className="mt-1 font-mono text-lg font-black text-slate-900">
                  {getResultLabel(match)}
                </p>
              </div>

              {match.status === 'finished' ? (
                <div className="mt-3 space-y-2">
                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">
                      Exatos
                    </p>

                    <p className="mt-1 text-xs font-bold text-slate-800">
                      {formatNames(stats.exactPlayers)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">
                      Parciais
                    </p>

                    <p className="mt-1 text-xs font-bold text-slate-800">
                      {formatNames(stats.partialPlayers)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wide text-red-700">
                      Deu ruim
                    </p>

                    <p className="mt-1 text-xs font-bold text-slate-800">
                      {formatNames(stats.errorPlayers)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                    <p className="text-xs font-semibold leading-relaxed text-slate-500">
                      Quando o jogo finalizar, esta área mostra quem acertou
                      exato, quem fez parcial e quem foi de base.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}