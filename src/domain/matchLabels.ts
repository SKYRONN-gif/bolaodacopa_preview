// Mapeia os nomes técnicos das fases para textos mais legíveis na interface.
//
// As chaves representam como a fase pode vir do banco, da API ou de dados antigos.
// Os valores representam como essa fase deve aparecer para o usuário.
const MATCH_GROUP_LABELS: Record<string, string> = {
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

// Recebe o grupo/fase de uma partida e retorna um texto legível para exibir na tela.
//
// Se o grupo for conhecido, retorna a tradução definida em MATCH_GROUP_LABELS.
// Se o grupo existir, mas não estiver mapeado, retorna o próprio grupo.
// Se o grupo vier vazio ou ausente, retorna um texto genérico da competição.
export function getMatchGroupLabel(group?: string): string {
  // Normaliza o texto recebido para facilitar a comparação.
  //
  // trim remove espaços no começo e no fim.
  // toLowerCase evita diferença entre "Final", "FINAL" e "final".
  const normalizedGroup = group?.trim().toLowerCase();

  // Se não recebeu grupo, ou se veio apenas com espaços,
  // usa um texto genérico para a partida não ficar sem contexto na tela.
  if (!normalizedGroup) {
    return 'Copa do Mundo 2026';
  }

  // Primeiro tenta encontrar uma tradução para o grupo normalizado.
  //
  // Se não encontrar, retorna o próprio grupo recebido, mas sem espaços extras.
  // Isso evita esconder uma fase desconhecida que possa vir da API ou do cadastro.
  return (
    MATCH_GROUP_LABELS[normalizedGroup] ||
    group?.trim() ||
    'Copa do Mundo 2026'
  );
}