export type ToastType = 'success' | 'info' | 'error';

export interface AdminToastState {
  message: string;
  type: ToastType;
}

export type ScoreInputValue = number | '';

export type NewPlayerPredictions = Record<
  string,
  {
    scoreA: ScoreInputValue;
    scoreB: ScoreInputValue;
  }
>;