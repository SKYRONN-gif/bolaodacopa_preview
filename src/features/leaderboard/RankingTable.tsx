import { Award, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

import {
  calculatePrizePool,
  FIRST_PLACE_PERCENTAGE,
  getPaidRank,
  isAdminPlayer,
  SECOND_PLACE_PERCENTAGE,
} from '../../domain/finance';
import { Player } from '../../types';

interface RankingTableProps {
  paidPlayersCount: number;
  players: Player[];
}

function getPrizeText(paidRank: number | null, paidPlayersCount: number) {
  const totalPrizePool = calculatePrizePool(paidPlayersCount);

  if (paidRank === 1) {
    return `Zona de premiação - R$ ${(
      totalPrizePool * FIRST_PLACE_PERCENTAGE
    ).toFixed(2)}`;
  }

  if (paidRank === 2) {
    return `Zona de premiação - R$ ${(
      totalPrizePool * SECOND_PLACE_PERCENTAGE
    ).toFixed(2)}`;
  }

  return null;
}

export function RankingTable({
  paidPlayersCount,
  players,
}: RankingTableProps) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-200">
            <th className="py-4 px-6 text-center font-bold w-16">Pos</th>
            <th className="py-4 px-4 font-bold">Participante</th>
            <th className="py-4 px-4 text-center font-bold w-24">Exatos</th>
            <th className="py-4 px-4 text-center font-bold w-24">Parciais</th>
            <th className="py-4 px-4 text-center font-bold w-24">Erros</th>
            <th className="py-4 px-6 text-right font-bold w-28">Pontos</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {players.map((player, index) => {
            const rank = index + 1;
            const isFirst = rank === 1;
            const isSecond = rank === 2;
            const isAdmin = isAdminPlayer(player);
            const paidRank = getPaidRank(players, index);
            const prizeText = getPrizeText(paidRank, paidPlayersCount);

            return (
              <motion.tr
                key={player.id}
                layoutId={`player-row-${player.id}`}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className={`${
                  isFirst
                    ? 'bg-amber-50 hover:bg-amber-100/40 transition-colors'
                    : isSecond
                      ? 'bg-slate-50 hover:bg-slate-100/50 transition-colors'
                      : 'hover:bg-slate-50/40 transition-colors'
                }`}
              >
                <td className="py-4 px-6 text-center">
                  <div className="flex justify-center items-center">
                    {isFirst ? (
                      <div
                        className="w-7 h-7 rounded-lg bg-amber-400 text-white flex items-center justify-center shadow-sm"
                        title="1º lugar"
                      >
                        <Trophy className="w-4 h-4" />
                      </div>
                    ) : isSecond ? (
                      <div
                        className="w-7 h-7 rounded-lg bg-slate-400 text-white flex items-center justify-center shadow-sm"
                        title="2º lugar"
                      >
                        <Award className="w-4 h-4" />
                      </div>
                    ) : (
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                        {rank}º
                      </span>
                    )}
                  </div>
                </td>

                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl h-10 w-10 min-w-[40px] bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center select-none">
                      {player.avatar || '⚽'}
                    </span>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 text-sm">
                          {player.name}
                        </span>

                        {isAdmin && (
                          <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded uppercase">
                            ADM
                          </span>
                        )}
                      </div>

                      {isAdmin ? (
                        <span className="text-[10px] font-semibold text-red-500">
                          Não entra na premiação
                        </span>
                      ) : prizeText ? (
                        <span
                          className={`text-[10px] font-semibold ${
                            isFirst ? 'text-amber-600' : 'text-slate-600'
                          }`}
                        >
                          {prizeText}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </td>

                <td className="py-4 px-4 text-center font-mono text-sm text-emerald-600 font-bold">
                  {player.exactHits}
                </td>

                <td className="py-4 px-4 text-center font-mono text-sm text-blue-600 font-medium">
                  {player.partialHits}
                </td>

                <td className="py-4 px-4 text-center font-mono text-sm text-slate-400">
                  {player.errorHits}
                </td>

                <td className="py-4 px-6 text-right">
                  <span className="text-lg font-black text-slate-800">
                    {player.points}{' '}
                    <span className="text-xs font-semibold text-slate-400">
                      pts
                    </span>
                  </span>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
