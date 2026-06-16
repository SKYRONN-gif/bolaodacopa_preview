import React, { useState } from 'react';
import { Match, Player, Prediction } from '../types';
import { AddPlayerForm } from '../features/admin/AddPlayerForm';
import { AdminDangerZone } from '../features/admin/AdminDangerZone';
import { AdminToast } from '../features/admin/AdminToast';
import { ManualPointsForm } from '../features/admin/ManualPointsForm';
import { MatchEditorForm } from '../features/admin/MatchEditorForm';
import { MatchResultForm } from '../features/admin/MatchResultForm';
import { AdminToastState, ToastType } from '../features/admin/types';

import { syncWorldCupMatchesFromApi } from '../services/matchesService';

interface AdminPanelProps {
  matches: Match[];
  players: Player[];
  onUpdateMatchResult: (
    matchId: string,
    scoreA: number,
    scoreB: number,
    status: 'scheduled' | 'finished'
  ) => void | Promise<void>;
  onSaveMatch: (
    match: Match,
    mode: 'create' | 'edit'
  ) => void | Promise<void>;
  onAddPlayer: (
    name: string,
    avatar: string,
    predictions: Record<string, Prediction>
  ) => void | Promise<void>;
  onUpdateManualAdjustment: (
    playerId: string,
    manualPointsAdjustment: number
  ) => void | Promise<void>;
  onSyncDefaultMatches: () => void | Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  matches,
  players,
  onUpdateMatchResult,
  onSaveMatch,
  onAddPlayer,
  onUpdateManualAdjustment,
  onSyncDefaultMatches,
}) => {
  const [toast, setToast] = useState<AdminToastState | null>(null);

  const [apiSyncMode, setApiSyncMode] = useState<
  'upcoming' | 'today' | 'finished' | 'all'
>('upcoming');

const [apiSyncLimit, setApiSyncLimit] = useState(10);
const [isSyncingApiMatches, setIsSyncingApiMatches] = useState(false);

  const triggerToast = (
    message: string,
    type: ToastType = 'success'
  ) => {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const handleSyncWorldCupMatchesFromApi = async () => {
  setIsSyncingApiMatches(true);

  try {
    const result = await syncWorldCupMatchesFromApi({
      today: apiSyncMode === 'today',
      upcoming: apiSyncMode === 'upcoming',
      finished: apiSyncMode === 'finished',
      limit: apiSyncLimit > 0 ? apiSyncLimit : undefined,
    });

    triggerToast(
      `Sincronização concluída: ${result.imported} jogos importados pela fonte ${result.source}.`,
      'success'
    );
  } catch (error) {
    triggerToast(
      error instanceof Error
        ? error.message
        : 'Erro ao sincronizar jogos da Copa pela API.',
      'error'
    );
  } finally {
    setIsSyncingApiMatches(false);
  }
};

  return (
    <div className="space-y-6 relative" id="admin-panel">
      <AdminToast toast={toast} />

      <MatchEditorForm
        matches={matches}
        onSaveMatch={onSaveMatch}
        onSuccess={(message) => triggerToast(message, 'success')}
        onError={(message) => triggerToast(message, 'error')}
      />

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
  <div>
    <h3 className="text-lg font-bold text-slate-900">
      Sincronizar jogos pela API
    </h3>
    <p className="text-sm text-slate-600 mt-1">
      Busca os jogos da Copa pela ESPN e usa OpenFootball como fallback.
      Os jogos são salvos em matches sem mexer nos palpites dos participantes.
    </p>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <label className="space-y-1">
      <span className="text-sm font-semibold text-slate-700">
        O que puxar?
      </span>

      <select
        value={apiSyncMode}
        onChange={(event) =>
          setApiSyncMode(
            event.target.value as 'upcoming' | 'today' | 'finished' | 'all'
          )
        }
        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
        disabled={isSyncingApiMatches}
      >
        <option value="upcoming">Próximos jogos</option>
        <option value="today">Jogos de hoje</option>
        <option value="finished">Jogos finalizados</option>
        <option value="all">Todos os jogos</option>
      </select>
    </label>

    <label className="space-y-1">
      <span className="text-sm font-semibold text-slate-700">
        Quantidade
      </span>

      <select
        value={apiSyncLimit}
        onChange={(event) => setApiSyncLimit(Number(event.target.value))}
        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
        disabled={isSyncingApiMatches}
      >
        <option value={5}>5 jogos</option>
        <option value={10}>10 jogos</option>
        <option value={20}>20 jogos</option>
        <option value={0}>Todos</option>
      </select>
    </label>

    <div className="flex items-end">
      <button
        type="button"
        onClick={handleSyncWorldCupMatchesFromApi}
        disabled={isSyncingApiMatches}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold rounded-xl px-4 py-2 transition"
      >
        {isSyncingApiMatches
          ? 'Sincronizando...'
          : 'Sincronizar jogos'}
      </button>
    </div>
  </div>

  <p className="text-xs text-slate-500">
    Dica: para o uso normal do bolão, use “Próximos jogos” com 10 ou 20.
    Use “Todos os jogos” apenas quando quiser carregar a tabela completa da Copa.
  </p>
</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MatchResultForm
          matches={matches}
          onUpdateMatchResult={onUpdateMatchResult}
          onSuccess={(message) => triggerToast(message, 'success')}
          onError={(message) => triggerToast(message, 'error')}
        />

        <ManualPointsForm
          players={players}
          onUpdateManualAdjustment={onUpdateManualAdjustment}
          onSuccess={(message) => triggerToast(message, 'success')}
          onError={(message) => triggerToast(message, 'error')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AddPlayerForm
          matches={matches}
          onAddPlayer={onAddPlayer}
          onSuccess={(message) => triggerToast(message, 'success')}
          onError={(message) => triggerToast(message, 'error')}
        />
      </div>

      <AdminDangerZone
        onSyncDefaultMatches={onSyncDefaultMatches}
        onSuccess={(message) => triggerToast(message, 'info')}
        onError={(message) => triggerToast(message, 'error')}
      />
    </div>
  );
};
