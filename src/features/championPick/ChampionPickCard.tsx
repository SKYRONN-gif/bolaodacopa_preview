import { LockKeyhole, Trophy, TrendingUp } from 'lucide-react';

interface ChampionPickCardProps {
  bonusPoints?: number;
  isOpen?: boolean;
}

export function ChampionPickCard({
  bonusPoints = 30,
  isOpen = false,
}: ChampionPickCardProps) {
  return (
    <aside className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
            <Trophy className="h-3.5 w-3.5" />
            Bolsa Campeão
          </div>

          <h3 className="mt-3 text-lg font-black leading-tight text-slate-950">
            {bonusPoints} pts em jogo
          </h3>

          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">
            Escolha a seleção campeã no mata-mata. Quanto menos gente escolher
            o campeão, maior pode ser o bônus.
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          {isOpen ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <LockKeyhole className="h-5 w-5" />
          )}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-amber-100 bg-white/80 p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-600">Status</span>

          <span
            className={
              isOpen
                ? 'rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700'
                : 'rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600'
            }
          >
            {isOpen ? 'Aberta' : 'Fechada'}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-600">Seleções disponíveis</span>
          <strong className="text-slate-950">0</strong>
        </div>

        <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-500">
          A lista será liberada quando chegarmos na fase de mata-mata.
        </p>
      </div>
    </aside>
  );
}