import { Match, Player } from '../../types';
import { getMatchFilterCounts } from '../../domain/matchFilters';
import { MatchFilter } from './types';

interface MatchFilterTabsProps {
  matches: Match[];
  userPlayer: Player;
  activeFilter: MatchFilter;
  onChangeFilter: (filter: MatchFilter) => void;
}

export function MatchFilterTabs({
  matches,
  userPlayer,
  activeFilter,
  onChangeFilter,
}: MatchFilterTabsProps) {
  const counts = getMatchFilterCounts(matches, userPlayer);

  const items: Array<{
    id: MatchFilter;
    label: string;
    count: number;
  }> = [
    {
      id: 'open',
      label: 'Abertos',
      count: counts.open,
    },
    {
      id: 'missing',
      label: 'Sem palpite',
      count: counts.missing,
    },
    {
      id: 'predicted',
      label: 'Meus palpites',
      count: counts.predicted,
    },
    {
      id: 'locked',
      label: 'Travados',
      count: counts.locked,
    },
    {
      id: 'finished',
      label: 'Finalizados',
      count: counts.finished,
    },
    {
      id: 'all',
      label: 'Todos',
      count: counts.all,
    },
  ];

  return (
    <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg w-full gap-1">
      {items.map((item) => {
        const isActive = activeFilter === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeFilter(item.id)}
            className={`flex-1 sm:flex-initial px-3 py-2 rounded-md text-xs font-bold transition whitespace-nowrap ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.label} ({item.count})
          </button>
        );
      })}
    </div>
  );
}
