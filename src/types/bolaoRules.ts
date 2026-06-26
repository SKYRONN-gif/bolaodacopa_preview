/**
 * Verificar em finance.ts e scoring.ts
 */
export interface BolaoRules {
  entryFee: number; // R$ 10.00
  firstPlacePercentage: number; // 0.8
  secondPlacePercentage: number; // 0.2
  pointsExact: number; // 3
  pointsPartial: number; // 1
  pointsError: number; // 0
}