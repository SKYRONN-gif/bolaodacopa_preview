import { TrendingUp } from 'lucide-react';

import { PredictionsAuditTable } from '../features/leaderboard/PredictionsAuditTable';
import { PrizeSummary } from '../features/leaderboard/PrizeSummary';
import { RankingMobileList } from '../features/leaderboard/RankingMobileList';
import { RankingTable } from '../features/leaderboard/RankingTable';
import { Match, Player } from '../types';
import { AwardsPanel } from '../features/leaderboard/AwardsPanel';

interface LeaderboardProps {
  matches: Match[];
  players: Player[];
  paidPlayersCount: number;
}

export function Leaderboard({
  matches,
  players,
  paidPlayersCount,
}: LeaderboardProps) {
  return (
    <div className="space-y-6" id="leaderboard-section">
      <PrizeSummary
        paidPlayersCount={paidPlayersCount}
        totalPlayersCount={players.length}
      />

      <AwardsPanel matches={matches} players={players} />

      <section className="app-card overflow-hidden" id="ranking-container">
        <div className="p-4 md:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />

            <div>
              <h3 className="font-bold text-base text-slate-800 uppercase tracking-tight">
                Classificação geral
              </h3>

              <p className="text-xs text-slate-500">
                Ranking atualizado conforme os resultados lançados.
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 shrink-0">
            {players.length} jogadores
          </span>
        </div>

        {players.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">
            Nenhum participante cadastrado ainda. Quando as pessoas entrarem
            com Google ou forem adicionadas pelo admin, o ranking aparecerá
            aqui.
          </div>
        ) : (
          <>
            <RankingMobileList
              paidPlayersCount={paidPlayersCount}
              players={players}
            />
            <RankingTable paidPlayersCount={paidPlayersCount} players={players} />
          </>
        )}
      </section>

      <PredictionsAuditTable matches={matches} players={players} />
    </div>
  );
}
