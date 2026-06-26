
/**
 * Representa o palpite de um jogador para uma única partida.
 *
 * scoreA e scoreB vêm do formulário preenchido pelo usuário.
 * Esse objeto é salvo dentro de Player.predictions, usando o id
 * da partida como chave.
 */
export interface Prediction {                               //ex const palpite: Prediction = {
                                                            //  scoreA: 2,
                                                            // scoreB: 1,
                                                            //  createdAt: '2026-06-10T18:30:00.000Z',
                                                            //  updatedAt: '2026-06-11T13:20:00.000Z',
                                                            
  scoreA: number; //campos digitados pelo usuário
  scoreB: number;
  createdAt?: string; //momento do primeiro salvamento
  updatedAt?: string; //ultima alteração
}
