import { Award, Coins, Trophy } from 'lucide-react';

import { calculatePrizes } from '../../domain/finance';

interface PrizeSummaryProps {
  paidPlayersCount: number;
  totalPlayersCount: number;
}

export function PrizeSummary({
  paidPlayersCount,
  totalPlayersCount,
}: PrizeSummaryProps) {
  const { totalPrizePool, firstPrize, secondPrize } =
    calculatePrizes(paidPlayersCount);

  return (
    <section className="app-card app-card-padding">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-black uppercase tracking-wide">
            <Coins className="w-4 h-4" />
            <span>Bolão ativo - Entrada R$ 10,00</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-black mt-2 text-slate-900 leading-tight">
            Prêmio total: R$ {totalPrizePool.toFixed(2)}
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            Baseado em {paidPlayersCount} participantes pagantes
            {totalPlayersCount !== paidPlayersCount
              ? ` (${totalPlayersCount} perfis no ranking).`
              : '.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>

            <div>
              <p className="text-amber-800 text-[10px] font-bold uppercase tracking-wide">
                1º lugar - 80%
              </p>

              <p className="text-xl font-black text-amber-700">
                R$ {firstPrize.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <Award className="w-5 h-5" />
            </div>

            <div>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">
                2º lugar - 20%
              </p>

              <p className="text-xl font-black text-slate-800">
                R$ {secondPrize.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
