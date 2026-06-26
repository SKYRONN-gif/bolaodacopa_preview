/**
 * Fachada temporária de compatibilidade para os tipos compartilhados.
 *
 * Mantém imports antigos, como `import type { Player } from '../types'`,
 * funcionando enquanto as definições foram separadas em arquivos dentro
 * da pasta `src/types`.
 *
 * Este arquivo pode ser removido futuramente, quando todos os imports
 * do projeto apontarem diretamente para `src/types/index.ts`.
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