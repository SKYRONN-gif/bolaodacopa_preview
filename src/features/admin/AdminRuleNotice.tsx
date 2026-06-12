import { AlertCircle } from 'lucide-react';

export function AdminRuleNotice() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />

      <div className="space-y-1">
        <h4 className="text-xs font-bold text-amber-800 uppercase">
          Regra dos palpites
        </h4>

        <p className="text-xs text-amber-700 leading-relaxed">
          Os palpites devem ser salvos antes do início de cada partida. Depois
          do horário do jogo, os palpites ficam travados no sistema.
        </p>
      </div>
    </div>
  );
}
