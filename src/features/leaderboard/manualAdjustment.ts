import { Player } from '../../types';

function formatAdjustmentDate(dateValue?: string) {
  if (!dateValue) return '';

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getManualAdjustmentText(
  player: Pick<
    Player,
    'manualPointsAdjustment' | 'manualPointsAdjustmentUpdatedAt'
  >
) {
  if (!player.manualPointsAdjustment) return '';

  const sign = player.manualPointsAdjustment > 0 ? '+' : '';
  const adjustedAt = formatAdjustmentDate(
    player.manualPointsAdjustmentUpdatedAt
  );
  const suffix = adjustedAt ? ` - alterado em ${adjustedAt}` : '';

  return `Ajuste manual: ${sign}${player.manualPointsAdjustment} pts${suffix}`;
}
