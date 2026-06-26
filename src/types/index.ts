/**
 * Centraliza a exportação dos tipos compartilhados do projeto.
 *
 * Permite que outros arquivos importem os contratos de dados a partir
 * de src/types, sem precisar conhecer o arquivo específico de cada tipo.
 */
export type { AppTab } from './appTab';
export type { BolaoRules } from './bolaoRules';

export type {
  ChampionPick,
  ChampionPickSettings,
  ChampionPickTeam,
} from './championPick';

export type { Match } from './match';
export type { Player } from './player';
export type { Prediction } from './prediction';