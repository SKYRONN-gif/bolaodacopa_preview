import type { Prediction } from './prediction';

/**
 * Representa um participante do bolão.
 *
 * Um jogador pode ter sido criado pelo login com Google, importado do banco
 * antigo ou adicionado manualmente pelo administrador. Esse modelo é usado
 * no Firestore, nos componentes de perfil e no cálculo do ranking.
 */
export interface Player {
  // Identificador interno do perfil do jogador.
  id: string;

  name: string;
  avatar: string;

  /**
   * Mapa de palpites do participante.
   *
   * A chave é o id da partida, como "m10", e o valor é o palpite feito
   * para aquela partida. Em Java, seria parecido com Map<String, Prediction>.
   */
  predictions: Record<string, Prediction>;

  /**
   * Dados exibidos no ranking.
   *
   * A pontuação é calculada a partir dos palpites, dos resultados finalizados
   * e de um possível ajuste manual.
   */
  points: number;
  exactHits: number;
  partialHits: number;
  errorHits: number;

  // Correção administrativa aplicada à pontuação, quando necessária.
  manualPointsAdjustment?: number;
  manualPointsAdjustmentUpdatedAt?: string;

  /**
   * Informa qual partida teve o palpite alterado por último.
   *
   * As Firestore Rules usam esse campo para verificar que somente um
   * palpite foi modificado e que a partida ainda estava aberta.
   */
  lastPredictionMatchId?: string;

  /**
   * Dados usados para identificar o participante e suas permissões.
   *
   * A interface pode usar isAdmin para mostrar recursos administrativos,
   * mas a autorização real é validada pelas Firestore Rules.
   */
  isAdmin?: boolean;
  email?: string;
}