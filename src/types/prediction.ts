/**
 * Representa o palpite de um jogador para uma única partida.
 *
 * scoreA e scoreB vêm do formulário preenchido pelo usuário.
 * Esse objeto é salvo dentro de Player.predictions, usando o id
 * da partida como chave.
 *
 * As datas costumam ser salvas em formato ISO/UTC para evitar problemas
 * de fuso horário. A tela deve converter para o horário local ao exibir.
 */
export interface Prediction {
  // Placar previsto para Match.teamA.
  scoreA: number;

  // Placar previsto para Match.teamB.
  scoreB: number;

  // Momento em que o palpite foi salvo pela primeira vez.
  createdAt?: string;

  // Momento da última alteração permitida no palpite.
  updatedAt?: string;
}