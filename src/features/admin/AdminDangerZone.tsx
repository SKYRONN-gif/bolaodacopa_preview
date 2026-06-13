import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

interface AdminDangerZoneProps {
  onSyncDefaultMatches: () => void | Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function AdminDangerZone({
  onSyncDefaultMatches,
  onSuccess,
  onError,
}: AdminDangerZoneProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleResetClick = async () => {
    const confirmed = window.confirm(
      'Sincronizar a tabela base de jogos? Jogos adicionados manualmente, participantes e palpites serão preservados.'
    );

    if (!confirmed) return;

    try {
      setIsSyncing(true);
      await onSyncDefaultMatches();
      onSuccess('Tabela base sincronizada sem apagar jogos manuais nem palpites.');
    } catch (error) {
      console.warn('Erro ao sincronizar jogos:', error);
      onError('Não foi possível sincronizar os jogos no banco agora.');
    } finally {
      setIsSyncing(false);
    }
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
          disabled={isSyncing}
          className="app-button-secondary flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar jogos'}</span>
        </button>
      </div>
    </section>
  );
}
