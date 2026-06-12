interface OfflineBannerProps {
  onReconnect: () => void;
}

export function OfflineBanner({ onReconnect }: OfflineBannerProps) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3 text-xs font-semibold">
      <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>

          <p className="leading-relaxed">
            <strong>Modo local ativo:</strong> não conseguimos conectar ao
            Firestore agora. Alterações feitas aqui podem não sincronizar com o
            banco.
          </p>
        </div>

        <button
          type="button"
          onClick={onReconnect}
          className="text-[10px] uppercase font-extrabold tracking-wide text-amber-900 border border-amber-300 px-3 py-2 rounded-lg hover:bg-amber-100 transition bg-white shadow-sm self-start sm:self-auto"
        >
          Reconectar banco
        </button>
      </div>
    </div>
  );
}
