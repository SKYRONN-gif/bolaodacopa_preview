import {
  BadgeDollarSign,
  CalendarDays,
  Home,
  Shield,
  Trophy,
} from 'lucide-react';

import { AppTab } from '../../types';

interface AppNavigationProps {
  activeTab: AppTab;
  isAdmin: boolean;
  onChangeTab: (tab: AppTab) => void;
}

const baseItems: Array<{
  id: AppTab;
  label: string;
  shortLabel: string;
  icon: typeof Home;
}> = [
  {
    id: 'home',
    label: 'Início & Regras',
    shortLabel: 'Início',
    icon: Home,
  },
  {
    id: 'matches',
    label: 'Meus Palpites',
    shortLabel: 'Palpites',
    icon: CalendarDays,
  },
  {
    id: 'ranking',
    label: 'Classificação',
    shortLabel: 'Ranking',
    icon: Trophy,
  },
];

export function AppNavigation({
  activeTab,
  isAdmin,
  onChangeTab,
}: AppNavigationProps) {
  const items = isAdmin
    ? [
        ...baseItems,
        {
          id: 'admin' as AppTab,
          label: 'Painel ADM',
          shortLabel: 'ADM',
          icon: Shield,
        },
      ]
    : baseItems;

  return (
    <>
      <nav className="hidden md:block bg-[#052f22] border-b border-[#0a5a40] sticky top-0 z-40 shadow-sm shrink-0">
  <div className="max-w-6xl mx-auto px-4">
    <div className="flex items-center gap-3 py-2">
      <div className="mr-2 flex items-center gap-2 border-r border-white/10 pr-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/10 text-emerald-50">
          <BadgeDollarSign className="h-4 w-4" />
        </div>

        <div className="leading-tight">
          <p className="text-xs font-black text-white">Sponte Bet</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/60">
            Copa 2026
          </p>
        </div>
      </div>

      <div className="flex gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-100 text-emerald-950 border border-emerald-200'
                  : 'text-emerald-50/80 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
</nav>
    </>
  );
}
