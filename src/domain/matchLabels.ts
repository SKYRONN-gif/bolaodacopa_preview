export function getMatchGroupLabel(group?: string) {
  const normalizedGroup = group?.trim().toLowerCase();

  const labels: Record<string, string> = {
    'group-stage': 'Fase de grupos',
    group: 'Fase de grupos',
    'round-of-32': '32 avos',
    'round of 32': '32 avos',
    'round-of-16': 'Oitavas',
    'round of 16': 'Oitavas',
    quarterfinal: 'Quartas',
    quarterfinals: 'Quartas',
    semifinal: 'Semifinal',
    semifinals: 'Semifinal',
    final: 'Final',
    'third-place': 'Disputa de 3º lugar',
  };

  if (!normalizedGroup) {
    return 'Copa do Mundo 2026';
  }

  return labels[normalizedGroup] || group || 'Copa do Mundo 2026';
}