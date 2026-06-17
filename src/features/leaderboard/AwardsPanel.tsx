import {
  AlertTriangle,
  Flame,
  Target,
  TrendingUp,
} from 'lucide-react';

import { buildAwards, getAwardWinnerText, AwardType } from '../../domain/awards';
import { Match, Player } from '../../types';

interface AwardsPanelProps {
  matches: Match[];
  players: Player[];
}

const awardIcons: Record<AwardType, typeof Target> = {
  exact: Target,
  streak: Flame,
  errors: AlertTriangle,
  almost: TrendingUp,
};

export function AwardsPanel({ matches, players }: AwardsPanelProps) {
  const awards = buildAwards(players, matches);

  if (awards.length === 0) {
    return null;
  }

  return (
    <section className="app-card app-card-padding">
      <div className="mb-4 flex flex-col gap-1">
        <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
          Destaques
        </p>

        <h2 className="text-xl font-black text-slate-950">
          Medalhas do momento
        </h2>

        <p className="text-sm text-slate-500">
          Uma leitura rápida dos acertos, sequências e zicadas do bolão.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {awards.map((award) => {
          const Icon = awardIcons[award.type];

          return (
            <article
              key={award.type}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-700">
                  <Icon className="h-4 w-4" />
                </div>

                <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                  {award.valueLabel}
                </span>
              </div>

              <h3 className="text-sm font-black text-slate-900">
                {award.title}
              </h3>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                {award.description}
              </p>

              <p className="mt-3 line-clamp-2 text-sm font-bold text-slate-800">
                {getAwardWinnerText(award)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}