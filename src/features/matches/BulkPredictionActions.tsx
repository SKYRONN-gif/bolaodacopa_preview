import { Send } from 'lucide-react';

interface BulkPredictionActionsProps {
  onCopyAll: () => void;
  onShareAllWhatsApp: () => void;
}

export function BulkPredictionActions({
  onCopyAll,
  onShareAllWhatsApp,
}: BulkPredictionActionsProps) {
  return (
    <div className="flex gap-2 w-full sm:w-auto">
      <button
        type="button"
        onClick={onCopyAll}
        className="flex-1 sm:flex-initial whitespace-nowrap bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
      >
        <span>Copiar todos</span>
      </button>

      <button
        type="button"
        onClick={onShareAllWhatsApp}
        className="flex-1 sm:flex-initial whitespace-nowrap bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
      >
        <Send className="w-3.5 h-3.5" />
        <span>Enviar no WhatsApp</span>
      </button>
    </div>
  );
}   