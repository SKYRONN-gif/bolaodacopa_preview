/**
 * Representa uma seleção que pode ser escolhida na funcionalidade
 * "Bolsa Campeão".
 *
 * Esses dados são usados dentro de ChampionPickSettings.eligibleTeams
 * para mostrar os times disponíveis na tela de escolha.
 */
export interface ChampionPickTeam {
  // Código curto e estável da seleção, como "BRA" ou "ARG".
  code: string;

  // Nome exibido para o usuário, como "Brasil".
  name: string;

  // URL opcional da logo usada na interface.
  logo?: string | null;
}

/**
 * Controla a configuração geral da Bolsa Campeão.
 *
 * Normalmente esses dados vêm do documento settings/championPick no Firestore.
 * Eles determinam se a funcionalidade aparece para os usuários, se novas
 * escolhas estão liberadas e quais seleções podem ser escolhidas.
 */
export interface ChampionPickSettings {
  // Define se a funcionalidade está habilitada no sistema.
  enabled: boolean;

  // Impede novas escolhas mesmo que a funcionalidade esteja habilitada.
  locked: boolean;

  // Quantidade de pontos extras para quem acertar a seleção campeã.
  bonusPoints: number;

  // Código da seleção campeã oficial, preenchido quando ela for definida.
  championTeamCode: string;

  // Lista completa usada pela tela para mostrar código, nome e logo dos times.
  eligibleTeams: ChampionPickTeam[];

  // Lista simplificada de códigos usada principalmente para validações.
  eligibleTeamCodes: string[];

  // Data da última alteração da configuração.
  updatedAt?: string;
}

/**
 * Registra a escolha de campeão feita por um participante.
 *
 * Esse objeto é salvo no Firestore para vincular um jogador à seleção
 * escolhida e permitir conferir posteriormente quem acertou a campeã.
 */
export interface ChampionPick {
  // Identificador interno do jogador que fez a escolha.
  playerId: string;

  // E-mail usado para vincular a escolha ao usuário autenticado.
  playerEmail: string;

  // Nome do jogador no momento em que a escolha foi salva.
  playerName: string;

  // Código da seleção escolhida, como "BRA".
  teamCode: string;

  // Nome da seleção escolhida, como "Brasil".
  teamName: string;

  // Logo da seleção escolhida, caso esteja disponível.
  teamLogo?: string | null;

  // Data e hora em que o participante registrou sua escolha.
  createdAt: string;
}