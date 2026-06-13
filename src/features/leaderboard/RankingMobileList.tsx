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
import { getManualAdjustmentText } from './manualAdjustment';

interface RankingMobileListProps {
  paidPlayersCount: number;
  players: Player[];
}

function getPrizeText(paidRank: number | null, paidPlayersCount: number) {
  const totalPrizePool = calculatePrizePool(paidPlayersCount);

  if (paidRank === 1) {
    return `Prêmio: R$ ${(totalPrizePool * FIRST_PLACE_PERCENTAGE).toFixed(2)}`;
  }

  if (paidRank === 2) {
    return `Prêmio: R$ ${(totalPrizePool * SECOND_PLACE_PERCENTAGE).toFixed(2)}`;
  }

  return null;
}

export function RankingMobileList({
  paidPlayersCount,
  players,
}: RankingMobileListProps) {
  return (
    <div className="md:hidden divide-y divide-slate-100">
      {players.map((player, index) => {
        const rank = index + 1;
        const isFirst = rank === 1;
        const isSecond = rank === 2;
        const isAdmin = isAdminPlayer(player);
        const paidRank = getPaidRank(players, index);
        const prizeText = getPrizeText(paidRank, paidPlayersCount);
        const manualAdjustmentText = getManualAdjustmentText(player);

        return (
          <motion.article
            key={player.id}
            layoutId={`player-mobile-card-${player.id}`}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className={`p-4 ${
              isFirst
                ? 'bg-amber-50'
                : isSecond
                  ? 'bg-slate-50'
                  : 'bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0">
                  {isFirst ? (
                    <div className="w-9 h-9 rounded-lg bg-amber-400 text-white flex items-center justify-center shadow-sm">
                      <Trophy className="w-4 h-4" />
                    </div>
                  ) : isSecond ? (
                    <div className="w-9 h-9 rounded-lg bg-slate-400 text-white flex items-center justify-center shadow-sm">
                      <Award className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs">
                      {rank}º
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl shrink-0">
                      {player.avatar || '⚽'}
                    </span>

                    <h3 className="font-bold text-sm text-slate-900 truncate">
                      {player.name}
                    </h3>

                    {isAdmin && (
                      <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded uppercase shrink-0">
                        ADM
                      </span>
                    )}
                  </div>

                  {isAdmin ? (
                    <p className="text-[11px] font-semibold mt-0.5 text-red-500">
                      Não entra na premiação
                    </p>
                  ) : prizeText ? (
                    <p
                      className={`text-[11px] font-semibold mt-0.5 ${
                        isFirst ? 'text-amber-700' : 'text-slate-600'
                      }`}
                    >
                      {prizeText}
                    </p>
                  ) : null}

                  {manualAdjustmentText && (
                    <p className="text-[11px] font-semibold mt-0.5 text-blue-600">
                      {manualAdjustmentText}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xl font-black text-slate-900 leading-none">
                  {player.points}
                </p>

                <p className="text-[10px] text-slate-400 font-bold uppercase">
                  pts
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white/80 border border-slate-200 rounded-lg p-2 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Exatos
                </p>

                <p className="text-sm font-black text-emerald-600">
                  {player.exactHits}
                </p>
              </div>

              <div className="bg-white/80 border border-slate-200 rounded-lg p-2 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Parciais
                </p>

                <p className="text-sm font-black text-blue-600">
                  {player.partialHits}
                </p>
              </div>

              <div className="bg-white/80 border border-slate-200 rounded-lg p-2 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Erros
                </p>

                <p className="text-sm font-black text-slate-500">
                  {player.errorHits}
                </p>
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
