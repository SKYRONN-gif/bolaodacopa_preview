import { Match, Player } from '../../types';
import { isPredictionLocked } from '../../domain/rules';
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
  const openCount = matches.filter((match) => {
    return match.status === 'scheduled' && !isPredictionLocked(match);
  }).length;

  const missingCount = matches.filter((match) => {
    const hasPrediction = Boolean(userPlayer.predictions[match.id]);
    const isOpen = match.status === 'scheduled' && !isPredictionLocked(match);

    return isOpen && !hasPrediction;
  }).length;

  const predictedCount = matches.filter((match) => {
    return Boolean(userPlayer.predictions[match.id]);
  }).length;

  const lockedCount = matches.filter((match) => {
    const isFinished = match.status === 'finished';

    return isPredictionLocked(match) && !isFinished;
  }).length;

  const finishedCount = matches.filter((match) => {
    return match.status === 'finished';
  }).length;

  const items: Array<{
    id: MatchFilter;
    label: string;
    count: number;
  }> = [
    {
      id: 'open',
      label: 'Abertos',
      count: openCount,
    },
    {
      id: 'missing',
      label: 'Sem palpite',
      count: missingCount,
    },
    {
      id: 'predicted',
      label: 'Meus palpites',
      count: predictedCount,
    },
    {
      id: 'locked',
      label: 'Travados',
      count: lockedCount,
    },
    {
      id: 'finished',
      label: 'Finalizados',
      count: finishedCount,
    },
    {
      id: 'all',
      label: 'Todos',
      count: matches.length,
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