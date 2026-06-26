/**
 * Define o formato de uma configuração central das regras do bolão.
 *
 * Essa interface informa quais valores seriam necessários para calcular
 * taxa de entrada, divisão da premiação e pontuação dos palpites.
 *
 * Ela não aplica nem armazena essas regras sozinha; apenas descreve
 * como um objeto de regras deve ser estruturado.
 */
export interface BolaoRules {
  entryFee: number;
  firstPlacePercentage: number;
  secondPlacePercentage: number;
  pointsExact: number;
  pointsPartial: number;
  pointsError: number;
}