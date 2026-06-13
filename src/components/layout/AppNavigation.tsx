import { CalendarDays, Home, Shield, Trophy } from 'lucide-react';

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
          <div className="flex gap-1 py-2">
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
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#052f22] border-t border-[#0a5a40] shadow-[0_-8px_24px_rgba(15,23,42,0.18)]">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold transition ${
                  isActive
                    ? 'text-emerald-950 bg-emerald-100'
                    : 'text-emerald-50/75'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
