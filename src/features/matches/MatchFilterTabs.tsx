import { Match } from '../../types';
import { MatchFilter } from './types';

interface MatchFilterTabsProps {
  matches: Match[];
  activeFilter: MatchFilter;
  onChangeFilter: (filter: MatchFilter) => void;
}

export function MatchFilterTabs({
  matches,
  activeFilter,
  onChangeFilter,
}: MatchFilterTabsProps) {
  const scheduledCount = matches.filter((match) => match.status === 'scheduled').length;
  const finishedCount = matches.filter((match) => match.status === 'finished').length;

  const items: Array<{
    id: MatchFilter;
    label: string;
    count: number;
  }> = [
    {
      id: 'all',
      label: 'Todos',
      count: matches.length,
    },
    {
      id: 'scheduled',
      label: 'Abertos',
      count: scheduledCount,
    },
    {
      id: 'finished',
      label: 'Finalizados',
      count: finishedCount,
    },
  ];

  return (
    <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
      {items.map((item) => {
        const isActive = activeFilter === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeFilter(item.id)}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-xs font-bold transition ${
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