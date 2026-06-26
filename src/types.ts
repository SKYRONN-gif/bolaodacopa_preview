/**
 * Não busca nem salva dados. Define os contratos de tipos usados no projeto.
 *
 * As interfaces informam quais campos são esperados, quais são obrigatórios
 * e qual tipo de valor cada campo deve receber.
 *
 * Elas ajudam o TypeScript durante o desenvolvimento, mas não validam
 * dados recebidos do Firebase em tempo de execução.
 *
 * export permite usar esses tipos em outros arquivos.
 * ? indica que um campo pode não existir.
 */

/**
 * Fachada temporária de compatibilidade.
 *
 * Mantém os imports atuais do projeto funcionando enquanto os tipos
 * ficam organizados em arquivos separados dentro de src/types.
 */

export type { AppTab } from './types/appTab';
export type { BolaoRules } from './types/bolaoRules';

export type {
  ChampionPick,
  ChampionPickSettings,
  ChampionPickTeam,
} from './types/championPick';

export type { Match } from './types/match';
export type { Player } from './types/player';
export type { Prediction } from './types/prediction';