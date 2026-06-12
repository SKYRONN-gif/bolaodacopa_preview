import { RotateCcw } from 'lucide-react';

interface AdminDangerZoneProps {
  onSyncDefaultMatches: () => void;
  onSuccess: (message: string) => void;
}

export function AdminDangerZone({
  onSyncDefaultMatches,
  onSuccess,
}: AdminDangerZoneProps) {
  const handleResetClick = () => {
    const confirmed = window.confirm(
      'Sincronizar a tabela base de jogos? Jogos adicionados manualmente, participantes e palpites serão preservados.'
    );

    if (!confirmed) return;

    onSyncDefaultMatches();
    onSuccess('Tabela base sincronizada sem apagar jogos manuais nem palpites.');
  };

  return (
    <section className="app-card app-card-padding">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 uppercase tracking-tight">
            Sincronização dos jogos
          </h3>

          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Atualiza a coleção de jogos com a tabela padrão do código e mantém
            jogos adicionados manualmente, participantes e palpites salvos no
            banco.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetClick}
          className="app-button-secondary flex items-center justify-center gap-1.5 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Sincronizar jogos</span>
        </button>
      </div>
    </section>
  );
}
