import { CheckCircle } from 'lucide-react';
import { PredictionSide } from './types';

interface PredictionInputsProps {
  scoreA: string;
  scoreB: string;
  disabled: boolean;
  canEdit: boolean;
  isLocked: boolean;
  lockMessage: string;
  isSaveVisible: boolean;
  onChange: (side: PredictionSide, value: string) => void;
  onSave: () => void;
}

export function PredictionInputs({
  scoreA,
  scoreB,
  disabled,
  canEdit,
  isLocked,
  lockMessage,
  isSaveVisible,
  onChange,
  onSave,
}: PredictionInputsProps) {
  const inputClassName = `w-14 h-14 text-center font-black text-2xl border-2 rounded-lg focus:outline-none transition ${
    disabled
      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
      : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  }`;

  const handleChange = (side: PredictionSide, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '').slice(0, 2);
    onChange(side, cleanValue);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          disabled={disabled}
          value={scoreA}
          onChange={(event) => handleChange('A', event.target.value)}
          className={inputClassName}
        />

        <span className="text-slate-400 font-black">X</span>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          disabled={disabled}
          value={scoreB}
          onChange={(event) => handleChange('B', event.target.value)}
          className={inputClassName}
        />
      </div>

      <p
        className={`mt-2 text-[10px] font-semibold text-center ${
          isLocked ? 'text-amber-700' : 'text-slate-400'
        }`}
      >
        {canEdit ? lockMessage : 'Entre com o Google para salvar seu palpite.'}
      </p>

      {isSaveVisible && (
        <button
          type="button"
          onClick={onSave}
          className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
        >
          <CheckCircle className="w-3 h-3" />
          <span>Salvar palpite</span>
        </button>
      )}
    </div>
  );
}
