import { Eye, EyeOff, Info } from 'lucide-react';

interface MatchesInfoBannerProps {
  revealOthers: boolean;
  onToggleRevealOthers: () => void;
}

export function MatchesInfoBanner({
  revealOthers,
  onToggleRevealOthers,
}: MatchesInfoBannerProps) {
  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex gap-3 items-start">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />

        <div>
          <h4 className="font-bold text-sm text-emerald-950">
            Palpites com conferência pública
          </h4>

          <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
            A classificação tem uma tabela para todos conferirem os palpites
            salvos. Neste painel, você também pode mostrar os palpites direto
            nos cards dos jogos.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleRevealOthers}
        className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
          revealOthers
            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200'
            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        {revealOthers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        <span>{revealOthers ? 'Ocultar nos cards' : 'Mostrar nos cards'}</span>
      </button>
    </div>
  );
}
